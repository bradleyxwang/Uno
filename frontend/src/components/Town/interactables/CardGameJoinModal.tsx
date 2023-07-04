import {
  Button,
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  useToast,
} from '@chakra-ui/react';
import React, { useCallback } from 'react';
import RoundButton from './RoundButton';
import { useNonStartedGames } from '../../../classes/CardGameAreaController';
import { useCardGameAreaController } from '../../../classes/TownController';
import useTownController from '../../../hooks/useTownController';
import CardGameAreaInteractable from './CardGameArea';
import { CardGamePlayer } from '../../../types/CoveyTownSocket';

export default function CardGameJoinModal({
  cardGameArea,
  onJoinGame,
  onLeave,
}: {
  cardGameArea: CardGameAreaInteractable;
  onJoinGame: (gameId: string) => void;
  onLeave: () => void;
}): JSX.Element {
  const coveyTownController = useTownController();
  const cardGameAreaController = useCardGameAreaController(cardGameArea.id);
  const cardGames = useNonStartedGames(cardGameAreaController);
  const toast = useToast();

  const closeModal = useCallback(() => {
    coveyTownController.interactEnd(cardGameArea);
    coveyTownController.unPause();
  }, [coveyTownController, cardGameArea]);

  const joinGame = useCallback(
    game => {
      if (
        game.players.find(
          (p: CardGamePlayer) => p.playerId == coveyTownController.ourPlayer.googleEmail,
        )
      ) {
        toast({
          title: 'Cannot join game',
          description: `You are already in this game!`,
          status: 'error',
        });
      } else {
        coveyTownController
          .joinCardGame(cardGameAreaController, game.id)
          .then(() => onJoinGame(game.id));
      }
    },
    [coveyTownController, toast, cardGameAreaController, onJoinGame],
  );

  return (
    <Modal isOpen={true} onClose={closeModal}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Choosing a Card Game to Join</ModalHeader>
        {cardGames.map((game, idx) => {
          return (
            <Button
              key={idx}
              colorScheme='orange'
              border='dotted'
              width='350px'
              height='30px'
              mr={3}
              onClick={() => joinGame(game)}>
              Join Game Started by {game.players[0].username}
            </Button>
          );
        })}
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
        <ModalCloseButton />
      </ModalContent>
    </Modal>
  );
}
