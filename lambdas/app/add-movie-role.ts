import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { actorKey, ddb, movieKey, type Role, tableName } from "../shared/db";
import { isResponse, parseJsonObject, response } from "../shared/http";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
const body = parseJsonObject(event);
if (isResponse(body)) return body;

// checks required text fields, following the Cognito example
const fields = ["roleName", "roleDescription"];
const missing = fields.filter(
  (f) => typeof body[f] !== "string" || body[f] === ""
);

if (missing.length) {
  return response(400, {
    message: `Missing or invalid fields: ${missing.join(", ")}`,
  });
}

// check that both ids are positive whole numbers
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
        // check that the movire record exists before adding a rple
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
    console.error("DynamoDB error:", err);
    return response(500, {
      message: "Internal server error",
      error: err,
    });
  }
};
