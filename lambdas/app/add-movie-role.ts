import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { actorKey, ddb, movieKey, type Role, tableName } from "../shared/db";
import { isResponse, parseJsonObject, response } from "../shared/http";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";
import type { TransactionCanceledException } from "@aws-sdk/client-dynamodb";

const ajv = new Ajv();

// checks that the request matches the Role schema
const isValidRolePayload = ajv.compile<Role>(schema);


export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
const body = parseJsonObject(event);
if (isResponse(body)) return body;
if (!isValidRolePayload(body)) {
  return response(400, {
    message: "Incorrect type. Must match the Role schema",
    schema,
  });
}

// extra check: the schema allows strings to be empty
const fields: (keyof Role)[] = ["roleName", "roleDescription"];
const missing = fields.filter((f) => body[f] === "");

if (missing.length) {
  return response(400, {
    message: `Missing or invalid fields: ${missing.join(", ")}`,
  });
}

// extra check: ids must be positive whole numbers
if (
  !Number.isSafeInteger(body.movieId) ||
  (body.movieId as number) <= 0 ||
  !Number.isSafeInteger(body.actorId) ||
  (body.actorId as number) <= 0
) {
  return response(400, {
    message: "movieId and actorId must be positive integers",
  });
}

const role: Role = {
  movieId: body.movieId as number,
  actorId: body.actorId as number,
  roleName: body.roleName as string,
  roleDescription: body.roleDescription as string,
};
  try {
await ddb.send( //runs the checks and save, if check fails, role wont be saved
  new TransactWriteCommand({
    TransactItems: [
      {
      // make sure the actor exists before saving their role
        ConditionCheck: {
          TableName: tableName,
          Key: {
            PK: movieKey(role.movieId), // movie id
            SK: movieKey(role.movieId), // movies have the same id in both keys
          },
          ConditionExpression: "attribute_exists(PK)",
        },
      },
      {
        // Check that the actor exists
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
            //a role is links a movie to an actor using the keys
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
    return response(201, { message: "Role added", data: role });
    } catch (err) {
    // get the error name, like the Cognito example
    const name = (err as Error).name;

    if (name === "TransactionCanceledException") {
      const reasons = (err as TransactionCanceledException).CancellationReasons;

      // the movie check is first in our transaction
      if (reasons?.[0]?.Code === "ConditionalCheckFailed") {
        return response(400, {
          message: `Movie ${role.movieId} not found`,
        });
      }

      // the actor check is second in our transaction
      if (reasons?.[1]?.Code === "ConditionalCheckFailed") {
        return response(400, {
          message: `Actor ${role.actorId} not found`,
        });
      }
    }

    console.error("Unexpected DynamoDB error:", err);
    return response(500, {
      message: "Internal server error",
    });
  }
};