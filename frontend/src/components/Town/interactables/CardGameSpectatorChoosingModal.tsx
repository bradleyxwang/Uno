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
import { useOngoingGames } from '../../../classes/CardGameAreaController';
import { useCardGameAreaController } from '../../../classes/TownController';
import useTownController from '../../../hooks/useTownController';
import CardGameAreaInteractable from './CardGameArea';

export default function CardGameSpectatorChoosingModal({
  cardGameArea,
  onChooseGame,
  onLeave,
}: {
  cardGameArea: CardGameAreaInteractable;
  onChooseGame: (gameId: string) => void;
  onLeave: () => void;
}): JSX.Element {
  const coveyTownController = useTownController();
  const cardGameAreaController = useCardGameAreaController(cardGameArea.id);
  const cardGames = useOngoingGames(cardGameAreaController);
  const toast = useToast();

  const closeModal = useCallback(() => {
    coveyTownController.interactEnd(cardGameArea);
    coveyTownController.unPause();
  }, [coveyTownController, cardGameArea]);

  const spectateGame = useCallback(
    game => {
      if (
        coveyTownController.ourPlayer.googleEmail &&
        game.activePlayers.find(
          (n: number) => game.players[n].playerId === coveyTownController.ourPlayer.googleEmail,
        )
      ) {
        toast({
          title: 'Cannot spectate game',
          description: `You are already in this game!`,
          status: 'error',
        });
      } else {
        coveyTownController
          .spectateCardGame(cardGameAreaController, game.id)
          .then(() => onChooseGame(game.id));
      }
    },
    [toast, coveyTownController, cardGameAreaController, onChooseGame],
  );

  return (
    <Modal isOpen={true} onClose={closeModal}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Choosing a Game to Spectate</ModalHeader>
        {/* Only show card games which are actually ongoing,
            i.e. those which still have active players */}
        {cardGames
          .filter(cardGame => cardGame.activePlayers.length > 0)
          .map((game, idx) => {
            return (
              <Button
                key={idx}
                colorScheme='orange'
                border='dotted'
                width='350px'
                height='30px'
                mr={3}
                onClick={() => spectateGame(game)}>
                Spectate Game Started by {game.players[0].username}
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
