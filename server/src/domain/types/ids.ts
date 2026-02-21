export type userId = number & { __brand: "userId" };
export type gameId = string & { __brand: "gameId" };
export type playerId = number & { __brand: "playerId" };

export const asUserId = (id: number): userId => id as userId;
export const asGameId = (id: string): gameId => id as gameId;
export const asPlayerId = (id: number): playerId => id as playerId;
