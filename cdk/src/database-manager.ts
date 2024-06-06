import {
  getSecret,
  checkSecretKeys,
  checkEvent,
  createDatabaseSecret,
  getRandomString,
  deleteDatabaseSecret,
} from './secrets-helper';
import {DatabaseClient as PgDatabaseClient} from './postgres-helper';
import {EventParameters, IConfig} from './enums';
import {ApiResponse, ErrorResponse} from './types';
import * as fs from 'fs';
import * as path from 'path';
import {Config} from '../lib/cdk-stack';

function readConfig(): IConfig {
  const configPath = path.join('.', 'config.json');
  const configFile = fs.readFileSync(configPath, 'utf-8');
  const config: IConfig = JSON.parse(configFile);
  return config;
}

export async function handler(
  event: any
): Promise<ApiResponse | ErrorResponse> {
  const queryParams = event.queryStringParameters || {};
  const operation = queryParams[EventParameters.OPERATION];
  const databaseName = queryParams[EventParameters.DATABASENAME];

  const config = readConfig();
  const secretArn = config;

  if (!(await checkEvent(event))) {
    console.error('Event is invalid');
    return {
      statusCode: 400,
      body: JSON.stringify({message: 'Event is invalid'}),
    };
  }

  console.log(`Operation is ${operation}`);

  try {
    const secret = await getSecret(config.secretArn);

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
          try {
            await pg.connect();

            try {
              await pg.revokeAdminPrivilegesSystemContext(databaseName);
            } catch (error) {
              if (
                error instanceof Error &&
                error.message.includes('does not exist')
              ) {
                console.error(
                  `Error calling revokeAdminPrivilegesSystemContext: this is ok. ${error}`
                );
              } else {
                console.error(
                  `Error calling revokeAdminPrivilegesSystemContext: ${error}`
                );
              }
            }
            try {
              await pg.revokeAdminPrivilegesDatabaseContext(databaseName);
            } catch (error) {
              if (
                error instanceof Error &&
                error.message.includes('does not exist')
              ) {
                console.error(
                  `Error calling revokeAdminPrivilegesDatabaseContext: this is ok. ${error}`
                );
              } else {
                console.error(
                  `Error calling revokeAdminPrivilegesDatabaseContext: ${error}`
                );
              }
            }

            try {
              await pg.dropDatabase(databaseName);
            } catch (error) {
              if (
                error instanceof Error &&
                error.message.includes('does not exist')
              ) {
                console.error(
                  `Error calling dropDatabase for ${databaseName}: this is ok. ${error}`
                );
              } else {
                console.error(`Error calling dropDatabase: ${error}`);
              }
            }

            try {
              await pg.dropUser(databaseName);
            } catch (error) {
              if (
                error instanceof Error &&
                error.message.includes('does not exist')
              ) {
                console.error(`Error calling dropUser: this is ok. ${error}`);
              } else {
                console.error(
                  `Error calling revokeAdminPrivilegesDatabaseContext: ${error}`
                );
              }
            }

            await pg.end();

            try {
              console.log(`yo, not yet deleting secret ${secretArn}`);
              // await deleteDatabaseSecret(secretArn);
            } catch (error) {
              if (
                error instanceof Error &&
                error.message.includes('does not exist')
              ) {
                console.error(
                  `Error calling deleteDatabaseSecret for ${databaseName}: this is ok. ${error}`
                );
              } else {
                console.error(`Error calling deleteDatabaseSecret: ${error}`);
              }
            }

            return {
              statusCode: 200,
              body: JSON.stringify({message: `Database dropped successfully.`}),
            };
          } catch (error) {
            const err = error as Error;
            console.error('Error dropping database', err.message);
            await pg.end();
            return {
              statusCode: 500,
              body: JSON.stringify({
                message: `Error dropping database: ${err.message}`,
              }),
            };
          }
        case 'createDatabase':
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

            // Connect to the new database and grant admin privileges within the database context
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
            const err = error as Error;
            console.error('Error creating database', err);
            await pg.end();
            return {
              statusCode: 500,
              body: JSON.stringify({
                message: `Error creating database: ${err.message}`,
              }),
            };
          }
        case 'SELECT':
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
            const err = error as Error;
            console.error('Error selecting data', err);
            await pg.end();
            return {
              statusCode: 500,
              body: JSON.stringify({
                message: `Error selecting data: ${err.message}`,
              }),
            };
          }
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
    const err = error as Error;
    console.error('Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({message: `Internal Server Error: ${err.message}`}),
    };
  }
}
