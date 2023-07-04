import { mock, mockClear } from 'jest-mock-extended';
import { nanoid } from 'nanoid';
import Player from '../lib/Player';
import { getLastEmittedEvent } from '../TestUtils';
import { Card, NonStartedCardGame, OngoingCardGame, TownEmitter } from '../types/CoveyTownSocket';
import CardGameArea from './CardGameArea';
import { playerEloModel } from '../PlayerData/PlayerElo';
import { ALL_CARD_COLORS, DEFAULT_HAND_SIZE } from '../generated/common';
import * as eloFunctions from '../PlayerData/PlayerElo';
import * as matchHistoryFunctions from '../PlayerData/MatchHistory';

describe('CardGameArea', () => {
  const testAreaBox = { x: 100, y: 100, width: 100, height: 100 };
  let testArea: CardGameArea;
  const townEmitter = mock<TownEmitter>();
  const id = nanoid();
  let newPlayer1: Player;
  let newPlayer2: Player;

  const dummyPlayer1 = {
    playerId: 'player id 1',
    username: 'player 1',
  };
  const dummyPlayer2 = {
    playerId: 'player id 2',
    username: 'player 2',
  };
  const dummyPlayerElo1 = {
    playerId: 'player id 1',
    username: 'player 1',
    rating: 1400,
    numPlayed: 40,
  };

  let dummyNonStartedGame: NonStartedCardGame;
  let dummyOngoingGame: OngoingCardGame;

  beforeEach(() => {
    mockClear(townEmitter);
    testArea = new CardGameArea(
      { id, nonStartedGames: [], ongoingGames: [] },
      testAreaBox,
      townEmitter,
    );
    newPlayer1 = new Player(nanoid(), mock<TownEmitter>());
    newPlayer2 = new Player(nanoid(), mock<TownEmitter>());
    testArea.add(newPlayer1);
    testArea.add(newPlayer2);
    dummyNonStartedGame = {
      id: 'dummy non started game',
      players: [dummyPlayer1, dummyPlayer2],
    };
    dummyOngoingGame = {
      id: 'dummy ongoing game',
      players: [dummyPlayer1, dummyPlayer2],
      activePlayers: [0, 1],
      spectators: ['player3', 'player4'],
      winners: [],
      hands: [
        [
          { type: 'number', color: 'blue', value: 4 },
          { type: 'number', color: 'red', value: 2 },
        ],
        [
          { type: 'number', color: 'green', value: 5 },
          { type: 'number', color: 'yellow', value: 9 },
        ],
      ],
      moves: [
        {
          playerId: 'player id 1',
          timestamp: 1,
          move: {
            type: 'receive_hand',
            cards: [
              { type: 'number', color: 'blue', value: 4 },
              { type: 'number', color: 'red', value: 2 },
            ],
          },
        },
        {
          playerId: 'player id 2',
          timestamp: 2,
          move: {
            type: 'receive_hand',
            cards: [
              { type: 'number', color: 'green', value: 5 },
              { type: 'number', color: 'yellow', value: 9 },
            ],
          },
        },
      ],
      deck: [
        { type: 'number', color: 'red', value: 1 },
        { type: 'number', color: 'red', value: 2 },
        { type: 'number', color: 'red', value: 3 },
      ],
      discardPile: [{ type: 'number', color: 'red', value: 1 }],
      currentColor: 'red',
      lastDrawPlayed: undefined,
      currentPlayerIdx: 0,
      playerDirection: true,
      prevEloRatings: [
        {
          playerId: 'player id 1',
          username: 'player 1',
          rating: 1050,
          numPlayed: 4,
        },
        {
          playerId: 'player id 2',
          username: 'player 2',
          rating: 1070,
          numPlayed: 6,
        },
      ],
      eloRatingChanges: [],
      cardsDrawnDuringGame: [],
      startingTopCardDiscardPile: { type: 'number', color: 'red', value: 1 },
      initialHands: [
        [
          { type: 'number', color: 'blue', value: 4 },
          { type: 'number', color: 'red', value: 2 },
        ],
        [
          { type: 'number', color: 'green', value: 5 },
          { type: 'number', color: 'yellow', value: 9 },
        ],
      ],
      startTime: 0,
    };
  });
  describe('add', () => {
    it("Sets the player's interactable id and emits an update for their location", () => {
      expect(newPlayer1.location.interactableID).toEqual(id);

      const lastEmittedMovement = getLastEmittedEvent(townEmitter, 'playerMoved');
      expect(lastEmittedMovement.location.interactableID).toEqual(id);
    });
  });
  describe('remove', () => {
    it("Clears the player's interactable id and emits an update for their location", () => {
      testArea.remove(newPlayer1);
      expect(newPlayer1.location.interactableID).toBeUndefined();
      const lastEmittedMovement = getLastEmittedEvent(townEmitter, 'playerMoved');
      expect(lastEmittedMovement.location.interactableID).toBeUndefined();
    });

    it('Empties the list of nonStartedGames and ongoingGames when the last person leaves', () => {
      testArea.nonStartedGames.push(dummyNonStartedGame);
      testArea.ongoingGames.push(dummyOngoingGame);
      expect(testArea.nonStartedGames).toEqual([dummyNonStartedGame]);
      expect(testArea.ongoingGames).toEqual([dummyOngoingGame]);
      testArea.remove(newPlayer1);
      testArea.remove(newPlayer2);
      expect(testArea.nonStartedGames).toEqual([]);
      expect(testArea.ongoingGames).toEqual([]);
    });

    it('Does not empty the list of nonStartedGames and ongoingGames when someone leaves and there are still players remaining', () => {
      const anotherPlayer = new Player(nanoid(), mock<TownEmitter>());
      testArea.add(anotherPlayer);
      testArea.nonStartedGames.push(dummyNonStartedGame);
      testArea.ongoingGames.push(dummyOngoingGame);
      expect(testArea.nonStartedGames).toEqual([dummyNonStartedGame]);
      expect(testArea.ongoingGames).toEqual([dummyOngoingGame]);
      testArea.remove(anotherPlayer);
      expect(testArea.nonStartedGames).toEqual([dummyNonStartedGame]);
      expect(testArea.ongoingGames).toEqual([dummyOngoingGame]);
    });
  });

  test('toModel sets the ID, nonStartedGames, and ongoingGames and sets no other properties', () => {
    const model = testArea.toModel();
    expect(model).toEqual({
      id,
      nonStartedGames: [],
      ongoingGames: [],
    });
  });
  describe('fromMapObject', () => {
    it('Throws an error if the width or height are missing', () => {
      expect(() =>
        CardGameArea.fromMapObject(
          { id: 1, name: nanoid(), visible: true, x: 0, y: 0 },
          townEmitter,
        ),
      ).toThrowError();
    });
    it('Creates a new card game area using the provided boundingBox and id, with empty nonStartedGames and ongoingGames', () => {
      const x = 30;
      const y = 20;
      const width = 10;
      const height = 20;
      const name = 'name';
      const val = CardGameArea.fromMapObject(
        { x, y, width, height, name, id: 10, visible: true },
        townEmitter,
      );
      expect(val.boundingBox).toEqual({ x, y, width, height });
      expect(val.id).toEqual(name);
      expect(val.nonStartedGames).toEqual([]);
      expect(val.ongoingGames).toEqual([]);
    });
  });

  describe('constructor', () => {
    it('Creates a new CardGameArea with empty lists for nonStartedGames and ongoingGames', () => {
      const newCardGameArea = new CardGameArea(
        { id, nonStartedGames: [], ongoingGames: [] },
        testAreaBox,
        townEmitter,
      );
      expect(newCardGameArea.nonStartedGames).toEqual([]);
      expect(newCardGameArea.ongoingGames).toEqual([]);
    });

    it('Creates a new CardGameArea with non empty lists for nonStartedGames and ongoingGames', () => {
      const newCardGameArea = new CardGameArea(
        { id, nonStartedGames: [dummyNonStartedGame], ongoingGames: [dummyOngoingGame] },
        testAreaBox,
        townEmitter,
      );
      expect(newCardGameArea.nonStartedGames).toEqual([dummyNonStartedGame]);
      expect(newCardGameArea.ongoingGames).toEqual([dummyOngoingGame]);
    });
  });

  describe('creating a nonStartedGame', () => {
    it('Creates a nonStartedGame for a player with valid google account details', () => {
      newPlayer1.googleEmail = 'firstlast@gmail.com';
      newPlayer1.googleAccountName = 'First Last';
      testArea.createCardGame(newPlayer1);
      expect(testArea.nonStartedGames.length).toEqual(1);
      expect(testArea.nonStartedGames[0].players).toContainEqual({
        playerId: newPlayer1.googleEmail,
        username: newPlayer1.googleAccountName,
      });
    });

    it('Throws an error if a player does not have a non-null google email or account name when creating a nonStartedGame', () => {
      newPlayer1.googleEmail = undefined;
      newPlayer1.googleAccountName = undefined;
      expect(() => testArea.createCardGame(newPlayer1)).toThrowError();
    });
  });

  describe('joining and leaving a nonStartedGame', () => {
    let cardGameId: string;
    beforeEach(() => {
      newPlayer1.googleEmail = 'firstlast@gmail.com';
      newPlayer1.googleAccountName = 'First Last';
      cardGameId = testArea.createCardGame(newPlayer1);
    });

    it('Allows other players with a valid google account to join and leave a nonStartedGame', () => {
      newPlayer2.googleEmail = 'lastfirst@gmail.com';
      newPlayer2.googleAccountName = 'Last First';

      testArea.joinCardGame(cardGameId, newPlayer2);
      const cardGame = testArea.nonStartedGames.find(
        game => game.id === cardGameId,
      ) as NonStartedCardGame;
      const hasPlayerAfterJoining = cardGame.players.some(
        p => p.playerId === newPlayer2.googleEmail,
      );
      expect(hasPlayerAfterJoining).toBe(true);

      testArea.leaveNonStartedCardGame(cardGameId, newPlayer2);
      const hasPlayerAfterLeaving = dummyOngoingGame.players.some(
        p => p.playerId === newPlayer2.googleEmail,
      );
      expect(hasPlayerAfterLeaving).toBe(false);

      testArea.leaveNonStartedCardGame(cardGameId, newPlayer1);
      expect(testArea.nonStartedGames).toEqual([]);
    });

    it('Throws an error if the game id doesnt exist when joining a nonStartedGame', () => {
      newPlayer2.googleEmail = 'lastfirst@gmail.com';
      newPlayer2.googleAccountName = 'Last First';
      expect(() => testArea.joinCardGame('This id does not exist', newPlayer2)).toThrowError();
    });

    it('Throws an error if a player tries to join a nonStartedGame they are already in', () => {
      expect(() => testArea.joinCardGame(cardGameId, newPlayer1)).toThrowError();
    });

    it('Throws an error if a player does not have a non-null google email or account name when joining a nonStartedGame', () => {
      newPlayer2.googleEmail = undefined;
      newPlayer2.googleAccountName = undefined;
      expect(() => testArea.joinCardGame(cardGameId, newPlayer2)).toThrowError();
    });

    it('Throws an error if the game id doesnt exist when leaving a nonStartedGame', () => {
      newPlayer2.googleEmail = 'lastfirst@gmail.com';
      newPlayer2.googleAccountName = 'Last First';
      expect(() =>
        testArea.leaveNonStartedCardGame('This id does not exist', newPlayer1),
      ).toThrowError();
    });

    it('Throws an error if a player tries to leave a nonStartedGame they didnt join', () => {
      newPlayer2.googleEmail = 'lastfirst@gmail.com';
      newPlayer2.googleAccountName = 'Last First';
      expect(() => testArea.leaveNonStartedCardGame(cardGameId, newPlayer2)).toThrowError();
    });
  });

  describe('spectating an ongoingGame', () => {
    beforeEach(() => {
      testArea.ongoingGames.push(dummyOngoingGame);
    });

    it('Adds and removes a player from the spectators list', () => {
      testArea.spectateCardGame(dummyOngoingGame.id, newPlayer1);
      const hasSpectatorAfterJoining = dummyOngoingGame.spectators.some(p => p === newPlayer1.id);
      expect(hasSpectatorAfterJoining).toBe(true);

      testArea.stopSpectatingCardGame(dummyOngoingGame.id, newPlayer1);
      const hasSpectatorAfterLeaving = dummyOngoingGame.spectators.some(p => p === newPlayer1.id);
      expect(hasSpectatorAfterLeaving).toBe(false);
    });

    it('Throws an error if a player tries to spectate an ongoingGame with an invalid game id', () => {
      expect(() => testArea.spectateCardGame('This id does not exist', newPlayer1)).toThrowError();
    });

    it('Throws an error if a player tries to spectate they are already spectating', () => {
      testArea.spectateCardGame(dummyOngoingGame.id, newPlayer1);
      expect(() => testArea.spectateCardGame(dummyOngoingGame.id, newPlayer1)).toThrowError();
    });

    it('Throws an error if a player stops spectating an ongoingGame with an invalid id', () => {
      expect(() =>
        testArea.stopSpectatingCardGame('This id does not exist', newPlayer2),
      ).toThrowError();
    });

    it('Throws an error if a player tries to stop spectating an ongoingGame they are not in', () => {
      expect(() => testArea.stopSpectatingCardGame(dummyOngoingGame.id, newPlayer2)).toThrowError();
    });
  });

  describe('starting a nonStartedGame', () => {
    it('Starts a game with all 4 colors properly by initializing each players hands and the uno deck', () => {
      Object.defineProperty(playerEloModel, 'findOne', {
        value: jest.fn(() => dummyPlayerElo1),
        configurable: true,
      });

      testArea.nonStartedGames.push(dummyNonStartedGame);
      testArea.startCardGame(dummyNonStartedGame.id, undefined);
      const newOngoingGame = testArea.ongoingGames.find(game => game.id === dummyNonStartedGame.id);
      for (let i = 0; i < dummyNonStartedGame.players.length; i++) {
        expect(newOngoingGame?.players).toContainEqual(dummyNonStartedGame.players[i]);
      }
      const hands = newOngoingGame?.hands as Card[][];
      expect(newOngoingGame?.hands.length).toEqual(dummyNonStartedGame.players.length);

      // 72 is deck size containing all possible cards (for a deck with all 4 colors),
      // then subtract the combined hand sizes (2 * 7) and subtract 1 for starting top card discard pile --> 57
      // Also, we could have a draw 2 or draw 4 as the top starting discard pile, so deck size is between 53 and 57.
      const ourDeckSize = newOngoingGame?.deck.length;
      const possibleDeckSize = 72 - 2 * DEFAULT_HAND_SIZE - 1; // 57
      expect(ourDeckSize).toBeGreaterThanOrEqual(possibleDeckSize - 2);
      expect(ourDeckSize).toBeLessThanOrEqual(possibleDeckSize);
      for (let i = 0; i < hands.length; i++) {
        expect(hands[i].length).toBeGreaterThanOrEqual(DEFAULT_HAND_SIZE);
        expect(hands[i].length).toBeLessThanOrEqual(DEFAULT_HAND_SIZE + 4);
      }
    });

    it('Starts a game with only red cards properly by initializing each players hands and the uno deck', () => {
      Object.defineProperty(playerEloModel, 'findOne', {
        value: jest.fn(() => dummyPlayerElo1),
        configurable: true,
      });

      testArea.nonStartedGames.push(dummyNonStartedGame);
      testArea.startCardGame(dummyNonStartedGame.id, 'red');
      const newOngoingGame = testArea.ongoingGames.find(game => game.id === dummyNonStartedGame.id);
      for (let i = 0; i < dummyNonStartedGame.players.length; i++) {
        expect(newOngoingGame?.players).toContainEqual(dummyNonStartedGame.players[i]);
      }
      const hands = newOngoingGame?.hands as Card[][];
      expect(newOngoingGame?.hands.length).toEqual(dummyNonStartedGame.players.length);

      // 64 is deck size containing all possible cards (for a deck with only red cards),
      // then subtract the combined hand sizes (2 * 7) and subtract 1 for starting top card discard pile --> 49
      // Also, we could have a draw 2 as the top starting discard pile, so deck size is between 47 and 49.
      const ourDeckSize = newOngoingGame?.deck.length;
      const possibleDeckSize = 64 - 2 * DEFAULT_HAND_SIZE - 1; // 49
      expect(ourDeckSize).toBeGreaterThanOrEqual(possibleDeckSize - 2);
      expect(ourDeckSize).toBeLessThanOrEqual(possibleDeckSize);
      for (let i = 0; i < hands.length; i++) {
        expect(hands[i].length).toBeGreaterThanOrEqual(DEFAULT_HAND_SIZE);
        expect(hands[i].length).toBeLessThanOrEqual(DEFAULT_HAND_SIZE + 2);
      }
    });

    it('Throws an error if a we try to start a game with an invalid id', () => {
      expect(() => testArea.startCardGame('This id does not exist', 'red')).toThrowError();
    });

    it('Throws an error if a we try to start a game with less than the minimum players needed', () => {
      testArea.nonStartedGames.push(dummyNonStartedGame);
      dummyNonStartedGame.players.pop();
      expect(() => testArea.startCardGame(dummyNonStartedGame.id, 'red')).toThrowError();
    });

    it('Throws an error if a we try to start a game with more than the maximum players allowed', () => {
      testArea.nonStartedGames.push(dummyNonStartedGame);
      for (let i = 0; i < 50; i++) {
        dummyNonStartedGame.players.push(dummyPlayer1);
      }
      expect(() => testArea.startCardGame(dummyNonStartedGame.id, 'red')).toThrowError();
    });
  });

  describe('playing a move in an ongoingGame', () => {
    beforeEach(() => {
      testArea.ongoingGames.push(dummyOngoingGame);
      newPlayer1.googleEmail = dummyPlayer1.playerId;
      newPlayer1.googleAccountName = dummyPlayer1.username;
      newPlayer2.googleEmail = dummyPlayer2.playerId;
      newPlayer2.googleAccountName = dummyPlayer2.username;
    });

    it('Updates the game state when a player plays a regular move', () => {
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(0);
      expect(dummyOngoingGame.currentColor).toEqual('red');
      testArea.playMove(dummyOngoingGame.id, newPlayer1, {
        type: false,
        card: 1,
        color: undefined,
      });
      expect(dummyOngoingGame.discardPile[dummyOngoingGame.discardPile.length - 1]).toEqual({
        type: 'number',
        color: 'red',
        value: 2,
      });
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(1);
      expect(dummyOngoingGame.currentColor).toEqual('red');
    });

    it('Updates the game state when a player plays a skip card', () => {
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(0);
      expect(dummyOngoingGame.currentColor).toEqual('red');
      dummyOngoingGame.hands[0].push({ type: 'skip', color: 'red' });
      testArea.playMove(dummyOngoingGame.id, newPlayer1, {
        type: false,
        card: 2,
        color: undefined,
      });
      expect(dummyOngoingGame.discardPile[dummyOngoingGame.discardPile.length - 1]).toEqual({
        type: 'skip',
        color: 'red',
      });
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(0);
    });

    it('Updates the game state when a player plays a reverse card in a 2 player game', () => {
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(0);
      expect(dummyOngoingGame.currentColor).toEqual('red');
      dummyOngoingGame.hands[0].push({ type: 'reverse', color: 'red' });
      testArea.playMove(dummyOngoingGame.id, newPlayer1, {
        type: false,
        card: 2,
        color: undefined,
      });
      expect(dummyOngoingGame.discardPile[dummyOngoingGame.discardPile.length - 1]).toEqual({
        type: 'reverse',
        color: 'red',
      });
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(0);
    });

    it('Updates the game state when a player plays a reverse card in a 3 player game', () => {
      dummyOngoingGame.activePlayers.push(2);
      dummyOngoingGame.players.push({
        playerId: 'player 3 id',
        username: 'player 3',
      });
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(0);
      expect(dummyOngoingGame.currentColor).toEqual('red');
      expect(dummyOngoingGame.playerDirection).toBe(true);
      dummyOngoingGame.hands[0].push({ type: 'reverse', color: 'red' });
      testArea.playMove(dummyOngoingGame.id, newPlayer1, {
        type: false,
        card: 2,
        color: undefined,
      });
      expect(dummyOngoingGame.discardPile[dummyOngoingGame.discardPile.length - 1]).toEqual({
        type: 'reverse',
        color: 'red',
      });
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(2);
      expect(dummyOngoingGame.playerDirection).toBe(false);
    });

    it('Updates the game state when a player plays a draw 2 card', () => {
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(0);
      expect(dummyOngoingGame.currentColor).toEqual('red');
      dummyOngoingGame.hands[0].push({ type: 'draw_two', color: 'red' });
      testArea.playMove(dummyOngoingGame.id, newPlayer1, {
        type: false,
        card: 2,
        color: undefined,
      });
      expect(dummyOngoingGame.discardPile[dummyOngoingGame.discardPile.length - 1]).toEqual({
        type: 'draw_two',
        color: 'red',
      });
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(1);
      expect(dummyOngoingGame.lastDrawPlayed).toEqual(2);
    });

    it('Updates the game state when a player plays a wild card and changes the color', () => {
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(0);
      expect(dummyOngoingGame.currentColor).toEqual('red');
      dummyOngoingGame.hands[0].push({ type: 'wild' });
      testArea.playMove(dummyOngoingGame.id, newPlayer1, {
        type: false,
        card: 2,
        color: 'yellow',
      });
      expect(dummyOngoingGame.discardPile[dummyOngoingGame.discardPile.length - 1]).toEqual({
        type: 'wild',
      });
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(1);
      expect(dummyOngoingGame.currentColor).toEqual('yellow');
    });

    it('Updates the game state when a player plays a wild draw 4 card and changes the color', () => {
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(0);
      expect(dummyOngoingGame.currentColor).toEqual('red');
      dummyOngoingGame.hands[0].push({ type: 'wild_draw_four' });
      testArea.playMove(dummyOngoingGame.id, newPlayer1, {
        type: false,
        card: 2,
        color: 'yellow',
      });
      expect(dummyOngoingGame.discardPile[dummyOngoingGame.discardPile.length - 1]).toEqual({
        type: 'wild_draw_four',
      });
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(1);
      expect(dummyOngoingGame.currentColor).toEqual('yellow');
      expect(dummyOngoingGame.lastDrawPlayed).toEqual(4);
    });

    it('Updates the game state when a player draws a single card from the deck', () => {
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(0);
      expect(dummyOngoingGame.currentColor).toEqual('red');
      const handSizeBeforeDrawing = dummyOngoingGame.hands[0].length;
      testArea.playMove(dummyOngoingGame.id, newPlayer1, {
        type: true,
      });
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(1);
      expect(dummyOngoingGame.hands[0].length).toEqual(handSizeBeforeDrawing + 1);
    });

    it('Updates the game state when a player draws more than 1 card from the deck', () => {
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(0);
      expect(dummyOngoingGame.currentColor).toEqual('red');
      dummyOngoingGame.lastDrawPlayed = 4;
      const handSizeBeforeDrawing = dummyOngoingGame.hands[0].length;
      testArea.playMove(dummyOngoingGame.id, newPlayer1, {
        type: true,
      });
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(1);
      expect(dummyOngoingGame.hands[0].length).toEqual(handSizeBeforeDrawing + 3);
    });

    it('Updates the game state when a player plays the last card in their hand and the game is now over', () => {
      Object.defineProperty(eloFunctions, 'updatePlayerElo', {
        value: jest.fn(),
      });
      Object.defineProperty(matchHistoryFunctions, 'addNewMatch', {
        value: jest.fn(),
      });

      expect(dummyOngoingGame.currentPlayerIdx).toEqual(0);
      expect(dummyOngoingGame.currentColor).toEqual('red');
      dummyOngoingGame.hands[0] = [{ type: 'number', color: 'red', value: 2 }];
      testArea.playMove(dummyOngoingGame.id, newPlayer1, {
        type: false,
        card: 0,
        color: undefined,
      });
      expect(dummyOngoingGame.discardPile[dummyOngoingGame.discardPile.length - 1]).toEqual({
        type: 'number',
        color: 'red',
        value: 2,
      });
      expect(dummyOngoingGame.winners).toContain(0);
      expect(dummyOngoingGame.activePlayers.some(p => p === 0)).toBe(false);
      expect(dummyOngoingGame.eloRatingChanges.length).toBeGreaterThan(0);
    });

    it('Throws an error if we play a move with an invalid game id', () => {
      expect(() =>
        testArea.playMove('This id does not exist', newPlayer1, {
          type: false,
          card: 1,
          color: undefined,
        }),
      ).toThrowError();
    });

    it('Throws an error if a player who is not in the game tries to play a move', () => {
      expect(() =>
        testArea.playMove(dummyOngoingGame.id, new Player(nanoid(), mock<TownEmitter>()), {
          type: false,
          card: 1,
          color: undefined,
        }),
      ).toThrowError();
    });

    it('Throws an error if currentPlayerIdx is not in the list of active players', () => {
      dummyOngoingGame.currentPlayerIdx = 10;
      expect(() =>
        testArea.playMove(dummyOngoingGame.id, newPlayer1, {
          type: false,
          card: 1,
          color: undefined,
        }),
      ).toThrowError();
    });

    it('Throws an error if a player tries to play a move when it is not their turn', () => {
      expect(() =>
        testArea.playMove(dummyOngoingGame.id, newPlayer2, {
          type: false,
          card: 1,
          color: undefined,
        }),
      ).toThrowError();
    });

    it('Throws an error if a player tries to play a move with an undefined card', () => {
      expect(() =>
        testArea.playMove(dummyOngoingGame.id, newPlayer2, {
          type: false,
          card: undefined,
          color: undefined,
        }),
      ).toThrowError();
    });

    it('Throws an error if a player tries to play a card move but is supposed to draw instead', () => {
      dummyOngoingGame.lastDrawPlayed = 2;
      expect(() =>
        testArea.playMove(dummyOngoingGame.id, newPlayer2, {
          type: false,
          card: 1,
          color: undefined,
        }),
      ).toThrowError();
    });

    it('Throws an error if a player tries to play a wild card without specifying the new color', () => {
      dummyOngoingGame.lastDrawPlayed = 2;
      dummyOngoingGame.hands[0].push({ type: 'wild' });
      expect(() =>
        testArea.playMove(dummyOngoingGame.id, newPlayer2, {
          type: false,
          card: 2,
          color: undefined,
        }),
      ).toThrowError();
    });

    it('Throws an error if a player tries to play an invalid uno move (different color and number)', () => {
      expect(() =>
        testArea.playMove(dummyOngoingGame.id, newPlayer2, {
          type: false,
          card: 0,
          color: undefined,
        }),
      ).toThrowError();
    });
  });

  describe('skipping a move in an ongoingGame', () => {
    beforeEach(() => {
      testArea.ongoingGames.push(dummyOngoingGame);
      newPlayer1.googleEmail = dummyPlayer1.playerId;
      newPlayer1.googleAccountName = dummyPlayer1.username;
      newPlayer2.googleEmail = dummyPlayer2.playerId;
      newPlayer2.googleAccountName = dummyPlayer2.username;
    });

    it('Skips a players turn if the timeout has passed', () => {
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(0);
      testArea.skipMove(dummyOngoingGame.id);
      expect(dummyOngoingGame.currentPlayerIdx).toEqual(1);
    });

    it('Throws an error on an invalid game id', () => {
      expect(() => testArea.skipMove('This id does not exist')).toThrowError();
    });

    it('Throws an error on an invalid game id', () => {
      dummyOngoingGame.activePlayers = [];
      expect(() => testArea.skipMove(dummyOngoingGame.id)).toThrowError();
    });

    it('Throws an error when timeout hasnt passed yet', () => {
      dummyOngoingGame.moves.push({
        playerId: dummyPlayer1.playerId,
        timestamp: Date.now(),
        move: { type: 'skip' },
      });
      expect(() => testArea.skipMove(dummyOngoingGame.id)).toThrowError();
    });
  });

  describe('quitting an ongoingGame', () => {
    beforeEach(() => {
      testArea.ongoingGames.push(dummyOngoingGame);
      newPlayer1.googleEmail = dummyPlayer1.playerId;
      newPlayer1.googleAccountName = dummyPlayer1.username;
      newPlayer2.googleEmail = dummyPlayer2.playerId;
      newPlayer2.googleAccountName = dummyPlayer2.username;
    });

    it('Removes a player from the game', () => {
      Object.defineProperty(eloFunctions, 'updatePlayerElo', {
        value: jest.fn(),
      });
      Object.defineProperty(matchHistoryFunctions, 'addNewMatch', {
        value: jest.fn(),
      });

      expect(dummyOngoingGame.activePlayers).toEqual([0, 1]);
      testArea.quitOngoingCardGame(dummyOngoingGame.id, newPlayer1);
      expect(dummyOngoingGame.activePlayers).toEqual([]);
    });

    it('Throws an error on an invalid game id', () => {
      expect(() =>
        testArea.quitOngoingCardGame('This id does not exist', newPlayer1),
      ).toThrowError();
    });

    it('Throws an error on an undefined google email', () => {
      newPlayer1.googleEmail = undefined;
      expect(() => testArea.quitOngoingCardGame(dummyOngoingGame.id, newPlayer1)).toThrowError();
    });
  });

  describe('updateModel', () => {
    it('Updates the list of nonStartedGames and ongoingGames using updateModel', () => {
      expect(testArea.nonStartedGames).toEqual([]);
      expect(testArea.ongoingGames).toEqual([]);
      testArea.updateModel({
        id: 'some id',
        nonStartedGames: [dummyNonStartedGame],
        ongoingGames: [dummyOngoingGame],
      });
      expect(testArea.nonStartedGames).toEqual([dummyNonStartedGame]);
      expect(testArea.ongoingGames).toEqual([dummyOngoingGame]);
    });
  });
});
