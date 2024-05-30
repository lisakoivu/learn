import {getSecret, checkSecretKeys, checkEvent} from './secrets-helper';
import {DatabaseClient as PgDatabaseClient} from './postgres-helper';
import {EventParameters, IEvent} from './enums';

export async function handler(event: IEvent): Promise<string | null> {
  console.log(`Event is ${JSON.stringify(event)}`);

  if (!(await checkEvent(event))) {
    console.error('Event is invalid');
    return 'error';
  }

  try {
    const secretArn = event[EventParameters.SECRETARN]; // Use enum value to access property
    const secret = await getSecret(secretArn);

    if (secret === null) {
      console.error(`Secret not found in Secrets Manager: ${secretArn}`);
      return 'error';
    }

    if (!(await checkSecretKeys(secret))) {
      console.error(
        'Secret malformed, keys are missing. Required keys are username, password, endpoint, engine, and port.'
      );
      return 'error';
    }

    let result = null;
    if (secret.engine === 'postgres') {
      const pg = new PgDatabaseClient({
        user: secret.username,
        host: secret.endpoint,
        // database: event[EventParameters.DATABASENAME], // Use enum value to access property
        database: 'postgres',
        password: secret.password,
        port: secret.port,
        ssl: {rejectUnauthorized: false},
      });

      switch (
        event[EventParameters.OPERATION] // Use enum value to access property
      ) {
        case 'createDatabase':
          result = await pg.createDatabase(event[EventParameters.DATABASENAME]);
          break;
        case 'SELECT':
          result = await pg.selectDate();
          console.log(`Result is ${result}`);
          break;
        default:
          console.error('Operation not supported');
          return 'error';
      }
      return result;
    }
    return null;
  } catch (err) {
    console.error('Error:', err);
    throw err;
  }
}
