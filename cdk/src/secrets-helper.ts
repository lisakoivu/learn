import {
  CreateSecretCommand,
  DeleteSecretCommand,
  GetSecretValueCommand,
  GetSecretValueCommandOutput,
  ListSecretsCommand,
  ListSecretsCommandInput,
  ListSecretsCommandOutput,
  SecretListEntry,
  SecretsManagerClient,
  TagResourceCommand,
} from '@aws-sdk/client-secrets-manager';
import {EventParameters, IEvent, SecretKeys} from './enums';
import {error} from 'aws-cdk/lib/logging';

const currentRegion = process.env.AWS_REGION;
const client = new SecretsManagerClient({region: currentRegion});

export interface SecretDetails {
  readonly username: string;
  readonly password: string;
  readonly endpoint: string;
  readonly port: number;
  readonly engine: string;
}

export async function getSecret(
  secretArn: string
): Promise<SecretDetails | null> {
  console.log(`starting getSecret: secretArn is ${secretArn}`);
  try {
    const command = new GetSecretValueCommand({SecretId: secretArn});
    const response: GetSecretValueCommandOutput = await client.send(command);
    if (response.SecretString) {
      return JSON.parse(response.SecretString) as SecretDetails;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching secret value. Exiting. ${error}`);
    throw error;
  }
}

export async function checkSecretKeys(secret: SecretDetails): Promise<boolean> {
  console.log(
    `starting checkSecretKeys: keys are ${JSON.stringify(SecretKeys)}`
  );
  if (!secret) return false;

  const keys = Object.values(SecretKeys);
  for (const key of keys) {
    if (!(key in secret)) {
      console.error(`Key ${key} is missing from secret`);
      return false;
    }
  }
  return true;
}

export async function checkEvent(event: IEvent): Promise<boolean> {
  console.log(`starting checkEvent: event is ${JSON.stringify(event)}`);
  const queryParams = event.queryStringParameters || {};
  if (!queryParams.operation) {
    console.error('Parameter operation is required in the event');
    return false;
  }
  if (!queryParams.databaseName) {
    console.error('Database name is required in the event');
    return false;
  }
  return true;
}

export async function getRandomString(length: number): Promise<string> {
  let result = '';
  const characters =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < length; i++) {
    const randomInd = Math.floor(Math.random() * characters.length);
    result += characters.charAt(randomInd);
  }
  return result;
}

export async function createDatabaseSecret(
  databaseName: string,
  userName: string,
  endpoint: string,
  port: number,
  password: string
): Promise<string | null> {
  console.log(
    `starting createDatabaseSecret: creating secret for ${databaseName}`
  );
  try {
    const secret = {
      username: userName,
      password: password,
      endpoint: endpoint,
      port: port,
      engine: 'postgres',
    };
    const secretNameSuffix = await getRandomString(5);
    const dbName = endpoint.split('.')[0];
    const secretName = `database/${dbName}/${userName}-${secretNameSuffix}`;
    console.log(`Creating secret with name: ${secretName}`);
    const command = new CreateSecretCommand({
      Name: secretName,
      SecretString: JSON.stringify(secret),
    });
    const response = await client.send(command);
    const secretArn = response.ARN;

    if (!secretArn) {
      console.error(`Failed to create secret. No ARN returned.`);
      return null;
    }

    console.log(`Secret created with ARN: ${secretArn}`);

    const tagInput = {
      SecretId: secretArn,
      Tags: [
        {
          Key: 'database-manager-database-name',
          Value: databaseName,
        },
      ],
    };

    const tagCommand = new TagResourceCommand(tagInput);
    await client.send(tagCommand);

    return secretArn;
  } catch (error) {
    console.error(`Error creating secret. Exiting. ${error}`);
    return null;
  }
}

export async function findSecretByTagValue(
  tagKey: string,
  tagValue: string
): Promise<SecretListEntry[]> {
  try {
    const listSecretsCommandInput: ListSecretsCommandInput = {
      Filters: [
        {
          Key: 'tag-key', // This must be a valid FilterNameStringType
          Values: [tagKey],
        },
        {
          Key: 'tag-value', // This must be a valid FilterNameStringType
          Values: [tagValue],
        },
      ],
    };

    const command = new ListSecretsCommand(listSecretsCommandInput);
    const response: ListSecretsCommandOutput = await client.send(command);

    if (response.SecretList) {
      for (const secret of response.SecretList) {
        console.log(
          `findSecretByTagValue: Found secret with ARN: ${secret.ARN}`
        );
      }
      return response.SecretList;
    } else {
      console.log('No secrets found');
      return [];
    }
  } catch (error) {
    console.error('Error fetching secrets:', error);
    throw error;
  }
}

export async function deleteDatabaseSecret(
  secretArn: SecretListEntry
): Promise<boolean> {
  try {
    const command = new DeleteSecretCommand({SecretId: secretArn.ARN});
    await client.send(command);
  } catch (error) {
    console.error(
      `Error deleting database secret ${secretArn}. Exiting. ${error}`
    );
    return false;
  }
  return true;
}
