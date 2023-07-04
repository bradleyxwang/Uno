import assert from 'assert';
import EventEmitter from 'events';
import _ from 'lodash';
import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import TypedEmitter from 'typed-emitter';
import Interactable from '../components/Town/Interactable';
import ViewingArea from '../components/Town/interactables/ViewingArea';
import PosterSesssionArea from '../components/Town/interactables/PosterSessionArea';
import CardGameArea from '../components/Town/interactables/CardGameArea';
import { LoginController } from '../contexts/LoginControllerContext';
import {
  TownsService,
  TownsServiceClient,
  CardGameArea as CardGameAreaGenerated,
  PlayerDataService,
} from '../generated/client';
import useTownController from '../hooks/useTownController';
import {
  ChatMessage,
  CoveyTownSocket,
  PlayerLocation,
  TownSettingsUpdate,
  ViewingArea as ViewingAreaModel,
  PosterSessionArea as PosterSessionAreaModel,
  CardGameArea as CardGameAreaModel,
  PlayableMove,
  EloRating,
  GoogleDetails,
  MatchHistory,
} from '../types/CoveyTownSocket';
import {
  isConversationArea,
  isViewingArea,
  isPosterSessionArea,
  isCardGameArea,
} from '../types/TypeUtils';
import ConversationAreaController from './ConversationAreaController';
import PlayerController from './PlayerController';
import ViewingAreaController from './ViewingAreaController';
import PosterSessionAreaController from './PosterSessionAreaController';
import CardGameAreaController from './CardGameAreaController';

const CALCULATE_NEARBY_PLAYERS_DELAY = 300;

export type ConnectionProperties = {
  userName: string;
  townID: string;
  loginController: LoginController;
};

/**
 * The TownController emits these events. Components may subscribe to these events
 * by calling the `addListener` method on a TownController
 */
export type TownEvents = {
  /**
   * An event that indicates that the TownController is now connected to the townService
   * @param providerVideoToken a secret token that can be used to connect to the video service
   */
  connect: (providerVideoToken: string) => void;
  /**
   * An event that indicates that the TownController has been disconnected from the townService
   */
  disconnect: () => void;
  /**
   * An event that indicates that the town settings have been updated. This event is dispatched
   * before updating the properties of this TownController; clients may find the new settings in the parameter
   */
  townSettingsUpdated: (newTownSettings: TownSettingsUpdate) => void;
  /**
   * An event that indicates that the set of players in the town has changed. This event is dispatched
   * before updating the proeprties of this TownController; clients will find the new players in the parameter
   */
  playersChanged: (newPlayers: PlayerController[]) => void;
  /**
   * An event that indicates that a player has moved. This event is dispatched after updating the player's location -
   * the new location can be found on the PlayerController.
   */
  playerMoved: (movedPlayer: PlayerController) => void;
  /**
   * An event that indicates that a player's login status has changed.
   * This event is dispatched after updating the player's login status -
   * the new login status can be found on the PlayerController.
   */
  playerLoginChanged: (changedPlayer: PlayerController) => void;
  /**
   * An event that indicates that the set of conversation areas has changed. This event is dispatched
   * when a conversation area is created, or when the set of active conversations has changed. This event is dispatched
   * after updating the town controller's record of conversation areas.
   */
  conversationAreasChanged: (currentConversationAreas: ConversationAreaController[]) => void;
  /**
   * An event that indicates that the set of viewing areas has changed. This event is emitted after updating
   * the town controller's record of viewing areas.
   */
  viewingAreasChanged: (newViewingAreas: ViewingAreaController[]) => void;
  /**
   * An event that indicates that the set of poster session areas has changed. This event is emitted after updating
   * the town controller's record of poster session areas.
   */
  posterSessionAreasChanged: (newPosterSessionAreas: PosterSessionAreaController[]) => void;
  /**
   * An event that indicates that the set of card game areas has changed. This event is emitted after updating
   * the town controller's record of card game areas.
   */
  cardGameAreasChanged: (newCardGameAreas: CardGameAreaController[]) => void;
  /**
   * An event that indicates that a new chat message has been received, which is the parameter passed to the listener
   */
  chatMessage: (message: ChatMessage) => void;
  /**
   * An event that indicates that a new match history has been received for a specific player
   */
  matchHistory: (googleEmail: string, matchHistory: MatchHistory[]) => void;
  /**
   * An event that indicates that the 2D game is now paused. Pausing the game should, if nothing else,
   * release all key listeners, so that text entry is possible
   */
  pause: () => void;
  /**
   * An event that indicates that the 2D game should now be unpaused (resumed).
   */
  unPause: () => void;
  /**
   * An event that indicates that the player is now interacting with a different interactable
   * @param typeName the type of interactable
   * @param obj the interactable that is being interacted with
   */
  interact: <T extends Interactable>(typeName: T['name'], obj: T) => void;
};

/**
 * The (frontend) TownController manages the communication between the frontend
 * and the backend. When a player join a town, a new TownController is created,
 * and frontend components can register to receive events (@see CoveyTownEvents).
 *
 * To access the TownController from a React component, use the
 * useTownController hook (@see useTownController). While the town controller
 * can be directly used by React components, it is generally preferable to use the various hooks
 * defined in this file (e.g. @see usePlayers, @see useConversationAreas), which will automatically
 * subscribe to updates to their respective data, triggering the React component that consumes them
 * to re-render when the underlying data changes.
 *
 */
export default class TownController extends (EventEmitter as new () => TypedEmitter<TownEvents>) {
  /** The socket connection to the townsService. Messages emitted here
   * are received by the TownController in that service.
   */
  private _socket: CoveyTownSocket;

  /**
   * The REST API client to access the townsService
   */
  private _townsService: TownsService;

  /**
   * The REST API client to access the playerDataService
   */
  private _playerDataService: PlayerDataService;

  /**
   * The login controller is used by the frontend application to manage logging in to a town,
   * and is also used to log out of a town.
   */
  private _loginController: LoginController;

  /**
   * The current list of players in the town. Adding or removing players might replace the array
   * with a new one; clients should take note not to retain stale references.
   */
  private _playersInternal: PlayerController[] = [];

  /**
   * The current list of conversation areas in the twon. Adding or removing conversation areas might
   * replace the array with a new one; clients should take note not to retain stale references.
   */
  private _conversationAreasInternal: ConversationAreaController[] = [];

  /**
   * The friendly name of the current town, set only once this TownController is connected to the townsService
   */
  private _friendlyNameInternal?: string;

  /**
   * The town ID of the current town, generated by the backend townsService and used to uniquely identify this town with the
   * server and other players
   */
  private readonly _townID: string;

  /**
   * If true, then this town's friendlyName and townID are included in the public listing of active towns.
   * Changes to this variable do not influence the behavior of the server, it must be changed through the townsService API client
   */
  private _townIsPubliclyListedInternal = false;

  /**
   * The username of the player whose browser created this TownController
   */
  private readonly _userName: string;

  /**
   * The user ID of the player whose browser created this TownController. The user ID is set by the backend townsService, and
   * is only available after the service is connected.
   */
  private _userID?: string;

  /**
   * A reference to the Player object that represents the player whose browser created this TownController.
   */
  private _ourPlayer?: PlayerController;

  /**
   * A secret token that is provided by the townsService when we connect, and is needed
   * for authenticating future API calls as being from the same user who created this TownController.
   */
  private _sessionToken?: string;

  /**
   * A secret token that is provided by the townsService when we connect, and can be used to connect
   * to a third-party video conferecing service.
   */
  private _providerVideoToken?: string;

  /**
   * A flag indicating whether the current 2D game is paused, or not. Pausing the game will prevent it from updating,
   * and will also release any key bindings, allowing all keys to be used for text entry or other purposes.
   */
  private _paused = false;

  /**
   * An event emitter that broadcasts interactable-specific events
   */
  private _interactableEmitter = new EventEmitter();

  private _viewingAreas: ViewingAreaController[] = [];

  private _posterSessionAreas: PosterSessionAreaController[] = [];

  private _cardGameAreas: CardGameAreaController[] = [];

  public constructor({ userName, townID, loginController }: ConnectionProperties) {
    super();
    this._townID = townID;
    this._userName = userName;
    this._loginController = loginController;

    /*
        The event emitter will show a warning if more than this number of listeners are registered, as it
        may indicate a leak (listeners that should de-register not de-registering). The default is 10; we expect
        more than 10 listeners because each conversation area might be its own listener, and there are more than 10
        */
    this.setMaxListeners(30);

    const url = process.env.REACT_APP_TOWNS_SERVICE_URL;
    assert(url);
    this._socket = io(url, { auth: { userName, townID } });
    this._townsService = new TownsServiceClient({ BASE: url }).towns;
    this._playerDataService = new TownsServiceClient({ BASE: url }).playerData;
    this.registerSocketListeners();
  }

  public get sessionToken() {
    return this._sessionToken || '';
  }

  public get userID() {
    const id = this._userID;
    assert(id);
    return id;
  }

  public get townIsPubliclyListed() {
    return this._townIsPubliclyListedInternal;
  }

  private set _townIsPubliclyListed(newSetting: boolean) {
    this._townIsPubliclyListedInternal = newSetting;
    this.emit('townSettingsUpdated', { isPubliclyListed: newSetting });
  }

  public get providerVideoToken() {
    const token = this._providerVideoToken;
    assert(token);
    return token;
  }

  public get userName() {
    return this._userName;
  }

  public get friendlyName() {
    const friendlyName = this._friendlyNameInternal;
    assert(friendlyName);
    return friendlyName;
  }

  private set _friendlyName(newFriendlyName: string) {
    this._friendlyNameInternal = newFriendlyName;
    this.emit('townSettingsUpdated', { friendlyName: newFriendlyName });
  }

  public get paused() {
    return this._paused;
  }

  public get ourPlayer() {
    const ret = this._ourPlayer;
    assert(ret);
    return ret;
  }

  public get townID() {
    return this._townID;
  }

  public pause(): void {
    if (!this._paused) {
      this._paused = true;
      this.emit('pause');
    }
  }

  public unPause(): void {
    if (this._paused) {
      this._paused = false;
      this.emit('unPause');
    }
  }

  public get players(): PlayerController[] {
    return this._playersInternal;
  }

  private set _players(newPlayers: PlayerController[]) {
    this.emit('playersChanged', newPlayers);
    this._playersInternal = newPlayers;
  }

  public get conversationAreas() {
    return this._conversationAreasInternal;
  }

  private set _conversationAreas(newConversationAreas: ConversationAreaController[]) {
    this._conversationAreasInternal = newConversationAreas;
    this.emit('conversationAreasChanged', newConversationAreas);
  }

  public get interactableEmitter() {
    return this._interactableEmitter;
  }

  public get viewingAreas() {
    return this._viewingAreas;
  }

  public set viewingAreas(newViewingAreas: ViewingAreaController[]) {
    this._viewingAreas = newViewingAreas;
    this.emit('viewingAreasChanged', newViewingAreas);
  }

  public get posterSessionAreas() {
    return this._posterSessionAreas;
  }

  public set posterSessionAreas(newPosterSessionAreas: PosterSessionAreaController[]) {
    this._posterSessionAreas = newPosterSessionAreas;
    this.emit('posterSessionAreasChanged', newPosterSessionAreas);
  }

  public get cardGameAreas() {
    return this._cardGameAreas;
  }

  public set cardGameAreas(newCardGameAreas: CardGameAreaController[]) {
    this._cardGameAreas = newCardGameAreas;
    this.emit('cardGameAreasChanged', newCardGameAreas);
  }

  /**
   * Begin interacting with an interactable object. Emits an event to all listeners.
   * @param interactedObj
   */
  public interact<T extends Interactable>(interactedObj: T) {
    this._interactableEmitter.emit(interactedObj.getType(), interactedObj);
  }

  /**
   * End interacting with an interactable object. Emits an event to all listeners.
   * @param objectNoLongerInteracting
   */
  public interactEnd(objectNoLongerInteracting: Interactable) {
    this._interactableEmitter.emit('endInteraction', objectNoLongerInteracting);
  }

  /**
   * Registers listeners for the events that can come from the server to our socket
   */
  registerSocketListeners() {
    /**
     * On chat messages, forward the messages to listeners who subscribe to the controller's events
     */
    this._socket.on('chatMessage', message => {
      this.emit('chatMessage', message);
    });
    /**
     * On match histories, forward the histories to listeners who subscribe to the controller's events
     */
    this._socket.on('matchHistory', ([googleEmail, matchHistory]) => {
      this.emit('matchHistory', googleEmail, matchHistory);
    });
    /**
     * On changes to town settings, update the local state and emit a townSettingsUpdated event to
     * the controller's event listeners
     */
    this._socket.on('townSettingsUpdated', update => {
      const newFriendlyName = update.friendlyName;
      if (newFriendlyName !== undefined) {
        this._friendlyName = newFriendlyName;
      }
      if (update.isPubliclyListed !== undefined) {
        this._townIsPubliclyListed = update.isPubliclyListed;
      }
    });
    /**
     * On town closing events, emit a disconnect message to the controller's event listeners, and
     * return to the login screen
     */
    this._socket.on('townClosing', () => {
      this.emit('disconnect');
      this._loginController.setTownController(null);
    });
    /**
     * When a new player joins the town, update our local state of players in the town and notify
     * the controller's event listeners that the player has moved to their starting location.
     *
     * Note that setting the players array will also emit an event that the players in the town have changed.
     */
    this._socket.on('playerJoined', newPlayer => {
      const newPlayerObj = PlayerController.fromPlayerModel(newPlayer);
      this._players = this.players.concat([newPlayerObj]);
      this.emit('playerMoved', newPlayerObj);
    });
    /**
     * When a player disconnects from the town, update local state
     *
     * Note that setting the players array will also emit an event that the players in the town have changed.
     */
    this._socket.on('playerDisconnect', disconnectedPlayer => {
      this._players = this.players.filter(eachPlayer => eachPlayer.id !== disconnectedPlayer.id);
    });
    /**
     * When a player moves, update local state and emit an event to the controller's event listeners
     */
    this._socket.on('playerMoved', movedPlayer => {
      const playerToUpdate = this.players.find(eachPlayer => eachPlayer.id === movedPlayer.id);
      if (playerToUpdate) {
        if (playerToUpdate === this._ourPlayer) {
          /*
           * If we are told that WE moved, we shouldn't update our x,y because it's probably lagging behind
           * real time. However: we SHOULD update our interactable ID, because its value is managed by the server
           */
          playerToUpdate.location.interactableID = movedPlayer.location.interactableID;
        } else {
          playerToUpdate.location = movedPlayer.location;
        }
        this.emit('playerMoved', playerToUpdate);
      } else {
        //TODO: It should not be possible to receive a playerMoved event for a player that is not already in the players array, right?
        const newPlayer = PlayerController.fromPlayerModel(movedPlayer);
        this._players = this.players.concat(newPlayer);
        this.emit('playerMoved', newPlayer);
      }
    });

    /**
     * When a player changes login status, update local state and emit an event to the controller's event listeners
     */
    this._socket.on('playerLoginChanged', changedPlayer => {
      const playerToUpdate = this.players.find(eachPlayer => eachPlayer.id === changedPlayer.id);
      if (playerToUpdate) {
        /*
         * If we are told that OUR login status changed, we shouldn't update our login status
         * because it's probably lagging behind real time.
         */
        if (playerToUpdate !== this._ourPlayer) {
          playerToUpdate.googleEmail = changedPlayer.googleEmail;
          playerToUpdate.googleAccountName = changedPlayer.googleAccountName;
        }
        this.emit('playerLoginChanged', playerToUpdate);
      } else {
        //TODO: It should not be possible to receive a playerLoginChanged event for a player that is not already in the players array, right?
        const newPlayer = PlayerController.fromPlayerModel(changedPlayer);
        this._players = this.players.concat(newPlayer);
        this.emit('playerLoginChanged', newPlayer);
      }
    });

    /**
     * When an interactable's state changes, push that update into the relevant controller, which is assumed
     * to be either a Viewing Area, a Poster Session Area, or a Conversation Area, and which is assumed to already
     * be represented by a ViewingAreaController, PosterSessionAreaController or ConversationAreaController that this TownController has.
     *
     * If a conversation area transitions from empty to occupied (or occupied to empty), this handler will emit
     * a conversationAreasChagned event to listeners of this TownController.
     *
     * If the update changes properties of the interactable, the interactable is also expected to emit its own
     * events (@see ViewingAreaController and @see ConversationAreaController and @see PosterSessionAreaController)
     */
    this._socket.on('interactableUpdate', interactable => {
      if (isConversationArea(interactable)) {
        const relArea = this.conversationAreas.find(area => area.id == interactable.id);
        if (relArea) {
          const startsEmpty = relArea.isEmpty();
          // do the update
          relArea.topic = interactable.topic;
          relArea.occupants = this._playersByIDs(interactable.occupantsByID);
          if (startsEmpty != relArea.isEmpty()) {
            this.emit('conversationAreasChanged', this._conversationAreasInternal);
          }
        }
      } else if (isViewingArea(interactable)) {
        const relArea = this.viewingAreas.find(area => area.id == interactable.id);
        if (relArea) {
          relArea.updateFrom(interactable);
        }
      } else if (isPosterSessionArea(interactable)) {
        const relArea = this.posterSessionAreas.find(area => area.id == interactable.id);
        if (relArea) {
          relArea.updateFrom(interactable);
        }
      } else if (isCardGameArea(interactable)) {
        const relArea = this.cardGameAreas.find(area => area.id == interactable.id);
        if (relArea) {
          relArea.updateFrom(interactable);
        }
      }
    });
  }

  /**
   * Emit a movement event for the current player, updating the state locally and
   * also notifying the townService that our player moved.
   *
   * Note: it is the responsibility of the townService to set the 'interactableID' parameter
   * of the player's location, and any interactableID set here may be overwritten by the townService
   *
   * @param newLocation
   */
  public emitMovement(newLocation: PlayerLocation) {
    this._socket.emit('playerMovement', newLocation);
    const ourPlayer = this._ourPlayer;
    assert(ourPlayer);
    ourPlayer.location = newLocation;
    this.emit('playerMoved', ourPlayer);
  }

  /**
   * Emit a chat message to the townService
   *
   * @param message
   */
  public emitChatMessage(message: ChatMessage) {
    this._socket.emit('chatMessage', message);
  }

  /**
   * Emit a login-status-changed event for the current player, updating the state locally and
   * also notifying the townService that our player moved.
   *
   * @param googleEmail New Google email, or undefined if the current player is not logged in.
   * @param googleAccountName New Google account name, or undefined if the current player is not logged in.
   */
  public emitPlayerLoginChange(
    googleEmail: string | undefined,
    googleAccountName: string | undefined,
  ) {
    const ourPlayer = this._ourPlayer;
    assert(ourPlayer);
    ourPlayer.googleEmail = googleEmail;
    ourPlayer.googleAccountName = googleAccountName;
    this.emit('playerLoginChanged', ourPlayer);
    this._socket.emit('playerLoginLogout', googleEmail, googleAccountName);
  }

  /**
   * Emit a request for a match history to the townService
   *
   * @param googleEmail Google email of player for whom we want the match history
   */
  public emitRequestMatchHistory(googleEmail: string) {
    this._socket.emit('requestMatchHistory', googleEmail);
  }

  /**
   * Update the settings of the current town. Sends the request to update the settings to the townService,
   * and does not update the local model. If the update is successful, then the townService will inform us
   * of the updated settings. Throws an error if the request is not successful.
   *
   * @param roomUpdatePassword
   * @param updatedSettings
   */
  async updateTown(
    roomUpdatePassword: string,
    updatedSettings: { isPubliclyListed: boolean; friendlyName: string },
  ) {
    await this._townsService.updateTown(this._townID, roomUpdatePassword, updatedSettings);
  }

  /**
   * Delete the current town. Sends the request to the townService, and sends an error if the request is
   * not successful
   *
   * @param roomUpdatePassword
   */
  async deleteTown(roomUpdatePassword: string) {
    await this._townsService.deleteTown(this._townID, roomUpdatePassword);
  }

  /**
   * Create a new conversation area, sending the request to the townService. Throws an error if the request
   * is not successful. Does not immediately update local state about the new conversation area - it will be
   * updated once the townService creates the area and emits an interactableUpdate
   *
   * @param newArea
   */
  async createConversationArea(newArea: {
    topic?: string;
    id: string;
    occupantsByID: Array<string>;
  }) {
    await this._townsService.createConversationArea(this.townID, this.sessionToken, newArea);
  }

  /**
   * Create a new viewing area, sending the request to the townService. Throws an error if the request
   * is not successful. Does not immediately update local state about the new viewing area - it will be
   * updated once the townService creates the area and emits an interactableUpdate
   *
   * @param newArea
   */
  async createViewingArea(newArea: ViewingAreaModel) {
    await this._townsService.createViewingArea(this.townID, this.sessionToken, newArea);
  }

  /**
   * Create a new poster session area, sending the request to the townService. Throws an error if the request
   * is not successful. Does not immediately update local state about the new poster session area - it will be
   * updated once the townService creates the area and emits an interactableUpdate
   *
   * @param newArea
   */
  async createPosterSessionArea(newArea: PosterSessionAreaModel) {
    // TODO catch the error if the file type is invalid
    console.warn('Intermediate poster session: ' + JSON.stringify(newArea, null, 4));
    await this._townsService.createPosterSessionArea(this.townID, this.sessionToken, newArea);
  }

  /**
   * Create a card game area, sending the request to the townService. Throws an error if the request
   * is not successful. Does not immediately update local state about the new card game area - it will be
   * updated once the townService creates the area and emits an interactableUpdate
   *
   * @param newArea
   */
  async createCardGameArea(newArea: CardGameAreaModel) {
    await this._townsService.createCardGameArea(
      this.townID,
      this.sessionToken,
      newArea as CardGameAreaGenerated,
    );
  }

  /**
   * Disconnect from the town, notifying the townService that we are leaving and returning
   * to the login page
   */
  public disconnect() {
    this._socket.disconnect();
    this._loginController.setTownController(null);
  }

  /**
   * Connect to the townService. Throws an error if it is unable to connect
   * @returns
   */
  public async connect() {
    /*
         The connection is only valid if we receive an 'initialize' callback, and is invalid if the disconnect
         handler is called. Wrap the return of connect in a promise that is resolved upon initialize or rejected
         upon disconnect.
         */
    return new Promise<void>((resolve, reject) => {
      this._socket.connect();
      this._socket.on('initialize', initialData => {
        this._providerVideoToken = initialData.providerVideoToken;
        this._friendlyNameInternal = initialData.friendlyName;
        this._townIsPubliclyListedInternal = initialData.isPubliclyListed;
        this._sessionToken = initialData.sessionToken;
        this._players = initialData.currentPlayers.map(eachPlayerModel =>
          PlayerController.fromPlayerModel(eachPlayerModel),
        );

        this._conversationAreas = [];
        this._viewingAreas = [];
        this._posterSessionAreas = [];
        this._cardGameAreas = [];
        initialData.interactables.forEach(eachInteractable => {
          if (isConversationArea(eachInteractable)) {
            this._conversationAreasInternal.push(
              ConversationAreaController.fromConversationAreaModel(
                eachInteractable,
                this._playersByIDs.bind(this),
              ),
            );
          } else if (isViewingArea(eachInteractable)) {
            this._viewingAreas.push(new ViewingAreaController(eachInteractable));
          } else if (isPosterSessionArea(eachInteractable)) {
            this._posterSessionAreas.push(new PosterSessionAreaController(eachInteractable));
          } else if (isCardGameArea(eachInteractable)) {
            this._cardGameAreas.push(new CardGameAreaController(eachInteractable));
          }
        });
        this._userID = initialData.userID;
        this._ourPlayer = this.players.find(eachPlayer => eachPlayer.id == this.userID);
        this.emit('connect', initialData.providerVideoToken);
        resolve();
      });
      this._socket.on('disconnect', () => {
        reject(new Error('Invalid town ID'));
      });
    });
  }

  /**
   * Retrieve the viewing area controller that corresponds to a viewingAreaModel, creating one if necessary
   *
   * @param viewingArea
   * @returns
   */
  public getViewingAreaController(viewingArea: ViewingArea): ViewingAreaController {
    const existingController = this._viewingAreas.find(
      eachExistingArea => eachExistingArea.id === viewingArea.name,
    );
    if (existingController) {
      return existingController;
    } else {
      const newController = new ViewingAreaController({
        elapsedTimeSec: 0,
        id: viewingArea.name,
        isPlaying: false,
        video: viewingArea.defaultVideoURL,
      });
      this._viewingAreas.push(newController);
      return newController;
    }
  }

  /**
   * Retrieve the poster session area controller that corresponds to a posterSessionAreaModel, creating one if necessary
   *
   * @param posterSessionArea
   * @returns
   */
  public getPosterSessionAreaController(
    posterSessionArea: PosterSesssionArea,
  ): PosterSessionAreaController {
    const existingController = this._posterSessionAreas.find(
      eachExistingArea => eachExistingArea.id === posterSessionArea.name,
    );
    if (existingController) {
      return existingController;
    } else {
      const newController = new PosterSessionAreaController({
        id: posterSessionArea.name,
        title: posterSessionArea.defaultTitle,
        stars: 0,
        imageContents: undefined,
      });
      this._posterSessionAreas.push(newController);
      return newController;
    }
  }

  /**
   * Retrieve the card game area controller that corresponds to a CardGameAreaModel, creating one if necessary
   *
   * @param cardGameArea
   * @returns
   */
  public getCardGameAreaController(cardGameArea: CardGameArea): CardGameAreaController {
    const existingController = this._cardGameAreas.find(
      eachExistingArea => eachExistingArea.id === cardGameArea.name,
    );
    if (existingController) {
      return existingController;
    } else {
      const newController = new CardGameAreaController({
        id: cardGameArea.name,
        nonStartedGames: [],
        ongoingGames: [],
      });
      this._cardGameAreas.push(newController);
      return newController;
    }
  }

  /**
   * Emit a viewing area update to the townService
   * @param viewingArea The Viewing Area Controller that is updated and should be emitted
   *    with the event
   */
  public emitViewingAreaUpdate(viewingArea: ViewingAreaController) {
    this._socket.emit('interactableUpdate', viewingArea.viewingAreaModel());
  }

  /**
   * Emit a poster session area update to the townService
   * @param posterSessionArea The Poster Session Area Controller that is updated and should be emitted
   *    with the event
   */
  public emitPosterSessionAreaUpdate(posterSessionArea: PosterSessionAreaController) {
    this._socket.emit('interactableUpdate', posterSessionArea.posterSessionAreaModel());
  }

  /**
   * Get the image contents for a specified poster session area (specified via poster session area controller)
   * @param posterSessionArea the poster session area controller
   * @returns a promise wrapping the contents of the poster session area's image (i.e. the string)
   */
  public async getPosterSessionAreaImageContents(
    posterSessionArea: PosterSessionAreaController,
  ): Promise<string> {
    return this._townsService.getPosterAreaImageContents(
      this.townID,
      posterSessionArea.id,
      this.sessionToken,
    );
  }

  /**
   * Increment the number of stars for a specified poster session area (specified via poster session area controller)
   * @param posterSessionArea the poster session area controller
   * @returns a promise wrapping the new number of stars the poster has
   */
  public async incrementPosterSessionAreaStars(
    posterSessionArea: PosterSessionAreaController,
  ): Promise<number> {
    return this._townsService.incrementPosterAreaStars(
      this.townID,
      posterSessionArea.id,
      this.sessionToken,
    );
  }

  /**
   * Create a new card game and add the player.
   * @param cardGameArea the card game area controller
   * @returns a promise wrapping the ID of the newly created game
   */
  public async createCardGame(cardGameArea: CardGameAreaController): Promise<string> {
    return this._townsService.createCardGame(this.townID, cardGameArea.id, this.sessionToken);
  }

  /**
   * Adds the player to the given card game.
   * @param cardGameArea the card game area controller
   * @param cardGameId ID of card game
   */
  public async joinCardGame(
    cardGameArea: CardGameAreaController,
    cardGameId: string,
  ): Promise<void> {
    return this._townsService.joinCardGame(
      this.townID,
      cardGameArea.id,
      cardGameId,
      this.sessionToken,
    );
  }

  /**
   * Adds the player as a spectator to the given card game.
   * @param cardGameArea the card game area controller
   * @param cardGameId ID of card game
   */
  public async spectateCardGame(
    cardGameArea: CardGameAreaController,
    cardGameId: string,
  ): Promise<void> {
    return this._townsService.spectateCardGame(
      this.townID,
      cardGameArea.id,
      cardGameId,
      this.sessionToken,
    );
  }

  /**
   * Removes the player as a spectator from the given card game.
   * @param cardGameArea the card game area controller
   * @param cardGameId ID of card game
   */
  public async stopSpectatingCardGame(
    cardGameArea: CardGameAreaController,
    cardGameId: string,
  ): Promise<void> {
    return this._townsService.stopSpectatingCardGame(
      this.townID,
      cardGameArea.id,
      cardGameId,
      this.sessionToken,
    );
  }

  /**
   * Removes the player from the given non-started card game.
   * @param cardGameArea the card game area controller
   * @param cardGameId ID of non-started card game
   */
  public async leaveNonStartedCardGame(
    cardGameArea: CardGameAreaController,
    cardGameId: string,
  ): Promise<void> {
    return this._townsService.leaveNonStartedCardGame(
      this.townID,
      cardGameArea.id,
      cardGameId,
      this.sessionToken,
    );
  }

  /**
   * Plays the given move in the given card game.
   * @param cardGameArea the card game area controller
   * @param cardGameId ID of card game
   * @param move Move to play
   */
  public async cardGamePlayMove(
    cardGameArea: CardGameAreaController,
    cardGameId: string,
    move: PlayableMove,
  ) {
    return this._townsService.cardGamePlayMove(
      this.townID,
      cardGameArea.id,
      cardGameId,
      this.sessionToken,
      move,
    );
  }

  /**
   * Skips the current player's move in the given card game.
   *
   * @param cardGameArea the card game area controller
   * @param cardGameId ID of card game
   */
  public async cardGameSkipMove(cardGameArea: CardGameAreaController, cardGameId: string) {
    return this._townsService.cardGameSkipMove(
      this.townID,
      cardGameArea.id,
      cardGameId,
      this.sessionToken,
    );
  }

  /**
   * Starts the given card game.
   * @param cardGameArea the card game area controller
   * @param cardGameId ID of card game
   * @param color String representing the color of all cards in the deck,
   *              or undefined if the deck should contain cards of all colors.
   */
  public async startCardGame(
    cardGameArea: CardGameAreaController,
    cardGameId: string,
    color: string | undefined,
  ): Promise<void> {
    return this._townsService.startCardGame(
      this.townID,
      cardGameArea.id,
      cardGameId,
      this.sessionToken,
      { color },
    );
  }

  /**
   * Removes the player from the given ongoing card game.
   * @param cardGameArea the card game area controller
   * @param cardGameId ID of ongoing card game
   */
  public async quitOngoingCardGame(
    cardGameArea: CardGameAreaController,
    cardGameId: string,
  ): Promise<void> {
    return this._townsService.quitOngoingCardGame(
      this.townID,
      cardGameArea.id,
      cardGameId,
      this.sessionToken,
    );
  }

  /**
   * Determine which players are "nearby" -- that they should be included in our video call
   */
  public nearbyPlayers(): PlayerController[] {
    const isNearby = (p: PlayerController) => {
      if (p.location && this.ourPlayer.location) {
        if (this.ourPlayer.location.interactableID || p.location.interactableID) {
          return p.location.interactableID === this.ourPlayer.location.interactableID;
        }
        const dx = p.location.x - this.ourPlayer.location.x;
        const dy = p.location.y - this.ourPlayer.location.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        return d < 80;
      }
      return false;
    };
    return this.players.filter(p => isNearby(p));
  }

  /**
   * Gets the player card game elo ratings
   */
  public async getCardGameEloRatings(): Promise<EloRating[]> {
    return this._playerDataService.getAllCardGameEloRatings();
  }

  /**
   * Gets the elo rating for the given player
   * @param playerId the playerId corresponding to the player
   */
  public async getPlayerCardGameEloRating(playerId: string): Promise<EloRating> {
    return this._playerDataService.getPlayerCardGameEloRating(playerId);
  }

  private _playersByIDs(playerIDs: string[]): PlayerController[] {
    return this._playersInternal.filter(eachPlayer => playerIDs.includes(eachPlayer.id));
  }
}

/**
 * A react hook to retrieve the settings for this town
 *
 * This hook will cause components that use it to re-render when the settings change.
 *
 * This hook relies on the TownControllerContext.
 * @returns an object with the properties "friendlyName" and "isPubliclyListed",
 *  representing the current settings of the current town
 */
export function useTownSettings(): { friendlyName: string; isPubliclyListed: boolean } {
  const townController = useTownController();
  const [name, setName] = useState<string>(townController.friendlyName);
  const [listed, setListed] = useState<boolean>(townController.townIsPubliclyListed);
  useEffect(() => {
    const settingsUpdater = (upt: TownSettingsUpdate) => {
      const uptname = upt.friendlyName;
      const uptlisted = upt.isPubliclyListed;
      // might only be updating one setting; dont update if undefined
      if (uptname) {
        setName(uptname);
      }
      if (uptlisted != undefined) {
        setListed(uptlisted);
      }
    };
    townController.addListener('townSettingsUpdated', settingsUpdater);
    return () => {
      townController.removeListener('townSettingsUpdated', settingsUpdater);
    };
  }, [townController]);
  return { friendlyName: name, isPubliclyListed: listed };
}

/**
 * A react hook to retrieve the active conversation areas. This hook will re-render any components
 * that use it when the set of conversation areas changes. It does *not* re-render its dependent components
 * when the state of one of those areas changes - if that is desired, @see useConversationAreaTopic and @see useConversationAreaOccupants
 *
 * This hook relies on the TownControllerContext.
 *
 * @returns the list of conversation area controllers that are currently "active"
 */
export function useActiveConversationAreas(): ConversationAreaController[] {
  const townController = useTownController();
  const [conversationAreas, setConversationAreas] = useState<ConversationAreaController[]>(
    townController.conversationAreas.filter(area => !area.isEmpty()),
  );

  useEffect(() => {
    const activeSetter = (areas: ConversationAreaController[]) => {
      setConversationAreas(areas.filter(area => !area.isEmpty()));
    };
    townController.addListener('conversationAreasChanged', activeSetter);
    return () => {
      townController.removeListener('conversationAreasChanged', activeSetter);
    };
  }, [townController, setConversationAreas]);

  return conversationAreas;
}

/**
 * A react hook to return the PlayerController's corresponding to each player in the town.
 *
 * This hook will cause components that use it to re-render when the set of players in the town changes.
 *
 * This hook will *not* trigger re-renders if a player moves.
 *
 * This hook relies on the TownControllerContext.
 *
 * @returns an array of PlayerController's, representing the current set of players in the town
 */
export function usePlayers(): PlayerController[] {
  const townController = useTownController();
  const [players, setPlayers] = useState<PlayerController[]>(townController.players);
  useEffect(() => {
    // no listener for 'playerMoved'
    townController.addListener('playersChanged', setPlayers);
    return () => {
      townController.removeListener('playersChanged', setPlayers);
    };
  }, [townController, setPlayers]);
  return players;
}

/**
 * A react hook to retrieve a viewing area controller.
 *
 * This function will throw an error if the viewing area controller does not exist.
 *
 * This hook relies on the TownControllerContext.
 *
 * @param viewingAreaID The ID of the viewing area to retrieve the controller for
 *
 * @throws Error if there is no viewing area controller matching the specifeid ID
 */
export function useViewingAreaController(viewingAreaID: string): ViewingAreaController {
  const townController = useTownController();
  const ret = townController.viewingAreas.find(eachArea => eachArea.id === viewingAreaID);
  if (!ret) {
    throw new Error(`Unable to locate viewing area id ${viewingAreaID}`);
  }
  return ret;
}

/**
 * A react hook to retrieve a poster session area controller.
 *
 * This function will throw an error if the poster session area controller does not exist.
 *
 * This hook relies on the TownControllerContext.
 *
 * @param posterSessionAreaID The ID of the viewing area to retrieve the controller for
 *
 * @throws Error if there is no poster session area controller matching the specifeid ID
 */
export function usePosterSessionAreaController(
  posterSessionAreaID: string,
): PosterSessionAreaController {
  const townController = useTownController();
  const ret = townController.posterSessionAreas.find(
    eachArea => eachArea.id === posterSessionAreaID,
  );
  if (!ret) {
    throw new Error(`Unable to locate poster session area id ${posterSessionAreaID}`);
  }
  return ret;
}

/**
 * A react hook to retrieve a card game area controller.
 *
 * This function will throw an error if the card game area controller does not exist.
 *
 * This hook relies on the TownControllerContext.
 *
 * @param cardGameAreaID The ID of the card game area to retrieve the controller for
 *
 * @throws Error if there is no card game area controller matching the specifeid ID
 */
export function useCardGameAreaController(cardGameAreaID: string): CardGameAreaController {
  const townController = useTownController();
  const ret = townController.cardGameAreas.find(eachArea => eachArea.id === cardGameAreaID);
  if (!ret) {
    throw new Error(`Unable to locate card game area id ${cardGameAreaID}`);
  }
  return ret;
}

/**
 * React hook to retrieve the login information of the current user
 *
 * @returns Login information of the current user
 */
export function useLoginStatus(): GoogleDetails {
  const townController = useTownController();
  const [googleEmail, setGoogleEmail] = useState(townController.ourPlayer.googleEmail);
  const [googleAccountName, setGoogleAccountName] = useState(
    townController.ourPlayer.googleAccountName,
  );
  const updateLoginStatus = useCallback(
    (changedPlayer: PlayerController) => {
      if (changedPlayer.id === townController.ourPlayer.id) {
        setGoogleEmail(changedPlayer.googleEmail);
        setGoogleAccountName(changedPlayer.googleAccountName);
      }
    },
    [townController],
  );
  useEffect(() => {
    townController.addListener('playerLoginChanged', updateLoginStatus);
    return () => {
      townController.removeListener('playerLoginChanged', updateLoginStatus);
    };
  });
  return { googleEmail, googleAccountName };
}

/**
 * React hook to retrieve the match history of the given user
 *
 * @param googleEmail Email of the user for whom we want the match history
 * @returns Array representing previous games played by the given user
 */
export function useMatchHistory(googleEmail: string): MatchHistory[] {
  const townController = useTownController();
  useEffect(() => {
    townController.emitRequestMatchHistory(googleEmail);
  }, [townController, googleEmail]);
  const [matchHistory, setMatchHistory] = useState<MatchHistory[]>([]);
  const updateMatchHistory = useCallback(
    (newGoogleEmail: string, newMatchHistory: MatchHistory[]) => {
      if (googleEmail === newGoogleEmail) {
        setMatchHistory(newMatchHistory);
      }
    },
    [googleEmail],
  );
  useEffect(() => {
    townController.addListener('matchHistory', updateMatchHistory);
    return () => {
      townController.removeListener('matchHistory', updateMatchHistory);
    };
  }, [townController, updateMatchHistory]);
  return matchHistory;
}

function samePlayers(a1: PlayerController[], a2: PlayerController[]) {
  if (a1.length !== a2.length) return false;
  const ids1 = a1.map(p => p.id).sort();
  const ids2 = a2.map(p => p.id).sort();
  return _.isEqual(ids1, ids2);
}

/**
 * A react hook to retrieve the interactable that is *currently* be interacted with by the player in this frontend.
 * A player is "interacting" with the Interactable if they are within it, and press the spacebar.
 *
 * This hook will cause any component that uses it to re-render when the object that the player is interacting with changes.
 *
 * This hook relies on the TownControllerContext.
 *
 * @param interactableType
 */
export function useInteractable<T extends Interactable>(
  interactableType: T['name'],
): T | undefined {
  const townController = useTownController();
  const [interactable, setInteractable] = useState<T | undefined>(undefined);
  useEffect(() => {
    const onInteract = (interactWith: T) => {
      setInteractable(interactWith);
    };
    const offInteract = () => {
      setInteractable(undefined);
    };
    townController.interactableEmitter.on(interactableType, onInteract);
    townController.interactableEmitter.on('endInteraction', offInteract);

    return () => {
      townController.interactableEmitter.off(interactableType, onInteract);
      townController.interactableEmitter.off('endInteraction', offInteract);
    };
  }, [interactableType, townController, setInteractable]);
  return interactable;
}
/**
 * A react hook to retrieve the players that should be included in the video call
 *
 * This hook will cause components that  use it to re-render when the set of players in the video call changes.
 *
 * This hook relies on the TownControllerContext.
 * @returns
 */
export function usePlayersInVideoCall(): PlayerController[] {
  const townController = useTownController();
  const [playersInCall, setPlayersInCall] = useState<PlayerController[]>([]);
  useEffect(() => {
    let lastRecalculatedNearbyPlayers = 0;
    let prevNearbyPlayers: PlayerController[] = [];
    const updatePlayersInCall = () => {
      const now = Date.now();
      // To reduce re-renders, only recalculate the nearby players every so often
      if (now - lastRecalculatedNearbyPlayers > CALCULATE_NEARBY_PLAYERS_DELAY) {
        lastRecalculatedNearbyPlayers = now;
        const nearbyPlayers = townController.nearbyPlayers();
        if (!samePlayers(nearbyPlayers, prevNearbyPlayers)) {
          prevNearbyPlayers = nearbyPlayers;
          setPlayersInCall(nearbyPlayers);
        }
      }
    };
    townController.addListener('playerMoved', updatePlayersInCall);
    townController.addListener('playersChanged', updatePlayersInCall);
    updatePlayersInCall();
    return () => {
      townController.removeListener('playerMoved', updatePlayersInCall);
      townController.removeListener('playersChanged', updatePlayersInCall);
    };
  }, [townController, setPlayersInCall]);
  return playersInCall;
}
