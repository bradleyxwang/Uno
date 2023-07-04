import { Schema, Document, Model, model } from 'mongoose';
import { MatchHistory } from '../types/CoveyTownSocket';

/**
 * A document to represent a matchHistory document stored in a MongoDB database
 */
export interface IMatchHistoryDocument extends MatchHistory, Document {}

/**
 * A mongoose schema to represent a matchHistory object
 */
const matchHistorySchema = new Schema({
  players: [],
  playingOrder: [String],
  startTime: Number,
  endTime: Number,
  cardsDrawnDuringGame: [],
  initialHands: [],
  startingTopCardDiscardPile: Object,
  events: [],
});
export default matchHistorySchema;
export const matchHistoryModel = model<IMatchHistoryDocument>('matchHistory', matchHistorySchema);

/**
 * Gets the matchHistory object from the MongoDB database for the given player.
 * @param playerId the player's id that we want to get the match history for
 */
export async function findPlayerMatchHistory(playerId: string): Promise<IMatchHistoryDocument[]> {
  const records = await matchHistoryModel.find({ playingOrder: playerId });
  return records;
}

/**
 * Adds a new matchHistory object to the MongoDB database.
 * @param playerId the player's id that we want to get the match history for
 */
export async function addNewMatch(matchHistory: MatchHistory): Promise<void> {
  await matchHistoryModel.create(matchHistory);
}
