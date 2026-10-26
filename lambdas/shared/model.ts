// Table keys, item types and mappers. No AWS clients, so the CDK app can import it too.
// Single-table keys:
//   Movie: m#movieID | m#movieID
//   Actor: a#actorID | a#actorID
//   Role:  m#movieID | a#actorID

// turn a movie id into its database key, e.g. 1234 becomes m#1234
export const movieKey = (movieId: number) => `m#${movieId}`;
// turn an actor id into its database key, e.g. 4321 becomes a#4321
export const actorKey = (actorId: number) => `a#${actorId}`;

// fields that make up a movie
export interface Movie {
  movieId: number;
  title: string;
  releaseDate: string;
  overview: string;
}

// fields that make up an actor's profile
export interface Actor {
  actorId: number;
  name: string;
  dateOfBirth: string;
  bio: string;
}

// fields linking an actor to their role in a movie
export interface Role {
  movieId: number;
  actorId: number;
  roleName: string;
  roleDescription: string;
}

// movie records have a sort key starting with m#
export const isMovieItem = (item: Record<string, unknown>) =>
  typeof item.SK === 'string' && item.SK.startsWith('m#');

// role records have a movie partition key and an actor sort key
export const isRoleItem = (item: Record<string, unknown>) =>
  typeof item.PK === 'string' && item.PK.startsWith('m#') &&
  typeof item.SK === 'string' && item.SK.startsWith('a#');

// pick out the role details without returning the database keys
export const toRole = ({ movieId, actorId, roleName, roleDescription }: Record<string, any>): Role => ({
  movieId,
  actorId,
  roleName,
  roleDescription,
});

// pick out the actor's profile without returning the database keys
export const toActor = ({ actorId, name, dateOfBirth, bio }: Record<string, any>): Actor => ({
  actorId,
  name,
  dateOfBirth,
  bio,
});

// Parses a path or query string ID; undefined if it isn't a positive integer.
export const parseId = (value: string | undefined): number | undefined =>
  value !== undefined && /^[1-9]\d*$/.test(value) ? Number(value) : undefined;
