import { Body, Controller, Delete, Get, Path, Post, Put, Route, Tags } from 'tsoa';
import { EloRating, MatchHistory } from '../types/CoveyTownSocket';
import { addNewMatch } from './MatchHistory';
import {
  deletePlayerElo,
  findAllPlayerElos,
  findPlayerElo,
  IPlayerEloDocument,
  updatePlayerElo,
} from './PlayerElo';

/**
 * This is the player data route
 */
@Route('playerData')
@Tags('playerData')
// TSOA (which we use to generate the REST API from this file) does not support default exports, so the controller can't be a default export.
// eslint-disable-next-line import/prefer-default-export
export class PlayerDataController extends Controller {
  /**
   * Gets the elo rating of a player. If the player does not have an elo rating, then automatically create a new rating for the player
   * with 1000 rating and 0 games played as the default values.
   * @param playerId the player's id that we want to get the elo rating for
   */
  @Get('{playerId}/eloRating')
  public async getPlayerCardGameEloRating(@Path() playerId: string): Promise<EloRating> {
    const { username, rating, numPlayed } = (await findPlayerElo(playerId)) as IPlayerEloDocument;
    return { playerId, username, rating, numPlayed };
  }

  /**
   * Gets all the player card game elo ratings for players who have played at least one game.
   */
  @Get('eloRating')
  public async getAllCardGameEloRatings(): Promise<EloRating[]> {
    const records = (await findAllPlayerElos()) as IPlayerEloDocument[];
    const eloRatings = [] as EloRating[];
    for (let i = 0; i < records.length; i++) {
      const { playerId, username, rating, numPlayed } = records[i];
      eloRatings.push({ playerId, username, rating, numPlayed });
    }
    return eloRatings;
  }

  /**
   * Updates the elo rating of a player. If the player does not have an elo rating, then automatically create a new rating for the player
   * with the specified parameters as the values for the rating.
   * @param playerId the player's id that we want to get the elo rating for
   * @param newRating the new elo rating for the player
   * @param newNumPlayed the new number of games played for the player
   *
   */
  @Put('{playerId}/eloRating')
  public async updatePlayerCardGameEloRating(
    @Path() playerId: string,
    @Body() requestBody: EloRating,
  ): Promise<void> {
    await updatePlayerElo(
      playerId,
      requestBody.username,
      requestBody.rating,
      requestBody.numPlayed,
    );
  }

  /**
   * Deletes the elo rating of a player. If the player does not have an elo rating, then nothing happens.
   * @param playerId the player's id that we want to delete the elo rating for
   */
  @Delete('{playerId}/eloRating')
  public async deletePlayerCardGameEloRating(@Path() playerId: string): Promise<void> {
    deletePlayerElo(playerId);
  }

  /**
   * Adds a newly finished match to the match history database
   * @param requestBody a MatchHistory object representing the new match to add to the database
   */
  @Post('/matchHistory')
  public async addNewMatch(@Body() requestBody: MatchHistory): Promise<void> {
    addNewMatch(requestBody);
  }
}
