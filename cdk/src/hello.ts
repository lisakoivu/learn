import {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log('request:', JSON.stringify(event, undefined, 2));

  // Extract payload
  const body = JSON.parse(event.body || '{}');
  console.log('Parsed body:', body);

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'MEOWWWWWWW',
      input: body,
    }),
  };
}
