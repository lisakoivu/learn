import {
  getSecret,
  checkSecretKeys,
  checkEvent,
  createDatabaseSecret,
  getRandomString,
} from './secrets-helper';
import {DatabaseClient as PgDatabaseClient} from './postgres-helper';
import {EventParameters} from './enums';
import {ApiResponse, ErrorResponse} from './types';

export async function handler(
  event: any
): Promise<ApiResponse | ErrorResponse> {
  const queryParams = event.queryStringParameters || {};
  const secretArn = queryParams[EventParameters.SECRETARN];
  const operation = queryParams[EventParameters.OPERATION];
  const databaseName = queryParams[EventParameters.DATABASENAME];

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
          try {
            await pg.connect();
            await pg.dropDatabase(databaseName);
            await pg.end();
            return {
              statusCode: 200,
              body: JSON.stringify({message: `Database dropped successfully.`}),
            };
          } catch (error) {
            const err = error as Error;
            console.error('Error dropping database', err);
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
            await pg.grantAdminPrivileges(databaseName);
            const userPassword = await getRandomString(10);
            await createDatabaseSecret(
              databaseName,
              databaseName,
              secret.endpoint,
              secret.port,
              userPassword
            );
            await pg.changePassword(databaseName, userPassword);
            await pg.end();

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
