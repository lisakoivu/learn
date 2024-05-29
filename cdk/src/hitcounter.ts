import {DynamoDBClient, UpdateItemCommand} from '@aws-sdk/client-dynamodb';
import {InvokeCommand, LambdaClient} from '@aws-sdk/client-lambda';
import {IEvent} from './enums';

export async function handler(event: IEvent) {
  console.log('request:', JSON.stringify(event, undefined, 2));

  const tableName = process.env.HITS_TABLE_NAME;
  const functionName = process.env.DOWNSTREAM_FUNCTION_NAME;

  if (!tableName || !functionName) {
    throw new Error(
      'Environment variables HITS_TABLE_NAME or DOWNSTREAM_FUNCTION_NAME are not set'
    );
  }

  // const dynamo = new DynamoDBClient({});
  const lambda = new LambdaClient({});
  const dynamo = new DynamoDBClient({});

  // write record to DynamoDB
  try {
    // update dynamo entry for "path" with hits++
    const input = {
      TableName: tableName,
      Key: {path: {S: event.path}},
      UpdateExpression: 'ADD hits :incr',
      ExpressionAttributeValues: {':incr': {N: '1'}},
    };
    const response = await dynamo.send(new UpdateItemCommand(input));

    console.log(
      'response from dynamodb:',
      JSON.stringify(response, undefined, 2)
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error updating DynamoDB table: ${error.stack}`);
      throw new Error(`Error updating DynamoDB table: ${error.stack}`);
    } else {
      console.error('Unknown error:', error);
      throw new Error('Unknown error occurred');
    }
  }

  console.log('JSON stringify', JSON.stringify(event.path));
  // Fire the target lambda
  try {
    const response = await lambda.send(
      new InvokeCommand({
        FunctionName: functionName,
        Payload: Buffer.from(JSON.stringify(event)),
      })
    );

    console.log('downstream response:', JSON.stringify(response, undefined, 2));

    // Check if resp.Payload is a Buffer and convert it to string if necessary
    let payload: string;
    if (response.Payload) {
      payload = Buffer.from(response.Payload).toString('utf-8');
    } else {
      throw new Error(
        `Payload is undefined or not in expected format ${response.Payload}`
      );
    }

    // return response back to upstream caller
    return JSON.parse(payload);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error invoking downstream function: ${error.stack}`);
      throw new Error(`Error invoking downstream function: ${error.stack}`);
    } else {
      console.error('Unknown error:', error);
      throw new Error('Unknown error occurred');
    }
  }
}
