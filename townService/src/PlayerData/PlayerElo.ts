import { Schema, Document, Model, model } from 'mongoose';
import { EloRating } from '../types/CoveyTownSocket';

/**
 * A document to represent a playerElo document stored in a MongoDB database
 */
export interface IPlayerEloDocument extends EloRating, Document {}

/**
 * A mongoose schema to represent a playerElo object
 */
const playerEloSchema = new Schema({
  playerId: String,
  username: {
    type: String,
    default: 'Anonymous',
  },
  rating: {
    type: Number,
    default: 1000,
  },
  numPlayed: {
    type: Number,
    default: 0,
  },
});
export default playerEloSchema;
export const playerEloModel = model<IPlayerEloDocument>('elo', playerEloSchema);

/**
 * Gets the playerElo object from the MongoDB database for the given player. If the player does not exist,
 * then create a new playerElo object in the MongoDB database using the default values above and return that.
 * @param playerId the player's id that we want to get the elo rating for
 */
export async function findPlayerElo(playerId: string): Promise<IPlayerEloDocument> {
  const record = await playerEloModel.findOne({ playerId });
  if (record) {
    return record;
  }
  return playerEloModel.create({ playerId });
}

/**
 * Gets all playerElo objects for players who have played at least one game.
 */
export async function findAllPlayerElos(): Promise<IPlayerEloDocument[]> {
  const records = await playerEloModel.find({ numPlayed: { $gt: 0 } });
  return records;
}

/**
 * Updates the playerElo object in the MongoDB database for the given player using the specified values.
 * If the player does not exist, then create a new playerElo object in the MongoDB database using the specified values.
 * @param playerId the player's id that we want to get the elo rating for
 * @param username the player's username
 * @param newRating the player's new rating
 * @param newNumPlayed the player's new number of played games
 */
export async function updatePlayerElo(
  playerId: string,
  username: string,
  newRating: number,
  newNumPlayed: number,
): Promise<void> {
  const playerElo = (await findPlayerElo(playerId)) as IPlayerEloDocument;
  playerElo.rating = newRating;
  playerElo.numPlayed = newNumPlayed;
  playerElo.username = username;
  await playerEloModel.updateOne({ playerId }, { $set: playerElo });
}

/**
 * Deletes the playerElo object in the MongoDB database for the given player.
 * If the player does not exist, then nothing happens.
 * @param playerId the player's id that we want to delete the elo rating for
 */
export async function deletePlayerElo(playerId: string): Promise<void> {
  await playerEloModel.deleteMany({ playerId });
}
