import {
  GetSecretValueCommand,
  GetSecretValueCommandOutput,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import {EventParameters, IEvent, SecretKeys} from './enums';

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
    // Create the command
    const command = new GetSecretValueCommand({
      SecretId: secretArn,
    });

    // Send the request and get the response
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

export async function checkSecretKeys(
  secret: SecretDetails
  // keys: string[]
): Promise<boolean> {
  console.log(`starting checkSecretKeys: keys are ${SecretKeys}`);
  try {
    if (secret === null) {
      return false;
    }
    for (const key of Object.values(SecretKeys)) {
      if (!(key in secret)) {
        console.error(`Key ${key} is missing from secret`);
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error(`Error fetching secret value. Exiting. ${error}`);
    return false;
  }
}

export async function checkEvent(event: IEvent): Promise<boolean> {
  console.log(`starting checkEvent: event is ${JSON.stringify(event)}`);
  try {
    if (!event.secretArn) {
      console.error('Secret ARN is required in the event');
      return false;
    }
    if (!event.operation) {
      console.error('Operation is required in the event');
      return false;
    }
    if (!event.databaseName) {
      console.error('Database name is required in the event');
      return false;
    }
    return true;
  } catch (error) {
    console.error(`Error checking event. Exiting. ${error}`);
    return false;
  }
}
