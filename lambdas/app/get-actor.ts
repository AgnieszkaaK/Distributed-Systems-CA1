import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  actorKey,
  ddb,
  parseId,
  tableName,
  toActor,
  movieKey,
  isRoleItem
} from "../shared/db";
import { response } from "../shared/http";
import { logRequest } from "../shared/request-logger";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // log the username and requested path
  logRequest(event);

// get the actor id from the URL and check it's valid
  const actorId = parseId(event.pathParameters?.actorID);
  if (actorId === undefined) {
    return response(400, { message: "actorID must be a positive integer" });
  }

// movie is optional, but must be a valid id if given
  const movieParam = event.queryStringParameters?.movie; // get the optional movie id from the query
  const movieId = parseId(movieParam);// turn it into a number if it's valid
  
  // a movie id was given, but it wasn't valid
  if (movieParam !== undefined && movieId === undefined) {
    return response(400, { message: "movie must be a positive integer" });
  }
  try {
    const actorResult = await ddb.send( // find the actor's profile using their key
      new GetCommand({
        TableName: tableName,
        // actor records use the actor key for both
        Key: { PK: actorKey(actorId), SK: actorKey(actorId) },
      })
    );
    // stop here if the actor doesn't exist
    if (!actorResult.Item) {
      return response(404, { message: `Actor ${actorId} not found` });
    }

    // get the profile details without the database keys
    const actor = toActor(actorResult.Item);

    // if a movie was given, look for this actors role in it.
if (movieId !== undefined) {
  const roleResult = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: movieKey(movieId), SK: actorKey(actorId) },
    })
  );

  // if the role exists, include its description with the actor's profile.
  if (roleResult.Item && isRoleItem(roleResult.Item)) {
    return response(200, {
        data: {
          actorId: actor.actorId,
          name: actor.name,
          dateOfBirth: actor.dateOfBirth,
          bio: actor.bio,
          roleDescription: roleResult.Item.roleDescription,
  },
});
  }
}
// return the profile if no movie was given or no matching role was found
    return response(200, { data: actor });
  } catch (err) {
    console.error("DynamoDB error:", err); //keep full error in cloudwatch
    return response(500, { message: "Internal server error" });  
  }
};
