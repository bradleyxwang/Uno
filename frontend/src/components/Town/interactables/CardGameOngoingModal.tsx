import {
  Box,
  Button,
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  ToastId,
  useToast,
} from '@chakra-ui/react';
import React, { useCallback, useEffect, useState } from 'react';
import RoundButton from './RoundButton';
import { useOngoingGames } from '../../../classes/CardGameAreaController';
import PlayerController from '../../../classes/PlayerController';
import { useCardGameAreaController, usePlayers } from '../../../classes/TownController';
import {
  ALL_CARD_COLORS,
  DRAW,
  MOVE_TIMEOUT,
  PLAY,
  WILD,
  WILD_DRAW_FOUR,
} from '../../../generated/common';
import useTownController from '../../../hooks/useTownController';
import { PlayableMove } from '../../../types/CoveyTownSocket';
import CardGameAreaInteractable from './CardGameArea';
import {
  displayActivePlayersAndWinners,
  displayUserCurrentHand,
  displayCurrentTurnInfo,
  displayMove,
  handleError,
  useActivePlayers,
  useEloRatingChanges,
  useWinners,
  displayPreviousMove,
  calcLastDrawPlayed,
} from './util';

export default function CardGameOngoingModal({
  cardGameArea,
  gameId,
  onLeave,
}: {
  cardGameArea: CardGameAreaInteractable;
  gameId: string;
  onLeave: () => void;
}): JSX.Element {
  const coveyTownController = useTownController();
  const cardGameAreaController = useCardGameAreaController(cardGameArea.id);
  const cardGames = useOngoingGames(cardGameAreaController);
  const curCardGame = cardGames.find(game => game.id == gameId);
  const players = usePlayers();
  const playerNames = curCardGame?.players.map(id => id.username);
  const spectatorNames = curCardGame?.spectators.map(id =>
    PlayerController.nameFromId(players, id),
  );

  const curPlayerId = coveyTownController.ourPlayer.googleEmail;
  const curPlayerIdx = curCardGame?.players.findIndex(id => id.playerId === curPlayerId);
  // NOTE: It is possible for a user to be both in curCardGame.players and curCardGame.spectators
  // if they quit the game and then start spectating the game.
  // In this case, the user is treated as a spectator, not a player.
  // Moreover, usually, the player ID will either be in curCardGame.players or curCardGame.spectators,
  // but when the spectator first transitions to this modal,
  // the ongoing game from the backend may not have been synced with the frontend yet,
  // in which case the player ID will not be in curCardGame.spectators,
  // which is why we also mark the player as a spectator if they are not in curCardGame.players.
  const isSpectator =
    curCardGame?.spectators.some(id => id === coveyTownController.ourPlayer.id) ||
    !curCardGame?.players.some(id => id.playerId === curPlayerId);
  const toast = useToast();

  const [prevSpectators, setPrevSpectators] = useState<string[]>(curCardGame?.spectators || []);
  useEffect(() => {
    const curSpectators = curCardGame?.spectators || [];
    if (prevSpectators !== curSpectators) {
      for (const id of prevSpectators) {
        if (!curSpectators.some(p => p === id)) {
          toast({
            title: 'Lost spectator',
            description: `${PlayerController.nameFromId(players, id)} stopped spectating`,
            status: 'success',
          });
        }
      }
      for (const id of curSpectators) {
        if (!prevSpectators.some(p => p === id)) {
          toast({
            title: 'New spectator!',
            description: `${PlayerController.nameFromId(players, id)} started spectating`,
            status: 'success',
          });
        }
      }
      setPrevSpectators(curSpectators);
    }
  }, [players, toast, curCardGame, prevSpectators, setPrevSpectators]);

  useActivePlayers(toast, curCardGame, playerNames);
  useWinners(toast, curCardGame, playerNames);
  useEloRatingChanges(toast, curCardGame);

  const [lastToastId, setLastToastId] = useState<ToastId | undefined>(undefined);
  const [movesNotified, setMovesNotified] = useState<number>(curCardGame?.moves.length || 0);
  useEffect(() => {
    if (curCardGame !== undefined && curCardGame.moves.length > movesNotified) {
      const playerId = curCardGame.moves[curCardGame.moves.length - 1].playerId;
      const playerName =
        curCardGame.players.find(p => p.playerId === playerId)?.username || 'unknown player';
      const topOfDiscardPile = curCardGame.discardPile.at(-1);
      if (topOfDiscardPile !== undefined) {
        // Condition should never be false, needed for typechecking
        const moveDesc = displayPreviousMove(
          curCardGame.moves[curCardGame.moves.length - 1].move,
          topOfDiscardPile,
          calcLastDrawPlayed(curCardGame),
          playerName,
        );
        if (moveDesc !== undefined) {
          if (lastToastId !== undefined) {
            toast.close(lastToastId);
          }
          const [moveDescTitle, moveDescDesc] = moveDesc;
          setLastToastId(
            toast({
              title: moveDescTitle,
              description: moveDescDesc,
              status: 'success',
            }),
          );
        }
      }
      setMovesNotified(curCardGame.moves.length);
    }
  }, [curCardGame, toast, lastToastId, movesNotified]);

  const closeModal = useCallback(() => {
    coveyTownController.interactEnd(cardGameArea);
    coveyTownController.unPause();
  }, [coveyTownController, cardGameArea]);

  const moveDeadline = curCardGame
    ? curCardGame.moves[curCardGame.moves.length - 1].timestamp + MOVE_TIMEOUT
    : Date.now() + MOVE_TIMEOUT;
  const [timedOut, setTimedOut] = useState<boolean>(Date.now() > moveDeadline);
  useEffect(() => {
    const timeToWait = moveDeadline - Date.now();
    if (timeToWait < 0) {
      setTimedOut(true);
      return;
    }
    setTimedOut(false);
    const id = setTimeout(() => {
      setTimedOut(true);
    }, moveDeadline - Date.now());
    return () => {
      clearTimeout(id);
    };
  }, [moveDeadline]);

  const possibleMoves: PlayableMove[] = [];

  const playMove = (idx: number) => {
    const curMove = possibleMoves[idx];
    handleError(
      coveyTownController.cardGamePlayMove(cardGameAreaController, gameId, curMove),
      toast,
      'Unable to play move',
    );
  };

  const quitGame = useCallback(() => {
    if (curCardGame?.activePlayers.some(n => n === curPlayerIdx)) {
      handleError(
        coveyTownController.quitOngoingCardGame(cardGameAreaController, gameId).then(onLeave),
        toast,
        'Unable to quit game',
      );
    } else {
      onLeave();
    }
  }, [
    coveyTownController,
    cardGameAreaController,
    gameId,
    onLeave,
    toast,
    curCardGame,
    curPlayerIdx,
  ]);

  const skipGame = useCallback(() => {
    handleError(
      coveyTownController.cardGameSkipMove(cardGameAreaController, gameId),
      toast,
      'Unable to skip turn',
    );
  }, [coveyTownController, cardGameAreaController, gameId, toast]);

  const stopSpectatingCardGame = useCallback(() => {
    handleError(
      coveyTownController.stopSpectatingCardGame(cardGameAreaController, gameId).then(onLeave),
      toast,
      'Unable to stop spectating game',
    );
  }, [coveyTownController, cardGameAreaController, gameId, onLeave, toast]);

  if (
    curCardGame === undefined ||
    curPlayerIdx === undefined ||
    playerNames === undefined ||
    spectatorNames === undefined
  ) {
    return (
      <Modal isOpen={true} onClose={closeModal}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Error: Unknown game</ModalHeader>
        </ModalContent>
      </Modal>
    );
  }

  const gameOngoing = curCardGame.activePlayers.length > 0;
  if (gameOngoing && curCardGame.players[curCardGame.currentPlayerIdx].playerId === curPlayerId) {
    if (curCardGame.lastDrawPlayed === undefined) {
      for (let i = 0; i < curCardGame.hands[curPlayerIdx].length; i += 1) {
        const card = curCardGame.hands[curPlayerIdx][i];
        if (card.type == WILD || card.type == WILD_DRAW_FOUR) {
          for (const color of ALL_CARD_COLORS) {
            possibleMoves.push({
              type: PLAY,
              card: i,
              color,
            });
          }
        } else if (curCardGame.currentColor === card.color) {
          possibleMoves.push({
            type: PLAY,
            card: i,
          });
        }
      }
    }
    if (possibleMoves.length === 0) {
      possibleMoves.push({
        type: DRAW,
      });
    }
  }

  return (
    <Modal isOpen={true} onClose={closeModal}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Playing UNO Game</ModalHeader>
        <Box>Players: {playerNames.join(', ')}</Box>
        <Box>Spectators: {spectatorNames.join(', ')}</Box>
        {displayActivePlayersAndWinners(curCardGame, playerNames)}
        <Box>╚══ ≪ °❈° ≫ ══╝</Box>
        {curCardGame.hands.map(
          (hand, idx) =>
            (isSpectator || curCardGame.players[idx].playerId !== curPlayerId) && (
              <Box key={`hand-${idx}`}>
                {playerNames[idx]}&apos;s Hand: {hand.map(() => '▮').join()}
              </Box>
            ),
        )}
        <Box>╚══ ≪ °❈° ≫ ══╝</Box>
        {!isSpectator && displayUserCurrentHand('Your', curCardGame.hands[curPlayerIdx])}
        <div className='wrapper'>
          {possibleMoves.map((move, idx) => (
            <Button
              key={`button-${idx}`}
              colorScheme='orange'
              border='dotted'
              height='30px'
              width='200px'
              mr={3}
              onClick={() => playMove(idx)}>
              {displayMove(
                move,
                curCardGame.hands[curCardGame.currentPlayerIdx],
                curCardGame.lastDrawPlayed,
              )}
            </Button>
          ))}
        </div>
        <Box>╚══ ≪ °❈° ≫ ══╝</Box>
        {displayCurrentTurnInfo(curCardGame, playerNames)}
        {/* Only display skip button if game is not over
            and this player is not the current player whose turn it is
            and the current player whose turn it is has timed out */}
        {gameOngoing && curPlayerIdx !== curCardGame.currentPlayerIdx && timedOut && (
          <Button
            colorScheme='orange'
            border='dotted'
            height='30px'
            width='300px'
            mr={3}
            onClick={skipGame}>
            Skip {playerNames[curCardGame.currentPlayerIdx]}&apos;s Turn
          </Button>
        )}
        {!isSpectator && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <RoundButton
              border='dotted'
              color='red'
              height='30px'
              onClick={quitGame}
              radius='50%'
              width='50px'>
              BACK
            </RoundButton>
          </div>
        )}
        {isSpectator && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <RoundButton
              border='dotted'
              color='red'
              height='30px'
              onClick={stopSpectatingCardGame}
              radius='50%'
              width='50px'>
              BACK
            </RoundButton>
          </div>
        )}
        <ModalCloseButton />
      </ModalContent>
    </Modal>
  );
}
