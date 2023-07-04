import { ITiledMapObject } from '@jonbell/tiled-map-type-guard';
import { nanoid } from 'nanoid';
import {
  ALL_CARD_COLORS,
  DEFAULT_HAND_SIZE,
  DRAW_TWO,
  MAX_PLAYERS,
  MIN_PLAYERS,
  MOVE_TIMEOUT,
  NUMBER,
  playDrawMove,
  playMove,
  quitCardGame,
  RED,
  REVERSE,
  shuffleCards,
  SKIP,
  WILD,
  WILD_DRAW_FOUR,
} from '../generated/common';
import Player from '../lib/Player';
import {
  BoundingBox,
  TownEmitter,
  CardGameArea as CardGameAreaModel,
  NonStartedCardGame,
  OngoingCardGame,
  FullMove,
  Card,
  PlayableMove,
  EloRating,
  MatchHistory,
  EloRatingChange,
} from '../types/CoveyTownSocket';
import InteractableArea from './InteractableArea';
import { findPlayerElo, updatePlayerElo } from '../PlayerData/PlayerElo';
import { addNewMatch } from '../PlayerData/MatchHistory';

export default class CardGameArea extends InteractableArea {
  private _nonStartedGames: NonStartedCardGame[];

  private _ongoingGames: OngoingCardGame[];

  public get nonStartedGames() {
    return this._nonStartedGames;
  }

  public get ongoingGames() {
    return this._ongoingGames;
  }

  /**
   * Create a standard UNO deck.
   *
   * @param color String representing the color of all cards in the deck,
   *              or undefined if the deck should contain cards of all colors.
   * @returns a list of Cards representing a standard UNO deck
   */
  static genUnoDeck(color: string | undefined): Card[] {
    const deck: Card[] = [];
    for (const cardColor of ALL_CARD_COLORS) {
      const actualColor = color || cardColor;
      for (let value = 0; value < 10; value += 1) {
        deck.push({ type: NUMBER, color: actualColor, value });
      }
      for (let i = 0; i < 2; i += 1) {
        deck.push({ type: DRAW_TWO, color: actualColor });
        deck.push({ type: REVERSE, color: actualColor });
        deck.push({ type: SKIP, color: actualColor });
      }
    }
    if (color === undefined) {
      for (let i = 0; i < 4; i += 1) {
        deck.push({ type: WILD });
        deck.push({ type: WILD_DRAW_FOUR });
      }
    }
    return deck;
  }

  /**
   * Creates a new CardGameArea
   *
   * @param cardGameArea model containing this area's starting state
   * @param coordinates the bounding box that defines this card game area
   * @param townEmitter a broadcast emitter that can be used to emit updates to players
   */
  public constructor(
    { id, nonStartedGames, ongoingGames }: CardGameAreaModel,
    coordinates: BoundingBox,
    townEmitter: TownEmitter,
  ) {
    super(id, coordinates, townEmitter);
    this._nonStartedGames = nonStartedGames;
    this._ongoingGames = ongoingGames;
  }

  /**
   * Removes a player from this card game area.
   *
   * When the last player leaves, this method clears the not started game and ongoing games, and emits this update to all players in the Town.
   *
   * @param player
   */
  public remove(player: Player): void {
    super.remove(player);
    if (this._occupants.length === 0) {
      this._nonStartedGames = [];
      this._ongoingGames = [];
    }
    this._emitAreaChanged();
  }

  /**
   * Adds a (non-started) card game to this card game area with the given player.
   *
   * @param player Player to be added to the new card game
   * @returns ID of newly created card game.
   */
  public createCardGame(player: Player): string {
    if (player.googleEmail === undefined || player.googleAccountName === undefined) {
      throw new Error('Invalid Google account');
    }
    const id = nanoid();
    this._nonStartedGames.push({
      id,
      players: [
        {
          playerId: player.googleEmail,
          username: player.googleAccountName,
        },
      ],
    });
    this._emitAreaChanged();
    return id;
  }

  /**
   * Adds the given player to a given non-started card game.
   *
   * @param gameId ID of non-started card game.
   * @param player Player to add to card game.
   * @throws Error if player could not join the game
   */
  public joinCardGame(gameId: string, player: Player) {
    const cardGame = this._nonStartedGames.find(game => game.id === gameId);
    if (!cardGame) {
      throw new Error('No game with this ID exists');
    }
    if (cardGame.players.some(p => p.playerId === player.googleEmail)) {
      throw new Error('Player has already joined this game');
    }
    if (player.googleEmail === undefined || player.googleAccountName === undefined) {
      throw new Error('Invalid Google account');
    }
    cardGame.players.push({
      playerId: player.googleEmail,
      username: player.googleAccountName,
    });
    this._emitAreaChanged();
  }

  /**
   * Adds the given player as a spectator to a given ongoing card game.
   *
   * @param gameId ID of ongoing card game.
   * @param player Player to add to card game.
   * @throws Error if player could not join the game
   */
  public spectateCardGame(gameId: string, player: Player) {
    const cardGame = this._ongoingGames.find(game => game.id === gameId);
    if (!cardGame) {
      throw new Error('No game with this ID exists');
    }
    if (cardGame.spectators.some(p => p === player.id)) {
      throw new Error('Player is already spectating this game');
    }
    cardGame.spectators.push(player.id);
    this._emitAreaChanged();
  }

  /**
   * Removes the given player as a spectator from the given ongoing game.
   *
   * @param gameId ID of ongoing card game.
   * @param player Player to remove from card game.
   * @throws Error if player could not join the game
   */
  public stopSpectatingCardGame(gameId: string, player: Player) {
    const cardGame = this._ongoingGames.find(game => game.id === gameId);
    if (!cardGame) {
      throw new Error('No game with this ID exists');
    }
    const spectatorIdx = cardGame.spectators.findIndex(p => p === player.id);
    if (spectatorIdx === -1) {
      throw new Error('Player is not a spectator of this game');
    }
    cardGame.spectators.splice(spectatorIdx, 1);
    this._emitAreaChanged();
  }

  /**
   * Removes the player from the given non-started card game.
   *
   * @param gameId ID of non-started card game.
   * @param player Player to add to card game.
   * @throws Error if player did not already join this game.
   */
  public leaveNonStartedCardGame(gameId: string, player: Player) {
    const cardGameIndex = this._nonStartedGames.findIndex(game => game.id === gameId);
    if (cardGameIndex === -1) {
      throw new Error('No game with this ID exists');
    }
    const cardGame = this._nonStartedGames[cardGameIndex];
    const toRemove = cardGame.players.findIndex(p => p.playerId === player.googleEmail);
    if (toRemove === -1) {
      throw new Error('Player has not joined this game');
    }
    cardGame.players.splice(toRemove, 1);
    if (cardGame.players.length === 0) {
      this._nonStartedGames.splice(cardGameIndex, 1);
    }
    this._emitAreaChanged();
  }

  /**
   * Starts the given card game.
   *
   * @param gameId ID of non-started card game.
   * @param color String representing the color of all cards in the deck,
   *              or undefined if the deck should contain cards of all colors.
   * @throws Error if game could not be started
   */
  public startCardGame(gameId: string, color: string | undefined) {
    const cardGameIndex = this._nonStartedGames.findIndex(game => game.id === gameId);
    if (cardGameIndex === -1) {
      throw new Error('No game with this ID exists');
    }
    const cardGame = this._nonStartedGames[cardGameIndex];
    if (cardGame.players.length < MIN_PLAYERS) {
      throw new Error(`Can not start a game with less than ${MIN_PLAYERS} players`);
    }
    if (cardGame.players.length > MAX_PLAYERS) {
      throw new Error(`Can not start a game with more than ${MAX_PLAYERS} players`);
    }
    this._nonStartedGames.splice(cardGameIndex, 1);

    const deck = CardGameArea.genUnoDeck(color);
    let hands = [];
    let nextIdx = 0;
    let currentPlayerIdx = 0;
    let discardCard = deck[0];
    let playerDirection = true;
    let currentColor = RED;
    const moves: FullMove[] = [];
    const initialHands = [];
    // Could be a while (true) loop,
    // but we use for loop to make sure we do not enter infinite loop
    for (let j = 0; j < 100; j += 1) {
      shuffleCards(deck);
      hands = [];
      nextIdx = 0;
      for (const player of cardGame.players) {
        const newHand: Card[] = [];
        for (let i = 0; i < DEFAULT_HAND_SIZE; i += 1) {
          newHand.push(deck[nextIdx]);
          nextIdx += 1;
        }
        hands.push(newHand);
      }
      discardCard = deck[nextIdx];
      nextIdx += 1;
      if (discardCard.type !== WILD && discardCard.type !== WILD_DRAW_FOUR) {
        currentColor = discardCard.color;
        if (discardCard.type === REVERSE) {
          playerDirection = false;
        }
        if (discardCard.type === SKIP) {
          currentPlayerIdx += 1;
        }
        if (discardCard.type === DRAW_TWO) {
          for (let i = 0; i < 2; i += 1) {
            hands[0].push(deck[nextIdx]);
            nextIdx += 1;
          }
          currentPlayerIdx += 1;
        }
        for (let i = 0; i < cardGame.players.length; i += 1) {
          moves.push({
            playerId: cardGame.players[i].playerId,
            timestamp: Date.now(),
            move: {
              type: 'receive_hand',
              cards: [...hands[i]],
            },
          });
          initialHands.push([...hands[i]]);
        }
        break;
      }
    }
    // Only happens when we go through all iterations of for loop
    // and discard card is WILD/WILD_DRAW_FOUR every time
    if (moves.length === 0) {
      throw new Error('Failed to deal cards');
    }

    // At the beginning all players are active:
    const activePlayers = [];
    for (let i = 0; i < cardGame.players.length; i += 1) {
      activePlayers.push(i);
    }

    this._ongoingGames.push({
      id: cardGame.id,
      players: cardGame.players,
      activePlayers,
      spectators: [],
      winners: [],
      hands,
      moves,
      deck: deck.slice(nextIdx),
      discardPile: [discardCard],
      currentColor,
      currentPlayerIdx,
      playerDirection,
      prevEloRatings: [],
      eloRatingChanges: [],
      cardsDrawnDuringGame: [],
      startingTopCardDiscardPile: discardCard,
      initialHands,
      startTime: Date.now(),
    });

    this._storePrevEloRatings(this._ongoingGames[this._ongoingGames.length - 1]);

    this._emitAreaChanged();
  }

  /**
   * Gets each player's elo rating from the database and stores them in the ongoing card game
   * @param cardGame the ongoing card game
   */
  private async _storePrevEloRatings(cardGame: OngoingCardGame) {
    const previousElos = (await Promise.all(
      cardGame.players.map(async p => findPlayerElo(p.playerId)),
    )) as EloRating[];
    cardGame.prevEloRatings = previousElos;
  }

  /**
   * When an ongoing card game ends, calculate the new elo ratings
   * and save the game in the match history.
   *
   * @param cardGame Ongoing card game which just ended
   */
  private static _onGameEnd(cardGame: OngoingCardGame) {
    CardGameArea._calculateNewElos(cardGame);
    CardGameArea._saveMatchHistory(cardGame);
  }

  /**
   * Calculates the new elo ratings for players in a finished card game
   * @param cardGame the finished card game
   */
  private static _calculateNewElos(cardGame: OngoingCardGame) {
    const eloRatingsChanges: EloRatingChange[] = [];
    cardGame.winners.forEach((winnerIdx, rankIdx) => {
      const winnerPlayerId = cardGame.players[winnerIdx].playerId;
      eloRatingsChanges.push(this._calculateNewEloRatingChange(winnerPlayerId, rankIdx, cardGame));
    });

    cardGame.players.forEach(p => {
      if (!eloRatingsChanges.some(elo => elo.player.playerId === p.playerId)) {
        eloRatingsChanges.push(
          this._calculateNewEloRatingChange(p.playerId, cardGame.winners.length, cardGame),
        );
      }
    });

    cardGame.eloRatingChanges = eloRatingsChanges;
  }

  /**
   * Calculates the new elo rating change for the given player
   * @param playerId the player's id
   * @param ranking the player's ranking in the final standings
   * @param cardGame the card game that just finished
   * @returns a new elo rating change for the player
   */
  private static _calculateNewEloRatingChange(
    playerId: string,
    ranking: number,
    cardGame: OngoingCardGame,
  ): EloRatingChange {
    const prevElo = cardGame.prevEloRatings.find(elo => elo.playerId === playerId) as EloRating;

    let totalExpectedScore = 0;
    for (let i = 0; i < cardGame.prevEloRatings.length; i++) {
      if (playerId !== cardGame.prevEloRatings[i].playerId) {
        const ratingDifference = (cardGame.prevEloRatings[i].rating - prevElo.rating) / 400;
        totalExpectedScore += 1 / (1 + 10 ** ratingDifference);
      }
    }

    const expectedScore = totalExpectedScore / this._choose2(cardGame.prevEloRatings.length);
    const actualScore =
      (cardGame.prevEloRatings.length - ranking - 1) /
      this._choose2(cardGame.prevEloRatings.length);

    const newRating =
      prevElo.rating + 50 * (cardGame.prevEloRatings.length - 1) * (actualScore - expectedScore);

    const newEloRatingChange = {
      player: {
        playerId,
        username:
          cardGame.players.find(p => p.playerId === prevElo.playerId)?.username || 'Anonymous',
      },
      prevElo: prevElo.rating,
      newElo: Math.round(newRating),
    };
    return newEloRatingChange;
  }

  /**
   * Performs n choose 2
   * @param n a number to peform the operation on
   * @returns n choose 2
   */
  private static _choose2(n: number): number {
    return (n * (n - 1)) / 2;
  }

  /**
   * Stores the match history in the database
   * @param cardGame the card game to save
   */
  private static async _saveMatchHistory(cardGame: OngoingCardGame) {
    await Promise.all(
      cardGame.eloRatingChanges.map(async elo => {
        const previousNumPlayed =
          cardGame.prevEloRatings.find(prevElo => prevElo.playerId === elo.player.playerId)
            ?.numPlayed || 0;
        updatePlayerElo(
          elo.player.playerId,
          cardGame.players.find(p => p.playerId === elo.player.playerId)?.username || 'Anonymous',
          elo.newElo,
          previousNumPlayed + 1,
        );
      }),
    );

    const newMatchHistory = {
      players: cardGame.eloRatingChanges,
      playingOrder: cardGame.players.map(p => p.playerId),
      startTime: cardGame.startTime,
      endTime: Date.now(),
      cardsDrawnDuringGame: cardGame.cardsDrawnDuringGame,
      initialHands: cardGame.initialHands,
      startingTopCardDiscardPile: cardGame.startingTopCardDiscardPile,
      events: cardGame.moves,
    } as MatchHistory;

    addNewMatch(newMatchHistory);
  }

  /**
   * Plays the given move in the given card game.
   *
   * @param gameId ID of ongoing card game.
   * @param player Player making a move in the card game.
   * @param move move to play
   * @throw Error if move could not be played
   */
  public playMove(gameId: string, player: Player, move: PlayableMove) {
    const cardGame = this._ongoingGames.find(game => game.id === gameId);
    if (!cardGame) {
      throw new Error('No game with this ID exists');
    }
    const activeIdx = cardGame.activePlayers.findIndex(n => n === cardGame.currentPlayerIdx);
    if (activeIdx === -1) {
      throw new Error('Can not play move if player is not active');
    }
    if (cardGame.players[cardGame.currentPlayerIdx].playerId !== player.googleEmail) {
      throw new Error("Not this player's turn");
    }
    playMove(cardGame, move, CardGameArea._onGameEnd);
    cardGame.moves.push({
      playerId: player.googleEmail,
      timestamp: Date.now(),
      move,
    });
    this._emitAreaChanged();
  }

  /**
   * Skips the current player's move in the given card game.
   *
   * @param gameId ID of ongoing card game.
   * @throw Error if current player could not be skipped
   *        because the timeout has not passed.
   */
  public skipMove(gameId: string) {
    const cardGame = this._ongoingGames.find(game => game.id === gameId);
    if (!cardGame) {
      throw new Error('No game with this ID exists');
    }
    if (cardGame.activePlayers.length === 0) {
      throw new Error('Card game has ended');
    }
    if (Date.now() - cardGame.moves[cardGame.moves.length - 1].timestamp <= MOVE_TIMEOUT) {
      throw new Error("Not enough time has passed to skip the current player's turn");
    }
    cardGame.moves.push({
      playerId: cardGame.players[cardGame.currentPlayerIdx].playerId,
      timestamp: Date.now(),
      move: { type: 'skip' },
    });
    playDrawMove(cardGame);
    this._emitAreaChanged();
  }

  /**
   * Removes the given player from the given ongoing card game.
   *
   * @param gameId ID of ongoing card game.
   * @param player Player to quit the card game.
   * @throw Error if player can not quit the game.
   */
  public quitOngoingCardGame(gameId: string, player: Player) {
    const cardGame = this._ongoingGames.find(game => game.id === gameId);
    if (!cardGame) {
      throw new Error('No game with this ID exists');
    }
    if (player.googleEmail === undefined) {
      throw new Error("Player's Google email must be defined");
    }
    quitCardGame(cardGame, player.googleEmail, CardGameArea._onGameEnd);
    this._emitAreaChanged();
  }

  /**
   * Updates the state of this CardGameArea, setting the nonStartedGames and ongoingGames properties
   *
   * @param updatedModel updated model
   */
  public updateModel(updatedModel: CardGameAreaModel) {
    this._nonStartedGames = [...updatedModel.nonStartedGames];
    this._ongoingGames = [...updatedModel.ongoingGames];
  }

  /**
   * Convert this CardGameArea instance to a simple CardGameAreaModel suitable for
   * transporting over a socket to a client (i.e., serializable).
   */
  public toModel(): CardGameAreaModel {
    return {
      id: this.id,
      nonStartedGames: this._nonStartedGames,
      ongoingGames: this._ongoingGames,
    };
  }

  /**
   * Creates a new CardGameArea object that will represent a CardGameArea object in the town map.
   * @param mapObject An ITiledMapObject that represents a rectangle in which this card game area exists
   * @param townEmitter An emitter that can be used by this viewing area to broadcast updates to players in the town
   * @returns
   */
  public static fromMapObject(mapObject: ITiledMapObject, townEmitter: TownEmitter): CardGameArea {
    if (!mapObject.width || !mapObject.height) {
      throw new Error('missing width/height for map object');
    }
    const box = {
      x: mapObject.x,
      y: mapObject.y,
      width: mapObject.width,
      height: mapObject.height,
    };
    return new CardGameArea(
      { id: mapObject.name, nonStartedGames: [], ongoingGames: [] },
      box,
      townEmitter,
    );
  }
}
