import {
  getSecret,
  checkSecretKeys,
  checkEvent,
  createDatabaseSecret,
  getRandomString,
  deleteDatabaseSecret,
  findSecretByTagValue,
  SecretDetails,
} from './secrets-helper';
import {DatabaseClient as PgDatabaseClient} from './postgres-helper';
import {EventParameters, IConfig} from './enums';
import {ApiResponse, ErrorResponse} from './types';
import * as fs from 'fs';
import * as path from 'path';
import {SecretListEntry} from '@aws-sdk/client-secrets-manager';
import {error} from 'aws-cdk/lib/logging';

function readConfig(): IConfig {
  const configPath = path.join(__dirname, 'config.json');
  const configFile = fs.readFileSync(configPath, 'utf-8');
  const config: IConfig = JSON.parse(configFile);
  return config;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export async function handler(
  event: any
): Promise<ApiResponse | ErrorResponse> {
  const queryParams = event.queryStringParameters || {};
  const operation = queryParams[EventParameters.OPERATION];
  const databaseName = queryParams[EventParameters.DATABASENAME];

  if (!isString(operation) || !isString(databaseName)) {
    console.error('Operation or Database name is not a string');
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Operation or Database name is not a string',
      }),
    };
  }

  const config = readConfig();
  const secretArn = config.secretArn;

  if (!(await checkEvent(event))) {
    console.error('Event is invalid');
    return {
      statusCode: 400,
      body: JSON.stringify({message: 'Event is invalid'}),
    };
  }

  console.log(`Operation is ${operation}`);

  try {
    const secret = await getSecret(secretArn);

    if (secret === null) {
      console.error(`Secret not found in Secrets Manager: ${secretArn}`);
      return {
        statusCode: 404,
        body: JSON.stringify({message: `Secret not found: ${secretArn}`}),
      };
    }

    if (!(await checkSecretKeys(secret))) {
      console.error(
        'Secret malformed, keys are missing. Required keys are username, password, endpoint, engine, and port.'
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Secret malformed, missing required keys',
        }),
      };
    }

    if (secret.engine === 'postgres') {
      const pg = new PgDatabaseClient({
        user: secret.username,
        host: secret.endpoint,
        database: 'postgres',
        password: secret.password,
        port: secret.port,
        ssl: {rejectUnauthorized: false},
      });

      switch (operation) {
        case 'dropDatabase':
          return await handleDropDatabase(pg, databaseName);

        case 'createDatabase':
          return await handleCreateDatabase(pg, secret, databaseName);

        case 'SELECT':
          return await handleSelect(pg);

        default:
          console.error('Operation not supported');
          return {
            statusCode: 400,
            body: JSON.stringify({
              message: `Operation not supported: ${operation}`,
            }),
          };
      }
    } else {
      console.error('Unsupported engine');
      return {
        statusCode: 400,
        body: JSON.stringify({message: 'Unsupported engine'}),
      };
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: `Internal Server Error: ${error.message}`,
        }),
      };
    } else {
      console.error('Unexpected error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({message: 'Internal Server Error'}),
      };
    }
  }
}

async function handleDropDatabase(
  pg: PgDatabaseClient,
  databaseName: string
): Promise<ApiResponse | ErrorResponse> {
  try {
    await pg.connect();

    try {
      await pg.revokeAdminPrivilegesSystemContext(databaseName);
    } catch (error) {
      handleNonExistError(error, 'revokeAdminPrivilegesSystemContext');
    }

    try {
      await pg.revokeAdminPrivilegesDatabaseContext(databaseName);
    } catch (error) {
      handleNonExistError(error, 'revokeAdminPrivilegesDatabaseContext');
    }

    try {
      await pg.dropDatabase(databaseName);
    } catch (error) {
      handleNonExistError(error, 'dropDatabase');
    }

    try {
      await pg.dropUser(databaseName);
    } catch (error) {
      handleNonExistError(error, 'dropUser');
    }

    await pg.end();

    const databaseSecretArn: SecretListEntry[] = await findSecretByTagValue(
      'database-manager-database-name',
      databaseName
    );

    if (databaseSecretArn.length === 0) {
      console.error(`Error finding secret for ${databaseName}`);
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: `Error finding secret for ${databaseName}`,
        }),
      };
    }

    for (const arn of databaseSecretArn) {
      console.log(`Deleting secret ${arn.ARN}`);

      try {
        await deleteDatabaseSecret(arn);
      } catch (error) {
        console.error(`Error deleting secret ${arn.ARN}`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Admin privileges have been revoked from user ${databaseName}. Database and user ${databaseName} have been dropped. All secrets tagged key=database-manager-database-name , value=${databaseName} were deleted successfully.`,
      }),
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error dropping database', error.message);
      await pg.end();
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: `Error dropping database: ${error.message}`,
        }),
      };
    } else {
      console.error('Unexpected error:', error);
      await pg.end();
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Unexpected error dropping database',
        }),
      };
    }
  }
}

async function handleCreateDatabase(
  pg: PgDatabaseClient,
  secret: SecretDetails,
  databaseName: string
): Promise<ApiResponse | ErrorResponse> {
  try {
    await pg.connect();
    await pg.createDatabase(databaseName);
    await pg.createUser(databaseName);
    const userPassword = await getRandomString(10);
    await pg.changePassword(databaseName, userPassword);
    await pg.grantAdminPrivilegesSystemContext(databaseName);
    await createDatabaseSecret(
      databaseName,
      databaseName,
      secret.endpoint,
      secret.port,
      userPassword
    );
    await pg.end();

    const pgDbContext = new PgDatabaseClient({
      user: secret.username,
      host: secret.endpoint,
      database: databaseName,
      password: secret.password,
      port: secret.port,
      ssl: {rejectUnauthorized: false},
    });

    await pgDbContext.connect();
    await pgDbContext.grantAdminPrivilegesDatabaseContext(
      databaseName,
      secret.endpoint,
      secret.password
    );
    await pgDbContext.end();

    return {
      statusCode: 200,
      body: JSON.stringify({message: `Database created successfully`}),
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error creating database', error);
      await pg.end();
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: `Error creating database: ${error.message}`,
        }),
      };
    } else {
      console.error('Unexpected error creating database:', error);
      await pg.end();
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Unexpected error creating database',
        }),
      };
    }
  }
}

async function handleSelect(
  pg: PgDatabaseClient
): Promise<ApiResponse | ErrorResponse> {
  try {
    await pg.connect();
    const result = await pg.selectDate();
    console.log(`Result is ${result}`);
    await pg.end();
    return {
      statusCode: 200,
      body: JSON.stringify({message: result}),
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error selecting data', error.message);
      await pg.end();
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: `Error selecting data: ${error.message}`,
        }),
      };
    } else {
      console.error('Unexpected error selecting data:', error);
      await pg.end();
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Unexpected error selecting data',
        }),
      };
    }
  }
}

function handleNonExistError(error: unknown, operation: string) {
  if (error instanceof Error && error.message.includes('does not exist')) {
    console.error(`Error calling ${operation}: this is ok. ${error.message}`);
  } else {
    console.error(`Error calling ${operation}: ${error}`);
  }
}
