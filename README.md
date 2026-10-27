## My implementation

Implemented the movie cast API using the provided starter code, labs and Cognito example.

Features include:
- GET movie roles and actor profiles, with optional filters.
- POST new roles with validation and error handling.
- Cognito signup, signin and signout.
- API-key protection for POST requests.
- CloudWatch logging of usernames and request paths.

## Running the project

Install dependencies with `npm ci`, then run `npm run build`.

Deploy:
`cdk deploy --all --profile cad-assignment`

Remove the app stacks:
`cdk destroy --all --profile cad-assignment`

Replace `cad-assignment` with your own AWS profile name.

## Testing

Manually tested successful requests, invalid inputs, authentication, API-key protection, signout cookie removal and CloudWatch logs.