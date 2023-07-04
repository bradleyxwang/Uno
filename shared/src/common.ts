import { Card, OngoingCardGame, PlayableMove } from '../types/CoveyTownSocket';

export const NUMBER = 'number';
export const DRAW_TWO = 'draw_two';
export const REVERSE = 'reverse';
export const SKIP = 'skip';
export const WILD = 'wild';
export const WILD_DRAW_FOUR = 'wild_draw_four';
export const RECEIVE_HAND = 'receive_hand';
export const QUIT = 'quit';
export const DRAW = true;
export const PLAY = false;
export const RED = 'red';
export const YELLOW = 'yellow';
export const BLUE = 'blue';
export const GREEN = 'green';

export const ALL_CARD_COLORS = [RED, YELLOW, BLUE, GREEN];

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;
export const DEFAULT_HAND_SIZE = 7;
export const MOVE_TIMEOUT = 20000;

/**
 * Shuffle the given list of cards.
 * @param deck List of cards to shuffle
 */
export function shuffleCards(deck: Card[]) {
  // Fisher-Yates shuffle:
  for (let i = 0; i < deck.length - 1; i += 1) {
    const j = i + Math.floor(Math.random() * (deck.length - i));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

/**
 * Advance to the next move and update the current player in the given card game.
 *
 * @param cardGame Ongoing card game
 */
export function advanceMove(cardGame: OngoingCardGame) {
  // We can't go to the next player if there are no active players:
  if (cardGame.activePlayers.length === 0) {
    return;
  }
  do {
    if (cardGame.playerDirection) {
      cardGame.currentPlayerIdx += 1;
      if (cardGame.currentPlayerIdx === cardGame.players.length) {
        cardGame.currentPlayerIdx = 0;
      }
    } else {
      cardGame.currentPlayerIdx -= 1;
      if (cardGame.currentPlayerIdx < 0) {
        cardGame.currentPlayerIdx = cardGame.players.length - 1;
      }
    }
  } while (!cardGame.activePlayers.some(n => n === cardGame.currentPlayerIdx));
}

/**
 * If there is only one player left in the game,
 * add that player to the winners list to end the game.
 *
 * @param cardGame Ongoing card game
 * @param callback Function to call if game ended
 */
export function updateIfGameEnded(
  cardGame: OngoingCardGame,
  callback: (cardGame: OngoingCardGame) => void,
) {
  if (cardGame.activePlayers.length === 1) {
    cardGame.winners.push(cardGame.activePlayers[0]);
    cardGame.activePlayers = [];
    callback(cardGame);
  }
}

/**
 * Draw a card from the deck and add it to the current player's hand.
 *
 * @param cardGame Ongoing card game
 * @throws Error if discard pile is empty
 */
export function drawCard(cardGame: OngoingCardGame) {
  if (cardGame.deck.length === 0) {
    const newDeck = cardGame.discardPile.slice(0, -1);
    shuffleCards(newDeck);
    cardGame.deck = newDeck;
    const newCard = cardGame.discardPile.at(-1);
    if (newCard === undefined) {
      throw new Error('Discard pile is empty');
    }
    cardGame.discardPile = [newCard];
  }
  // If deck is still empty after the above operation,
  // just make the draw card operation do nothing:
  if (cardGame.deck.length !== 0) {
    cardGame.hands[cardGame.currentPlayerIdx].push(cardGame.deck[0]);
    // populates the cardsDrawnDuringGame so we know the card that a player draws during replay
    cardGame.cardsDrawnDuringGame.push(cardGame.deck[0]);
    cardGame.deck.splice(0, 1);
  }
}

/**
 * Play a draw move for the current player by drawing the appropriate number of cards
 * and then advance to the next player.
 *
 * @param cardGame Ongoing card game
 */
export function playDrawMove(cardGame: OngoingCardGame) {
  const numDraws = cardGame.lastDrawPlayed || 1;
  for (let i = 0; i < numDraws; i += 1) {
    drawCard(cardGame);
  }
  cardGame.lastDrawPlayed = undefined;
  advanceMove(cardGame);
}

/**
 * Plays the given move in the given card game.
 *
 * @param gameId Ongoing card game
 * @param move Move to play
 * @param callback Function to call if game ended
 * @throw Error if move could not be played
 */
export function playMove(
  cardGame: OngoingCardGame,
  move: PlayableMove,
  callback: (cardGame: OngoingCardGame) => void,
) {
  const activeIdx = cardGame.activePlayers.findIndex(n => n === cardGame.currentPlayerIdx);
  if (move.type === DRAW) {
    playDrawMove(cardGame);
  } else {
    if (move.card === undefined) {
      throw new Error('Must specify the card being played');
    }
    if (cardGame.lastDrawPlayed !== undefined) {
      throw new Error('Card game requires that draw be played');
    }
    const curHand = cardGame.hands[cardGame.currentPlayerIdx];
    const curCard = curHand[move.card];
    if (curCard.type === WILD || curCard.type === WILD_DRAW_FOUR) {
      if (move.color === undefined) {
        throw new Error('Tried to play wild card without specifying color');
      }
      cardGame.currentColor = move.color;
    } else if (curCard.color !== cardGame.currentColor) {
      throw new Error('Tried to play card with different color than current color');
    }
    curHand.splice(move.card, 1);
    cardGame.hands[cardGame.currentPlayerIdx] = curHand;
    cardGame.discardPile.push(curCard);

    if (curHand.length === 0) {
      cardGame.winners.push(cardGame.currentPlayerIdx);
      cardGame.activePlayers.splice(activeIdx, 1);
      updateIfGameEnded(cardGame, callback);
    }
    if (curCard.type === REVERSE) {
      // Reverse is like Skip in 2-player games
      if (cardGame.activePlayers.length === 2) {
        advanceMove(cardGame);
      } else {
        cardGame.playerDirection = !cardGame.playerDirection;
      }
    }
    if (curCard.type === SKIP) {
      advanceMove(cardGame);
    }
    if (curCard.type === DRAW_TWO || curCard.type === WILD_DRAW_FOUR) {
      cardGame.lastDrawPlayed = curCard.type === DRAW_TWO ? 2 : 4;
    }
    advanceMove(cardGame);
  }
}

/**
 * Removes the given player from the given ongoing card game.
 *
 * @param cardGame Ongoing card game.
 * @param playerId ID of player to quit the card game.
 * @param callback Function to call if game ended.
 * @throw Error if player can not quit the game.
 */
export function quitCardGame(
  cardGame: OngoingCardGame,
  playerId: string | undefined,
  callback: (cardGame: OngoingCardGame) => void,
) {
  const playerIdx = cardGame.players.findIndex(p => p.playerId === playerId);
  const activeIdx = cardGame.activePlayers.findIndex(n => n === playerIdx);
  if (activeIdx === -1) {
    throw new Error('Can not quit card game if player is not active player in this card game');
  }
  cardGame.activePlayers.splice(activeIdx, 1);
  cardGame.moves.push({
    playerId: cardGame.players[playerIdx].playerId,
    timestamp: Date.now(),
    move: { type: 'quit' },
  });
  updateIfGameEnded(cardGame, callback);
  if (playerIdx === cardGame.currentPlayerIdx) {
    advanceMove(cardGame);
  }
}
