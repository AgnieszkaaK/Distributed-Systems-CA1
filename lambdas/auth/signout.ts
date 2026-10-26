import type { APIGatewayProxyResult } from 'aws-lambda';
import { response } from '../shared/auth-utils';

// Clears the client's token cookie
// A copied token can still pass our authorizer until it expires
export const handler = async (): Promise<APIGatewayProxyResult> =>
  response(
    200,
    { message: 'Signed out' },
    { 'set-cookie': 'token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None' },
  );
