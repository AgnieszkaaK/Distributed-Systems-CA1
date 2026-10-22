import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  actorKey,
  ddb,
  isRoleItem,
  movieKey,
  parseId,
  tableName,
  toRole,
} from "../shared/db";
import { response } from "../shared/http";
import { logRequest } from "../shared/request-logger";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  logRequest(event);

  const movieId = parseId(event.pathParameters?.movieID);
  if (movieId === undefined) {
    return response(400, { message: "movieID must be a positive integer" });
  }

  // actor is optional, so it checks if it's missing or just an invalid id
  const actorParam = event.queryStringParameters?.actor;
  const actorId = parseId(actorParam);

if (actorParam !== undefined && actorId === undefined) { // the actor id was entered, but not valid
  return response(400, { message: "actor must be a positive integer" });
}


try {
  // start by looking for all roles in the movie
  let keyCondition = "PK = :pk";
  const keyValues: Record<string, string> = { // gives :pk the movie key
    ":pk": movieKey(movieId),
  };

  // if an actor id is given, match that key aswell
  if (actorId !== undefined) {
    keyCondition = "PK = :pk AND SK = :sk"; //matches the movie and the actor
    keyValues[":sk"] = actorKey(actorId); //set sk: to the actors key
  }



    const queryResult = await ddb.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: keyCondition, //updated because originally query only looked for movie
        ExpressionAttributeValues: keyValues, //supplies the keys that are needed for the search
        // ExclusiveStartKey: lastKey,
})
    );

    const resultItems = queryResult.Items ?? [];
    return response(200, { data: resultItems.filter(isRoleItem).map(toRole) });
  } catch (err) {
    console.error("DynamoDB error:", err);
    return response(500, {
      message: "Internal server error",
      error: err,
    });
  }
};
