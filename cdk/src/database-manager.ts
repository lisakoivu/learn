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
      error: 'InvalidEvent',
    };
  }

  let result = null;

  console.log('Meow!');
  try {
    const secret = await getSecret(secretArn);

    if (secret === null) {
      console.error(`Secret not found in Secrets Manager: ${secretArn}`);
      return {
        statusCode: 404,
        body: JSON.stringify({message: `Secret not found: ${secretArn}`}),
        error: 'SecretNotFound',
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
        error: 'MalformedSecret',
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
          result = await pg.createDatabase(databaseName);
          break;
        case 'SELECT':
          result = await pg.selectDate();
          console.log(`Result is ${result}`);
          break;
        default:
          console.error('Operation not supported');
          return {
            statusCode: 400,
            body: JSON.stringify({message: 'Operation not supported'}),
            error: 'UnsupportedOperation',
          };
      }
    } else {
      console.error('Unsupported engine');
      return {
        statusCode: 400,
        body: JSON.stringify({message: 'Unsupported engine'}),
        error: 'UnsupportedEngine',
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({message: result}),
    };
  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({message: 'Internal Server Error', error: 'KABOOM'}),
      error: 'InternalError',
    };
  }
}
