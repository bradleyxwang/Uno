import { Box, Modal, ModalContent, ModalHeader, ModalOverlay, useToast } from '@chakra-ui/react';
import React, { useCallback, useState } from 'react';
import RoundButton from './RoundButton';
import BetterButton from './BetterButton';
import {
  DRAW_TWO,
  playDrawMove,
  playMove,
  quitCardGame,
  RECEIVE_HAND,
  REVERSE,
  SKIP,
  QUIT,
} from '../../../generated/common';
import useTownController from '../../../hooks/useTownController';
import { MatchHistory, OngoingCardGame } from '../../../types/CoveyTownSocket';
import CardGameAreaInteractable from './CardGameArea';
import {
  displayActivePlayersAndWinners,
  displayUserCurrentHand,
  displayCurrentTurnInfo,
  useActivePlayers,
  useEloRatingChanges,
  useWinners,
  displayPreviousMove,
} from './util';

export default function CardGameReplayGameModal({
  cardGameArea,
  matchHistory,
  onLeave,
}: {
  cardGameArea: CardGameAreaInteractable;
  matchHistory: MatchHistory;
  onLeave: () => void;
}): JSX.Element {
  const coveyTownController = useTownController();
  const toast = useToast();

  const initializeCardGame = useCallback(() => {
    if (!('color' in matchHistory.startingTopCardDiscardPile)) {
      return;
    }
    // At the beginning all players are active:
    const activePlayers = [];
    for (let i = 0; i < matchHistory.players.length; i += 1) {
      activePlayers.push(i);
    }
    const playerDirection = matchHistory.startingTopCardDiscardPile.type !== REVERSE;
    let currentPlayerIdx = 0;
    if (
      matchHistory.startingTopCardDiscardPile.type === SKIP ||
      matchHistory.startingTopCardDiscardPile.type === DRAW_TWO
    ) {
      currentPlayerIdx = 1;
    }
    return {
      id: 'replayed_game',
      players: matchHistory.playingOrder.map(playerId => {
        return {
          playerId,
          username:
            matchHistory.players.find(p => p.player.playerId === playerId)?.player.username || '',
        };
      }),
      activePlayers,
      spectators: [],
      winners: [],
      hands: matchHistory.initialHands,
      moves: [],
      deck: matchHistory.cardsDrawnDuringGame,
      discardPile: [matchHistory.startingTopCardDiscardPile],
      currentColor: matchHistory.startingTopCardDiscardPile.color,
      currentPlayerIdx,
      playerDirection,
      prevEloRatings: [],
      eloRatingChanges: [],
      cardsDrawnDuringGame: [],
      startingTopCardDiscardPile: matchHistory.startingTopCardDiscardPile,
      initialHands: matchHistory.initialHands,
      startTime: Date.now(),
    };
  }, [matchHistory]);

  const [cardGame, setCardGame] = useState<OngoingCardGame | undefined>(initializeCardGame);
  const playerNames = cardGame?.players.map(id => id.username);

  const initializeMoveIdx = useCallback(() => {
    for (let moveIdx = 0; moveIdx < matchHistory.events.length; moveIdx += 1) {
      if (matchHistory.events[moveIdx].move.type !== RECEIVE_HAND) {
        return moveIdx;
      }
    }
    return matchHistory.events.length;
  }, [matchHistory]);

  const [moveIdx, setMoveIdx] = useState<number>(initializeMoveIdx);

  useActivePlayers(toast, cardGame, playerNames);
  useWinners(toast, cardGame, playerNames);
  useEloRatingChanges(toast, cardGame);

  const moveError = useCallback(
    (desc: string) => {
      toast({
        title: 'Could not replay next move',
        description: desc,
        status: 'error',
      });
    },
    [toast],
  );

  const updateEloRatingChanges = useCallback(() => {
    if (cardGame === undefined) {
      //Needed for typechecking
      return;
    }
    cardGame.eloRatingChanges = matchHistory.players;
    setCardGame({ ...cardGame });
  }, [matchHistory, cardGame]);

  const [lastMoveDesc, setLastMoveDesc] = useState<string[]>([]);

  const nextMove = useCallback(() => {
    if (cardGame === undefined) {
      //Needed for typechecking
      moveError('Card game was undefined!');
      return;
    }
    const curMove = matchHistory.events[moveIdx];
    const curPlayerName = matchHistory.players.find(p => p.player.playerId === curMove.playerId)
      ?.player.username;
    if (curPlayerName === undefined) {
      //Needed for typechecking
      moveError('Player name was undefined!');
      return;
    }
    const moveDesc = displayPreviousMove(
      curMove.move,
      cardGame.hands[cardGame.currentPlayerIdx],
      cardGame.lastDrawPlayed,
      curPlayerName,
    );
    if (moveDesc !== undefined) {
      setLastMoveDesc(moveDesc);
    }
    if (curMove.move.type === SKIP) {
      playDrawMove(cardGame);
    } else if (curMove.move.type === QUIT) {
      quitCardGame(cardGame, curMove.playerId, updateEloRatingChanges);
    } else if (curMove.move.type !== RECEIVE_HAND) {
      playMove(cardGame, curMove.move, updateEloRatingChanges);
    }
    setCardGame({ ...cardGame });
    setMoveIdx(moveIdx + 1);
  }, [matchHistory, cardGame, moveIdx, moveError, updateEloRatingChanges]);

  const closeModal = useCallback(() => {
    coveyTownController.interactEnd(cardGameArea);
    coveyTownController.unPause();
  }, [coveyTownController, cardGameArea]);

  // Should never happen, but needed in order for TypeScript to typecheck
  if (cardGame === undefined || playerNames === undefined) {
    return (
      <Modal isOpen={true} onClose={closeModal}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Replaying UNO Game</ModalHeader>
          <Box>Failed to render UNO game</Box>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal isOpen={true} onClose={closeModal}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Replaying UNO Game</ModalHeader>
        <Box>Players: {playerNames.join(', ')}</Box>
        {displayActivePlayersAndWinners(cardGame, playerNames)}
        <Box>╚══ ≪ °❈° ≫ ══╝</Box>
        {cardGame.hands.map((hand, handIdx) => (
          <Box key={`hand-${handIdx}`}>
            {displayUserCurrentHand(playerNames[handIdx] + "'s", hand)}
          </Box>
        ))}
        <Box>╚══ ≪ °❈° ≫ ══╝</Box>
        {displayCurrentTurnInfo(cardGame, playerNames)}
        {lastMoveDesc.length > 0 && <Box>Last Move Played:</Box>}
        {lastMoveDesc.map((s, idx) => (
          <Box key={`move-${idx}`}>{s}</Box>
        ))}
        {moveIdx < matchHistory.events.length && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <BetterButton
              border='dotted'
              color='green'
              height='30px'
              onClick={nextMove}
              width='130px'>
              Play Next Move
            </BetterButton>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <RoundButton
            border='dotted'
            color='red'
            height='30px'
            onClick={onLeave}
            radius='50%'
            width='50px'>
            BACK
          </RoundButton>
        </div>
      </ModalContent>
    </Modal>
  );
}
