import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { actorKey, ddb, movieKey, type Role, tableName } from "../shared/db";
import { isResponse, parseJsonObject, response } from "../shared/http";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
const body = parseJsonObject(event);
if (isResponse(body)) return body;

// Checks required text fields, following the Cognito example.
const fields = ["roleName", "roleDescription"];
const missing = fields.filter(
  (f) => typeof body[f] !== "string" || body[f] === ""
);

if (missing.length) {
  return response(400, {
    message: `Missing or invalid fields: ${missing.join(", ")}`,
  });
}

// Check that both IDs are positive whole numbers.
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
    //  TOD∏O - Add role if its IDs are valid
    return response(201, { message: "Role added", data: role });
  } catch (err) {
    console.error("DynamoDB error:", err);
    return response(500, {
      message: "Internal server error",
      error: err,
    });
  }
};
