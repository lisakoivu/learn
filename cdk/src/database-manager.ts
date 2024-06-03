import {getSecret, checkSecretKeys, checkEvent} from './secrets-helper';
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
        case 'createDatabase':
          try {
            const result = await pg.createDatabase(databaseName);
            return {
              statusCode: 200,
              body: JSON.stringify({message: `Database created: ${result}`}),
            };
          } catch (error) {
            const err = error as Error; // Type assertion
            console.error('Error creating database', err);
            return {
              statusCode: 500,
              body: JSON.stringify({
                message: `Error creating database: ${err.message}`,
              }),
            };
          }
        case 'SELECT':
          try {
            const result = await pg.selectDate();
            console.log(`Result is ${result}`);
            return {
              statusCode: 200,
              body: JSON.stringify({message: result}),
            };
          } catch (error) {
            const err = error as Error; // Type assertion
            console.error('Error selecting data', err);
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
            body: JSON.stringify({message: 'Operation not supported'}),
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
    const err = error as Error; // Type assertion
    console.error('Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({message: `Internal Server Error: ${err.message}`}),
    };
  }
}
