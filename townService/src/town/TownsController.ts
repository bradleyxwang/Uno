import assert from 'assert';
import {
  Body,
  Controller,
  Delete,
  Example,
  Get,
  Header,
  Patch,
  Path,
  Post,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from 'tsoa';

import { Town, TownCreateParams, TownCreateResponse } from '../api/Model';
import InvalidParametersError from '../lib/InvalidParametersError';
import CoveyTownsStore from '../lib/TownsStore';
import {
  ConversationArea,
  CoveyTownSocket,
  TownSettingsUpdate,
  ViewingArea,
  PosterSessionArea,
  PlayableMove,
  CardGameArea,
  MatchHistory,
  GoogleDetails,
} from '../types/CoveyTownSocket';
import PosterSessionAreaReal from './PosterSessionArea';
import CardGameAreaReal from './CardGameArea';
import { isPosterSessionArea, isCardGameArea } from '../TestUtils';
import Player from '../lib/Player';

/**
 * This is the town route
 */
@Route('towns')
@Tags('towns')
// TSOA (which we use to generate the REST API from this file) does not support default exports, so the controller can't be a default export.
// eslint-disable-next-line import/prefer-default-export
export class TownsController extends Controller {
  private _townsStore: CoveyTownsStore = CoveyTownsStore.getInstance();

  /**
   * List all towns that are set to be publicly available
   *
   * @returns list of towns
   */
  @Get()
  public async listTowns(): Promise<Town[]> {
    return this._townsStore.getTowns();
  }

  /**
   * Create a new town
   *
   * @param request The public-facing information for the new town
   * @example request {"friendlyName": "My testing town public name", "isPubliclyListed": true}
   * @returns The ID of the newly created town, and a secret password that will be needed to update or delete this town.
   */
  @Example<TownCreateResponse>({ townID: 'stringID', townUpdatePassword: 'secretPassword' })
  @Post()
  public async createTown(@Body() request: TownCreateParams): Promise<TownCreateResponse> {
    const { townID, townUpdatePassword } = await this._townsStore.createTown(
      request.friendlyName,
      request.isPubliclyListed,
      request.mapFile,
    );
    return {
      townID,
      townUpdatePassword,
    };
  }

  /**
   * Updates an existing town's settings by ID
   *
   * @param townID  town to update
   * @param townUpdatePassword  town update password, must match the password returned by createTown
   * @param requestBody The updated settings
   */
  @Patch('{townID}')
  @Response<InvalidParametersError>(400, 'Invalid password or update values specified')
  public async updateTown(
    @Path() townID: string,
    @Header('X-CoveyTown-Password') townUpdatePassword: string,
    @Body() requestBody: TownSettingsUpdate,
  ): Promise<void> {
    const success = this._townsStore.updateTown(
      townID,
      townUpdatePassword,
      requestBody.friendlyName,
      requestBody.isPubliclyListed,
    );
    if (!success) {
      throw new InvalidParametersError('Invalid password or update values specified');
    }
  }

  /**
   * Deletes a town
   * @param townID ID of the town to delete
   * @param townUpdatePassword town update password, must match the password returned by createTown
   */
  @Delete('{townID}')
  @Response<InvalidParametersError>(400, 'Invalid password or update values specified')
  public async deleteTown(
    @Path() townID: string,
    @Header('X-CoveyTown-Password') townUpdatePassword: string,
  ): Promise<void> {
    const success = this._townsStore.deleteTown(townID, townUpdatePassword);
    if (!success) {
      throw new InvalidParametersError('Invalid password or update values specified');
    }
  }

  /**
   * Creates a conversation area in a given town
   * @param townID ID of the town in which to create the new conversation area
   * @param sessionToken session token of the player making the request, must match the session token returned when the player joined the town
   * @param requestBody The new conversation area to create
   */
  @Post('{townID}/conversationArea')
  @Response<InvalidParametersError>(400, 'Invalid values specified')
  public async createConversationArea(
    @Path() townID: string,
    @Header('X-Session-Token') sessionToken: string,
    @Body() requestBody: ConversationArea,
  ): Promise<void> {
    const town = this._townsStore.getTownByID(townID);
    if (!town?.getPlayerBySessionToken(sessionToken)) {
      throw new InvalidParametersError('Invalid values specified');
    }
    const success = town.addConversationArea(requestBody);
    if (!success) {
      throw new InvalidParametersError('Invalid values specified');
    }
  }

  /**
   * Creates a viewing area in a given town
   *
   * @param townID ID of the town in which to create the new viewing area
   * @param sessionToken session token of the player making the request, must
   *        match the session token returned when the player joined the town
   * @param requestBody The new viewing area to create
   *
   * @throws InvalidParametersError if the session token is not valid, or if the
   *          viewing area could not be created
   */
  @Post('{townID}/viewingArea')
  @Response<InvalidParametersError>(400, 'Invalid values specified')
  public async createViewingArea(
    @Path() townID: string,
    @Header('X-Session-Token') sessionToken: string,
    @Body() requestBody: ViewingArea,
  ): Promise<void> {
    const town = this._townsStore.getTownByID(townID);
    if (!town) {
      throw new InvalidParametersError('Invalid values specified');
    }
    if (!town?.getPlayerBySessionToken(sessionToken)) {
      throw new InvalidParametersError('Invalid values specified');
    }
    const success = town.addViewingArea(requestBody);
    if (!success) {
      throw new InvalidParametersError('Invalid values specified');
    }
  }

  /**
   * Creates a poster session area in a given town
   *
   * @param townID ID of the town in which to create the new poster session area
   * @param sessionToken session token of the player making the request, must
   *        match the session token returned when the player joined the town
   * @param requestBody The new poster session area to create
   *
   * @throws InvalidParametersError if the session token is not valid, or if the
   *          poster session area could not be created
   */
  @Post('{townID}/posterSessionArea')
  @Response<InvalidParametersError>(400, 'Invalid values specified')
  public async createPosterSessionArea(
    @Path() townID: string,
    @Header('X-Session-Token') sessionToken: string,
    @Body() requestBody: PosterSessionArea,
  ): Promise<void> {
    // download file here TODO
    const curTown = this._townsStore.getTownByID(townID);
    if (!curTown) {
      throw new InvalidParametersError('Invalid town ID');
    }
    if (!curTown.getPlayerBySessionToken(sessionToken)) {
      throw new InvalidParametersError('Invalid session ID');
    }
    // add viewing area to the town, throw error if it fails
    if (!curTown.addPosterSessionArea(requestBody)) {
      throw new InvalidParametersError('Invalid poster session area');
    }
  }

  /**
   * Creates a card game area in a given town
   *
   * @param townID ID of the town in which to create the new card game area
   * @param sessionToken session token of the player making the request, must
   *        match the session token returned when the player joined the town
   * @param requestBody The new card game area to create
   *
   * @throws InvalidParametersError if the session token is not valid, or if the
   *          card game area could not be created
   */
  @Post('{townID}/cardGameArea')
  @Response<InvalidParametersError>(400, 'Invalid values specified')
  public async createCardGameArea(
    @Path() townID: string,
    @Header('X-Session-Token') sessionToken: string,
    @Body() requestBody: CardGameArea,
  ): Promise<void> {
    const curTown = this._townsStore.getTownByID(townID);
    if (!curTown) {
      throw new InvalidParametersError('Invalid town ID');
    }
    if (!curTown.getPlayerBySessionToken(sessionToken)) {
      throw new InvalidParametersError('Invalid session ID');
    }
    // add viewing area to the town, throw error if it fails
    if (!curTown.addCardGameArea(requestBody)) {
      throw new InvalidParametersError('Invalid card game area');
    }
  }

  /**
   * Gets the image contents of a given poster session area in a given town
   *
   * @param townID ID of the town in which to get the poster session area image contents
   * @param posterSessionId interactable ID of the poster session
   * @param sessionToken session token of the player making the request, must
   *        match the session token returned when the player joined the town
   *
   * @throws InvalidParametersError if the session token is not valid, or if the
   *          poster session specified does not exist
   */
  @Patch('{townID}/{posterSessionId}/imageContents')
  @Response<InvalidParametersError>(400, 'Invalid values specified')
  public async getPosterAreaImageContents(
    @Path() townID: string,
    @Path() posterSessionId: string,
    @Header('X-Session-Token') sessionToken: string,
  ): Promise<string | undefined> {
    const curTown = this._townsStore.getTownByID(townID);
    if (!curTown) {
      throw new InvalidParametersError('Invalid town ID');
    }
    if (!curTown.getPlayerBySessionToken(sessionToken)) {
      throw new InvalidParametersError('Invalid session ID');
    }
    const posterSessionArea = curTown.getInteractable(posterSessionId);
    if (!posterSessionArea || !isPosterSessionArea(posterSessionArea)) {
      throw new InvalidParametersError('Invalid poster session ID');
    }
    return posterSessionArea.imageContents;
  }

  /**
   * Increment the stars of a given poster session area in a given town, as long as there is
   * a poster image. Returns the new number of stars.
   *
   * @param townID ID of the town in which to get the poster session area image contents
   * @param posterSessionId interactable ID of the poster session
   * @param sessionToken session token of the player making the request, must
   *        match the session token returned when the player joined the town
   *
   * @throws InvalidParametersError if the session token is not valid, or if the
   *          poster session specified does not exist, or if the poster session specified
   *          does not have an image
   */
  @Patch('{townID}/{posterSessionId}/incStars')
  @Response<InvalidParametersError>(400, 'Invalid values specified')
  public async incrementPosterAreaStars(
    @Path() townID: string,
    @Path() posterSessionId: string,
    @Header('X-Session-Token') sessionToken: string,
  ): Promise<number> {
    const curTown = this._townsStore.getTownByID(townID);
    if (!curTown) {
      throw new InvalidParametersError('Invalid town ID');
    }
    if (!curTown.getPlayerBySessionToken(sessionToken)) {
      throw new InvalidParametersError('Invalid session ID');
    }
    const posterSessionArea = curTown.getInteractable(posterSessionId);
    if (!posterSessionArea || !isPosterSessionArea(posterSessionArea)) {
      throw new InvalidParametersError('Invalid poster session ID');
    }
    if (!posterSessionArea.imageContents) {
      throw new InvalidParametersError('Cant star a poster with no image');
    }
    const newStars = posterSessionArea.stars + 1;
    const updatedPosterSessionArea = {
      id: posterSessionArea.id,
      imageContents: posterSessionArea.imageContents,
      title: posterSessionArea.title,
      stars: newStars, // increment stars
    };
    (<PosterSessionAreaReal>posterSessionArea).updateModel(updatedPosterSessionArea);
    return newStars;
  }

  /**
   * Finds the player corresponding to the given session ID and
   * the card game area corresponding to the given card game area ID.
   *
   * @param townID ID of the town
   * @param cardGameAreaId interactable ID of the card game area
   * @param sessionToken session token of the player making the request, must
   *        match the session token returned when the player joined the town
   *
   * @throws InvalidParametersError if the session token is not valid, or if the
   *         card game area specified does not exist
   *
   * @returns Tuple containing the card game area and the current player.
   */
  public validateCardGameAreaRequest(
    townID: string,
    cardGameAreaId: string,
    sessionToken: string,
  ): [CardGameAreaReal, Player] {
    const curTown = this._townsStore.getTownByID(townID);
    if (!curTown) {
      throw new InvalidParametersError('Invalid town ID');
    }
    const curPlayer = curTown.getPlayerBySessionToken(sessionToken);
    if (!curPlayer) {
      throw new InvalidParametersError('Invalid session ID');
    }
    const cardGameArea = curTown.getInteractable(cardGameAreaId);
    if (!cardGameArea || !isCardGameArea(cardGameArea)) {
      throw new InvalidParametersError('Invalid card game area ID');
    }
    return [cardGameArea as CardGameAreaReal, curPlayer];
  }

  /**
   * Creates a card game in the specified card game area.
   *
   * @param townID ID of the town
   * @param cardGameAreaId interactable ID of the card game area
   * @param sessionToken session token of the player making the request, must
   *        match the session token returned when the player joined the town
   *
   * @throws InvalidParametersError if the session token is not valid, or if the
   *         card game area specified does not exist
   *
   * @returns ID of newly created game.
   */
  @Patch('{townID}/{cardGameAreaId}/createCardGame')
  @Response<InvalidParametersError>(400, 'Invalid values specified')
  public async createCardGame(
    @Path() townID: string,
    @Path() cardGameAreaId: string,
    @Header('X-Session-Token') sessionToken: string,
  ): Promise<string> {
    const [cardGameArea, player] = this.validateCardGameAreaRequest(
      townID,
      cardGameAreaId,
      sessionToken,
    );
    return cardGameArea.createCardGame(player);
  }

  /**
   * Adds the player to a given non-started card game.
   *
   * @param townID ID of the town
   * @param cardGameAreaId interactable ID of the card game area
   * @param cardGameId ID of the non-started card game
   * @param sessionToken session token of the player making the request, must
   *        match the session token returned when the player joined the town
   *
   * @throws InvalidParametersError if the session token is not valid, or if the
   *         card game area specified does not exist
   */
  @Patch('{townID}/{cardGameAreaId}/{cardGameId}/joinCardGame')
  @Response<InvalidParametersError>(400, 'Invalid values specified')
  public async joinCardGame(
    @Path() townID: string,
    @Path() cardGameAreaId: string,
    @Path() cardGameId: string,
    @Header('X-Session-Token') sessionToken: string,
  ): Promise<void> {
    const [cardGameArea, player] = this.validateCardGameAreaRequest(
      townID,
      cardGameAreaId,
      sessionToken,
    );
    try {
      cardGameArea.joinCardGame(cardGameId, player);
    } catch (e) {
      if (e instanceof Error) {
        throw new InvalidParametersError(e.message);
      } else {
        throw e;
      }
    }
  }

  /**
   * Adds the player as a spectator to a given ongoing card game.
   *
   * @param townID ID of the town
   * @param cardGameAreaId interactable ID of the card game area
   * @param cardGameId ID of the ongoing card game
   * @param sessionToken session token of the player making the request, must
   *        match the session token returned when the player joined the town
   *
   * @throws InvalidParametersError if the session token is not valid, or if the
   *         card game area specified does not exist
   */
  @Patch('{townID}/{cardGameAreaId}/{cardGameId}/spectateCardGame')
  @Response<InvalidParametersError>(400, 'Invalid values specified')
  public async spectateCardGame(
    @Path() townID: string,
    @Path() cardGameAreaId: string,
    @Path() cardGameId: string,
    @Header('X-Session-Token') sessionToken: string,
  ): Promise<void> {
    const [cardGameArea, player] = this.validateCardGameAreaRequest(
      townID,
      cardGameAreaId,
      sessionToken,
    );
    try {
      cardGameArea.spectateCardGame(cardGameId, player);
    } catch (e) {
      if (e instanceof Error) {
        throw new InvalidParametersError(e.message);
      } else {
        throw e;
      }
    }
  }

  /**
   * Removes the given player as a spectator from the given ongoing game.
   *
   * @param townID ID of the town
   * @param cardGameAreaId interactable ID of the card game area
   * @param cardGameId ID of the ongoing card game
   * @param sessionToken session token of the player making the request, must
   *        match the session token returned when the player joined the town
   *
   * @throws InvalidParametersError if the session token is not valid, or if the
   *         card game area specified does not exist
   */
  @Patch('{townID}/{cardGameAreaId}/{cardGameId}/stopSpectatingCardGame')
  @Response<InvalidParametersError>(400, 'Invalid values specified')
  public async stopSpectatingCardGame(
    @Path() townID: string,
    @Path() cardGameAreaId: string,
    @Path() cardGameId: string,
    @Header('X-Session-Token') sessionToken: string,
  ): Promise<void> {
    const [cardGameArea, player] = this.validateCardGameAreaRequest(
      townID,
      cardGameAreaId,
      sessionToken,
    );
    try {
      cardGameArea.stopSpectatingCardGame(cardGameId, player);
    } catch (e) {
      if (e instanceof Error) {
        throw new InvalidParametersError(e.message);
      } else {
        throw e;
      }
    }
  }

  /**
   * Removes the player from the given non-started card game.
   *
   * @param townID ID of the town
   * @param cardGameAreaId interactable ID of the card game area
   * @param cardGameId ID of the non-started card game
   * @param sessionToken session token of the player making the request, must
   *        match the session token returned when the player joined the town
   *
   * @throws InvalidParametersError if the session token is not valid, or if the
   *         card game area specified does not exist
   */
  @Patch('{townID}/{cardGameAreaId}/{cardGameId}/leaveNonStartedCardGame')
  @Response<InvalidParametersError>(400, 'Invalid values specified')
  public async leaveNonStartedCardGame(
    @Path() townID: string,
    @Path() cardGameAreaId: string,
    @Path() cardGameId: string,
    @Header('X-Session-Token') sessionToken: string,
  ): Promise<void> {
    const [cardGameArea, player] = this.validateCardGameAreaRequest(
      townID,
      cardGameAreaId,
      sessionToken,
    );
    try {
      cardGameArea.leaveNonStartedCardGame(cardGameId, player);
    } catch (e) {
      if (e instanceof Error) {
        throw new InvalidParametersError(e.message);
      } else {
        throw e;
      }
    }
  }

  /**
   * Starts the given non-started card game.
   *
   * @param townID ID of the town
   * @param cardGameAreaId interactable ID of the card game area
   * @param cardGameId ID of the non-started card game
   * @param sessionToken session token of the player making the request, must
   *        match the session token returned when the player joined the town
   * @param requestBody Body containing string representing the color of all cards in the deck,
   *                    or undefined if the deck should contain cards of all colors.
   *
   * @throws InvalidParametersError if the session token is not valid, or if the
   *         card game area specified does not exist
   */
  @Patch('{townID}/{cardGameAreaId}/{cardGameId}/startCardGame')
  @Response<InvalidParametersError>(400, 'Invalid values specified')
  public async startCardGame(
    @Path() townID: string,
    @Path() cardGameAreaId: string,
    @Path() cardGameId: string,
    @Header('X-Session-Token') sessionToken: string,
    @Body() requestBody: { color?: string },
  ): Promise<void> {
    const [cardGameArea] = this.validateCardGameAreaRequest(townID, cardGameAreaId, sessionToken);
    try {
      cardGameArea.startCardGame(cardGameId, requestBody.color);
    } catch (e) {
      if (e instanceof Error) {
        throw new InvalidParametersError(e.message);
      } else {
        throw e;
      }
    }
  }

  /**
   * Removes the player from the given ongoing card game.
   *
   * @param townID ID of the town
   * @param cardGameAreaId interactable ID of the card game area
   * @param cardGameId ID of the ongoing card game
   * @param sessionToken session token of the player making the request, must
   *        match the session token returned when the player joined the town
   *
   * @throws InvalidParametersError if the session token is not valid, or if the
   *         card game area specified does not exist
   */
  @Patch('{townID}/{cardGameAreaId}/{cardGameId}/quitOngoingCardGame')
  @Response<InvalidParametersError>(400, 'Invalid values specified')
  public async quitOngoingCardGame(
    @Path() townID: string,
    @Path() cardGameAreaId: string,
    @Path() cardGameId: string,
    @Header('X-Session-Token') sessionToken: string,
  ): Promise<void> {
    const [cardGameArea, player] = this.validateCardGameAreaRequest(
      townID,
      cardGameAreaId,
      sessionToken,
    );
    try {
      cardGameArea.quitOngoingCardGame(cardGameId, player);
    } catch (e) {
      if (e instanceof Error) {
        throw new InvalidParametersError(e.message);
      } else {
        throw e;
      }
    }
  }

  /**
   * Plays a move in the given card game.
   *
   * @param townID ID of the town
   * @param cardGameAreaId interactable ID of the card game area
   * @param cardGameId ID of the non-started card game
   * @param sessionToken session token of the player making the request, must
   *        match the session token returned when the player joined the town
   * @param requestBody Body containing move to play
   *
   * @throws InvalidParametersError if the session token is not valid, or if the
   *         card game area specified does not exist
   */
  @Patch('{townID}/{cardGameAreaId}/{cardGameId}/playMove')
  @Response<InvalidParametersError>(400, 'Invalid values specified')
  public async cardGamePlayMove(
    @Path() townID: string,
    @Path() cardGameAreaId: string,
    @Path() cardGameId: string,
    @Header('X-Session-Token') sessionToken: string,
    @Body() requestBody: PlayableMove,
  ): Promise<void> {
    const [cardGameArea, player] = this.validateCardGameAreaRequest(
      townID,
      cardGameAreaId,
      sessionToken,
    );
    try {
      cardGameArea.playMove(cardGameId, player, requestBody);
    } catch (e) {
      if (e instanceof Error) {
        throw new InvalidParametersError(e.message);
      } else {
        throw e;
      }
    }
  }

  /**
   * Skips the current player's move in the given card game.
   *
   * @param townID ID of the town
   * @param cardGameAreaId interactable ID of the card game area
   * @param cardGameId ID of the non-started card game
   * @param sessionToken session token of the player making the request, must
   *        match the session token returned when the player joined the town
   *
   * @throws InvalidParametersError if the session token is not valid, or if the
   *         card game area specified does not exist
   */
  @Patch('{townID}/{cardGameAreaId}/{cardGameId}/skipMove')
  @Response<InvalidParametersError>(400, 'Invalid values specified')
  public async cardGameSkipMove(
    @Path() townID: string,
    @Path() cardGameAreaId: string,
    @Path() cardGameId: string,
    @Header('X-Session-Token') sessionToken: string,
  ): Promise<void> {
    const [cardGameArea] = this.validateCardGameAreaRequest(townID, cardGameAreaId, sessionToken);
    try {
      cardGameArea.skipMove(cardGameId);
    } catch (e) {
      if (e instanceof Error) {
        throw new InvalidParametersError(e.message);
      } else {
        throw e;
      }
    }
  }

  /**
   * Connects a client's socket to the requested town, or disconnects the socket if no such town exists
   *
   * @param socket A new socket connection, with the userName and townID parameters of the socket's
   * auth object configured with the desired townID to join and username to use
   *
   */
  public async joinTown(socket: CoveyTownSocket) {
    // Parse the client's requested username from the connection
    const { userName, townID } = socket.handshake.auth as { userName: string; townID: string };

    const town = this._townsStore.getTownByID(townID);
    if (!town) {
      socket.disconnect(true);
      return;
    }

    // Connect the client to the socket.io broadcast room for this town
    socket.join(town.townID);

    const newPlayer = await town.addPlayer(userName, socket);
    assert(newPlayer.videoToken);
    socket.emit('initialize', {
      userID: newPlayer.id,
      sessionToken: newPlayer.sessionToken,
      providerVideoToken: newPlayer.videoToken,
      currentPlayers: town.players.map(eachPlayer => eachPlayer.toPlayerModel()),
      friendlyName: town.friendlyName,
      isPubliclyListed: town.isPubliclyListed,
      interactables: town.interactables.map(eachInteractable => eachInteractable.toModel()),
    });
  }
}
