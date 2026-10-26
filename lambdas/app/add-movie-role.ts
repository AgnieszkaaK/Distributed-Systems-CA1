import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { actorKey, ddb, movieKey, type Role, tableName } from "../shared/db";
import { isResponse, parseJsonObject, response } from "../shared/http";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";
import type { TransactionCanceledException } from "@aws-sdk/client-dynamodb";

const ajv = new Ajv();

// create the validation function once so requests can reuse it
const isValidRolePayload = ajv.compile<Role>(schema);


export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // read the JSON body from the request
const body = parseJsonObject(event);

// if parsing returned an error response, send it back now
if (isResponse(body)) return body;

// check the required fields and their types against the Role schema
if (!isValidRolePayload(body)) {
  return response(400, {
    message: "Incorrect type. Must match the Role schema",
    schema,
  });
}

// extra check: the schema allows strings to be empty
const fields: (keyof Role)[] = ["roleName", "roleDescription"];
const missing = fields.filter((f) => body[f] === "");// find any empty fields

// tell the client which fields were empty
if (missing.length) {
  return response(400, {
    message: `Missing or invalid fields: ${missing.join(", ")}`,
  });
}

// reject decimals, numbers too large to store exactly, and ids below 1
if (
  !Number.isSafeInteger(body.movieId) ||
  body.movieId <= 0 ||
  !Number.isSafeInteger(body.actorId) ||
  body.actorId <= 0
) {
  return response(400, {
    message: "movieId and actorId must be positive integers",
  });
}

// build the role using the validated fields
const role: Role = {
  movieId: body.movieId,
  actorId: body.actorId,
  roleName: body.roleName,
  roleDescription: body.roleDescription,
};
  try {
//runs the checks and save, if check fails, role wont be saved
await ddb.send(
  new TransactWriteCommand({
    TransactItems: [
      {
      // make sure the movie exists before saving the role
        ConditionCheck: {
          TableName: tableName,
          Key: {
            PK: movieKey(role.movieId), // movie id
            SK: movieKey(role.movieId), // movies have the same id in both keys
          },
          ConditionExpression: "attribute_exists(PK)", // check the record exists
        },
      },
      {
        // make sure the actor exists too
        ConditionCheck: {
          TableName: tableName,
          Key: {
            PK: actorKey(role.actorId),
            SK: actorKey(role.actorId), //actor records use the actor key for both
          },
          ConditionExpression: "attribute_exists(PK)",
        },
      },
      {
           // save the role once both checks pass
          Put: {
          TableName: tableName,
          Item: {
            // link the movie and actor using their keys
            PK: movieKey(role.movieId),
            SK: actorKey(role.actorId),
            // Stores the role details from the validated request
            movieId: role.movieId,
            actorId: role.actorId,
            roleName: role.roleName,
            roleDescription: role.roleDescription,
          },
        },
      },
    ],
  })
);
    // return the saved role details without the database keys
    return response(201, { message: "Role added", data: role });
    } catch (err) {
    // check the error name using the pattern from the Cognito example
    const name = (err as Error).name;

    if (name === "TransactionCanceledException") {
      // get the reason for each operation in the transaction
      const reasons = (err as TransactionCanceledException).CancellationReasons;

      // position 0 matches the movie check above
      if (reasons?.[0]?.Code === "ConditionalCheckFailed") {
        return response(400, {
          message: `Movie ${role.movieId} not found`,
        });
      }

      // position 1 matches the actor check above
      if (reasons?.[1]?.Code === "ConditionalCheckFailed") {
        return response(400, {
          message: `Actor ${role.actorId} not found`,
        });
      }
    }
    // log unexpected errors in CloudWatch without sending the details back
    console.error("Unexpected DynamoDB error:", err);
    return response(500, {
      message: "Internal server error",
    });
  }
};