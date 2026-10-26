import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// build a JSON response to send back to the client
export const response = (
  statusCode: number,
  body: object,
  headers: Record<string, string> = {},
): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});

// check if a helper returned a response instead of request data
export const isResponse = (value: object): value is APIGatewayProxyResult => 'statusCode' in value;

// Parses a JSON object request body, or returns a 400 response.
export const parseJsonObject = (
  event: APIGatewayProxyEvent,
): Record<string, unknown> | APIGatewayProxyResult => {
  let body: unknown;
  try {
    // read the JSON, using an empty object if there's no body
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return response(400, { message: 'Request body must be valid JSON' });
  }
  // reject arrays, null and values that aren't objects
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return response(400, { message: 'Request body must be a JSON object' });
  }
  return body as Record<string, unknown>;
};
