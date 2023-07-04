import React, { useEffect, useState } from 'react';
import { Box, useToast } from '@chakra-ui/react';
import { FlatList } from 'react-native';
import { EloRatingChange } from '../../../generated/client';
import { BasicMove, Card, OngoingCardGame, PlayableMove } from '../../../types/CoveyTownSocket';
import { DRAW_TWO, QUIT, RECEIVE_HAND, SKIP, WILD_DRAW_FOUR } from '../../../generated/common';

const SUFFIX = 'px';

/**
 * Display a toast if the given promise errors.
 *
 * @param prom Promise which may error.
 * @param toast Object used to create toasts.
 * @param errTitle Title of error message.
 */
export function handleError<T>(
  prom: Promise<T>,
  toast: ReturnType<typeof useToast>,
  errTitle: string,
) {
  prom.catch(err => {
    if (err instanceof Error) {
      toast({
        title: errTitle,
        description: err.toString(),
        status: 'error',
      });
    } else {
      console.trace(err);
      toast({
        title: errTitle,
        status: 'error',
      });
    }
  });
}

/**
 * Creates a string representation of a card.
 *
 * @param card Card to display
 * @returns String representing card
 */
export function displayCard(card: Card): string {
  if (card.type === 'number') {
    return `${card.color} ${card.value}`;
  }
  if (card.type === 'draw_two') {
    return `${card.color} draw two`;
  }
  if (card.type === 'reverse') {
    return `${card.color} reverse`;
  }
  if (card.type === 'skip') {
    return `${card.color} skip`;
  }
  if (card.type === 'wild') {
    return 'wild card';
  }
  return 'wild draw four';
}

/**
 * Returns the proper value or text of a card.
 *
 * @param card Card to display
 * @returns String representing value or text
 */
export function displayText(card: Card): string {
  if (card.type === 'number') {
    return `${card.value}`;
  }
  if (card.type === 'draw_two') {
    return `draw two`;
  }
  if (card.type === 'reverse') {
    return `reverse`;
  }
  if (card.type === 'skip') {
    return `skip`;
  }
  if (card.type === 'wild') {
    return 'wild card';
  }
  return 'wild draw four';
}

/**
 * Display a Card as an element in React
 *
 * @param card Card to display
 * @returns React element representing card
 */
export function displayCardAsJSX(card: Card): JSX.Element {
  // NOTE: This function is very repetitive,
  // but any attempt we made to abstract out the common differences
  // between these different return statements led to the error
  // "Error: The `style` prop expects a mapping from style properties to values, not a string."
  // so we kept the function as is.
  if (card.type !== 'wild' && card.type !== 'wild_draw_four') {
    if (card.color === 'red') {
      return (
        <Box
          style={{
            backgroundColor: '#FF0000',
            borderColor: '#000000',
            borderWidth: '5px',
            margin: `10${SUFFIX}`,
            width: `65${SUFFIX}`,
            textAlign: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            height: `100${SUFFIX}`,
          }}>
          <div style={{ color: '#F5F5F5' }}>{displayText(card)}</div>
        </Box>
      );
    }
    if (card.color === 'blue') {
      return (
        <Box
          style={{
            backgroundColor: '#0000FF',
            borderColor: '#000000',
            borderWidth: '5px',
            margin: `10${SUFFIX}`,
            width: `65${SUFFIX}`,
            textAlign: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            height: `100${SUFFIX}`,
          }}>
          <div style={{ color: '#F5F5F5' }}>{displayText(card)}</div>
        </Box>
      );
    }
    if (card.color === 'green') {
      return (
        <Box
          style={{
            backgroundColor: '#00FF00',
            borderColor: '#000000',
            borderWidth: '5px',
            margin: `10${SUFFIX}`,
            width: `65${SUFFIX}`,
            textAlign: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            height: `100${SUFFIX}`,
          }}>
          <div style={{ color: '#F5F5F5' }}>{displayText(card)}</div>
        </Box>
      );
    }
    if (card.color === 'yellow') {
      return (
        <Box
          style={{
            backgroundColor: '#FCD12A',
            borderColor: '#000000',
            borderWidth: '5px',
            margin: `10${SUFFIX}`,
            width: `65${SUFFIX}`,
            textAlign: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            height: `100${SUFFIX}`,
          }}>
          <div style={{ color: '#F5F5F5' }}>{displayText(card)}</div>
        </Box>
      );
    }
  }
  return (
    <Box
      style={{
        backgroundColor: '#000000',
        margin: `10${SUFFIX}`,
        width: `65${SUFFIX}`,
        textAlign: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        height: `100${SUFFIX}`,
      }}>
      <div style={{ color: '#F5F5F5' }}>{displayText(card)}</div>
    </Box>
  );
}

/**
 * Creates a string representation of a move
 * to be displayed to the current user when they are choosing a move.
 *
 * @param move Move to display
 * @param hand Hand of the current player
 * @param lastDrawPlayed Number of cards the player must draw,
 *                       if the last card played was a draw card.
 * @returns String representing move
 */
export function displayMove(
  move: PlayableMove,
  hand: Card[],
  lastDrawPlayed: number | undefined,
): string {
  if (move.type) {
    if (lastDrawPlayed === undefined) {
      return `Draw a card!`;
    }
    return `Draw ${lastDrawPlayed} cards!`;
  }
  if (move.card === undefined) {
    return `Play unknown card!`;
  }
  if (move.color === undefined) {
    return `Play ${displayCard(hand[move.card])}!`;
  }
  return `Play ${move.color} ${displayCard(hand[move.card])}!`;
}

/**
 * Creates a string representation of a move that has already been played
 * to display in toast messages to other users.
 *
 * @param move Move to display
 * @param handOrCardPlayed If single card, then the top of discard pile after this move was played
 *                         If array of cards, hand of the current player
 * @param lastDrawPlayed Number of cards the player must draw,
 *                       if the last card played was a draw card.
 * @param playerName Name of the player who made the move
 * @returns String representing move,
 *          or undefined if this move represents a user quitting or receiving a hand,
 *          or this move could not be described in a string due to an undefined card number
 */
export function displayPreviousMove(
  move: BasicMove,
  handOrCardPlayed: Card | Card[],
  lastDrawPlayed: number | undefined,
  playerName: string,
): [string, string] | undefined {
  const drawString = lastDrawPlayed ? `${lastDrawPlayed} cards` : 'a card';
  if (move.type === SKIP) {
    return [`${playerName}'s turn was skipped!`, `${playerName} drew ${drawString}`];
  }
  if (move.type === QUIT || move.type === RECEIVE_HAND) {
    return undefined;
  }
  if (move.type) {
    return [`${playerName} made a move!`, `${playerName} drew ${drawString}`];
  }
  if (move.card === undefined) {
    return undefined;
  }
  if (Array.isArray(handOrCardPlayed)) {
    return [
      `${playerName} made a move!`,
      `${playerName} played ${displayCard(handOrCardPlayed[move.card])}`,
    ];
  }
  return [`${playerName} made a move!`, `${playerName} played ${displayCard(handOrCardPlayed)}`];
}

/**
 * Calculate the lastDrawPlayed property of the given card game
 * before the last move was played.
 *
 * @param cardGame Ongoing card game
 * @return Value of last draw played in the given card game before the last move,
 *         or undefined if the move before the last move was not a draw card.
 */
export function calcLastDrawPlayed(cardGame: OngoingCardGame): number | undefined {
  // If last non-quit non-receive hand move was skip/draw,
  // then lastDrawPlayed must have been undefined
  // Otherwise, if last non-quit non-receive hand move was an actual card,
  // then lastDrawPlayed must have been determined by discard card
  for (let i = cardGame.moves.length - 2; i >= 0; i -= 1) {
    const moveType = cardGame.moves[i].move.type;
    if (moveType === SKIP || moveType === true) {
      return undefined;
    }
    if (moveType === false) {
      const discardCard = cardGame.discardPile.at(-1);
      if (discardCard?.type === DRAW_TWO) {
        return 2;
      }
      if (discardCard?.type === WILD_DRAW_FOUR) {
        return 4;
      }
      return undefined;
    }
  }
  return undefined;
}

/**
 * Create a React element which displays the active players and winners in the given card game.
 *
 * @param cardGame Card game
 * @param playerNames Names of players in the card game
 * @returns React element showing active players and winners in the card game
 */
export function displayActivePlayersAndWinners(
  cardGame: OngoingCardGame,
  playerNames: string[],
): JSX.Element {
  const gameOngoing = cardGame.activePlayers.length > 0;
  return (
    <>
      {gameOngoing && (
        <Box>Active Players: {cardGame.activePlayers.map(n => playerNames[n]).join(', ')}</Box>
      )}
      {cardGame.winners.length > 0 && <Box>Winners:</Box>}
      {cardGame.winners.length > 0 &&
        cardGame.winners.map((playerIdx, rankIdx) => (
          <Box key={`winner-${playerIdx}`}>
            Rank {rankIdx + 1}: {playerNames[playerIdx]}
          </Box>
        ))}
      <Box></Box>
    </>
  );
}

/**
 * Create a React element which displays the user's current hand in the given card game.
 *
 * @param cardGame Card game
 * @param playerNames Names of players in the card game
 * @returns React element showing user's current hand in the card game
 */
export function displayUserCurrentHand(user: string, deck: Card[]): JSX.Element {
  return (
    <>
      <Box>{user} Hand:</Box>
      <FlatList
        data={deck}
        renderItem={({ item }: { item: Card }) => displayCardAsJSX(item)}
        showsVerticalScrollIndicator={false}
        numColumns={5}
      />
    </>
  );
}

/**
 * Create a React element which displays the current turn info in the given card game.
 *
 * @param cardGame Card game
 * @param playerNames Names of players in the card game
 * @returns React element showing current turn info in the card game
 */
export function displayCurrentTurnInfo(
  cardGame: OngoingCardGame,
  playerNames: string[],
): JSX.Element {
  const gameOngoing = cardGame.activePlayers.length > 0;
  const discardCard = cardGame.discardPile.at(-1);
  return (
    <>
      <div className='container'>
        <div className='row'>
          {discardCard !== undefined && <Box>Top of Discard Pile:</Box>}{' '}
          {discardCard !== undefined && displayCardAsJSX(discardCard)}
          <div className='column'>
            {gameOngoing && <Box>Current Color: {cardGame.currentColor}</Box>}
            {gameOngoing && <Box>{playerNames[cardGame.currentPlayerIdx]}&apos;s Turn</Box>}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Create a React element which displays the given changes in ELO ratings.
 *
 * @param ratingChanges List of changes in ELO ratings for various players
 * @returns React element showing the changes in ELO ratings
 */
function displayEloRatingChanges(ratingChanges: EloRatingChange[]): JSX.Element {
  const standings = [];
  for (let i = 0; i < ratingChanges.length; i++) {
    const newLine = [];
    newLine.push((i + 1).toString() + '. ');
    newLine.push(ratingChanges[i].player.username + ' ');
    newLine.push(ratingChanges[i].prevElo + ' --> ' + ratingChanges[i].newElo);
    standings.push(newLine.join(''));
  }
  return (
    <>
      {standings.map(standing => (
        <>
          {standing}
          <br />{' '}
        </>
      ))}
    </>
  );
}

/**
 * React hook to retrieve the active players in a card game,
 * as well as to display toast messages when players quit from the game.
 *
 * @param toast Object used to display toast messages
 * @param cardGame Card game
 * @param playerNames Names of players in the card game
 * @returns Array of indices representing active players in the card game
 */
export function useActivePlayers(
  toast: ReturnType<typeof useToast>,
  cardGame: OngoingCardGame | undefined,
  playerNames: string[] | undefined,
): number[] {
  const [prevActivePlayers, setActivePlayers] = useState<number[]>([]);
  useEffect(() => {
    const curActivePlayers = cardGame?.activePlayers || [];
    const curWinners = cardGame?.winners || [];
    if (
      playerNames !== undefined &&
      (prevActivePlayers.length !== curActivePlayers.length ||
        curActivePlayers.some((n, idx) => prevActivePlayers[idx] !== n))
    ) {
      for (const id of prevActivePlayers) {
        if (!curActivePlayers.some(n => n === id) && !curWinners.some(n => n === id)) {
          const curName = playerNames[id];
          toast({
            title: `${curName} quit!`,
            description: `${curName} quit the game`,
            status: 'success',
          });
        }
      }
      setActivePlayers([...curActivePlayers]);
    }
  }, [cardGame, toast, prevActivePlayers, playerNames]);
  return prevActivePlayers;
}

/**
 * React hook to retrieve the winners in a card game,
 * as well as to display toast messages when players win or when the game ends.
 *
 * @param toast Object used to display toast messages
 * @param cardGame Card game
 * @param playerNames Names of players in the card game
 * @returns Array of indices representing winners in the card game
 */
export function useWinners(
  toast: ReturnType<typeof useToast>,
  cardGame: OngoingCardGame | undefined,
  playerNames: string[] | undefined,
): number[] {
  const [prevWinners, setWinners] = useState<number[]>([]);
  useEffect(() => {
    const curWinners = cardGame?.winners || [];
    if (
      playerNames !== undefined &&
      (prevWinners.length !== curWinners.length ||
        curWinners.some((n, idx) => prevWinners[idx] !== n))
    ) {
      for (let i = 0; i < curWinners.length; i += 1) {
        if (i >= prevWinners.length || curWinners[i] !== prevWinners[i]) {
          const curName = playerNames[curWinners[i]];
          if (cardGame?.activePlayers.length === 0 && i + 1 === curWinners.length) {
            toast({
              title: `Game is now over!`,
              description: `${curName} placed rank ${i + 1}`,
              status: 'success',
            });
          } else {
            toast({
              title: `${curName} won!`,
              description: `${curName} placed rank ${i + 1}`,
              status: 'success',
            });
          }
        }
      }
      setWinners([...curWinners]);
    }
  }, [cardGame, prevWinners, playerNames, toast]);
  return prevWinners;
}

/**
 * React hook to retrieve the elo rating changes that occurred in a card game,
 * as well as to display toast messages when the elo rating changes occur.
 *
 * @param toast Object used to display toast messages
 * @param cardGame Card game
 * @returns Array representing the change in ELO rating of the players in the card game
 */
export function useEloRatingChanges(
  toast: ReturnType<typeof useToast>,
  cardGame: OngoingCardGame | undefined,
): EloRatingChange[] {
  const [eloRatingChanges, setEloRatingChanges] = useState<EloRatingChange[]>([]);
  useEffect(() => {
    const newEloRatingChanges = cardGame?.eloRatingChanges || [];
    if (eloRatingChanges.length == 0 && newEloRatingChanges.length != 0) {
      toast({
        title: `Final Standings`,
        description: displayEloRatingChanges(newEloRatingChanges),
        status: 'success',
      });
      setEloRatingChanges([...newEloRatingChanges]);
    }
  }, [cardGame, eloRatingChanges, toast]);
  return eloRatingChanges;
}
