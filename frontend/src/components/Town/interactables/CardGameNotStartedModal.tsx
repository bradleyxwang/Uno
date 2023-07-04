import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  useToast,
} from '@chakra-ui/react';
import React, { useCallback } from 'react';
import './style.css';
import BetterButton from './BetterButton';
import RoundButton from './RoundButton';
import { useNonStartedGames, useOngoingGames } from '../../../classes/CardGameAreaController';
import { useCardGameAreaController } from '../../../classes/TownController';
import useTownController from '../../../hooks/useTownController';
import { MAX_PLAYERS, MIN_PLAYERS, RED } from '../../../generated/common';
import CardGameAreaInteractable from './CardGameArea';
import { handleError } from './util';

export default function CardGameNonStartedModal({
  cardGameArea,
  gameId,
  onStartGame,
  onLeave,
}: {
  cardGameArea: CardGameAreaInteractable;
  gameId: string;
  onStartGame: () => void;
  onLeave: () => void;
}): JSX.Element {
  const coveyTownController = useTownController();
  const cardGameAreaController = useCardGameAreaController(cardGameArea.id);
  const ongoingGames = useOngoingGames(cardGameAreaController);
  if (ongoingGames.some(game => game.id == gameId)) {
    onStartGame();
  }
  const nonStartedGames = useNonStartedGames(cardGameAreaController);
  const curCardGame = nonStartedGames.find(game => game.id == gameId);
  const playerNames = curCardGame?.players.map(id => id.username);
  const toast = useToast();

  const closeModal = useCallback(() => {
    coveyTownController.interactEnd(cardGameArea);
    coveyTownController.unPause();
  }, [coveyTownController, cardGameArea]);

  const startGame = useCallback(
    (color: string | undefined) => {
      const errTitle = 'Unable to start game';
      if (playerNames === undefined) {
        toast({
          title: errTitle,
          description: `Game could not be found!`,
          status: 'error',
        });
        return;
      }
      if (playerNames.length < MIN_PLAYERS) {
        toast({
          title: errTitle,
          description: `A game must have at least ${MIN_PLAYERS} players before it can start`,
          status: 'error',
        });
        return;
      }
      if (playerNames.length > MAX_PLAYERS) {
        toast({
          title: errTitle,
          description: `A game can not have more than ${MAX_PLAYERS} players`,
          status: 'error',
        });
        return;
      }
      handleError(
        coveyTownController
          .startCardGame(cardGameAreaController, gameId, color)
          .then(() => onStartGame()),
        toast,
        errTitle,
      );
    },
    [toast, coveyTownController, cardGameAreaController, onStartGame, gameId, playerNames],
  );

  const leaveGame = useCallback(() => {
    handleError(
      coveyTownController.leaveNonStartedCardGame(cardGameAreaController, gameId).then(onLeave),
      toast,
      'Unable to leave game',
    );
  }, [coveyTownController, cardGameAreaController, toast, onLeave, gameId]);

  return (
    <Modal isOpen={true} onClose={closeModal}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Waiting for Card Game to Start ...</ModalHeader>
        <ul>
          PLAYERS:{' '}
          {playerNames?.map((name, idx) => (
            <li key={idx}>{name}</li>
          ))}
        </ul>
        <div className='container'>
          <div className='row'>
            <BetterButton
              border='dashed'
              color='green'
              height='30px'
              onClick={() => startGame(undefined)}
              width='220px'>
              Normal Deck
            </BetterButton>{' '}
            <BetterButton
              border='dashed'
              color='orange'
              height='30px'
              onClick={() => startGame(RED)}
              width='220px'>
              Red Deck
            </BetterButton>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <RoundButton
            border='dotted'
            color='red'
            height='30px'
            onClick={leaveGame}
            radius='50%'
            width='50px'>
            BACK
          </RoundButton>
        </div>
        <ModalCloseButton />
      </ModalContent>
    </Modal>
  );
}
