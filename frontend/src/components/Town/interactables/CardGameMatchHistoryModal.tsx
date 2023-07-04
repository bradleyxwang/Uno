import { Box, Modal, ModalContent, ModalHeader, ModalOverlay } from '@chakra-ui/react';
import React, { Fragment, useCallback } from 'react';
import RoundButton from './RoundButton';
import BetterButton from './BetterButton';
import dateFormat from 'dateformat';
import { useMatchHistory } from '../../../classes/TownController';
import useTownController from '../../../hooks/useTownController';
import { CardGamePlayer, MatchHistory } from '../../../types/CoveyTownSocket';
import CardGameAreaInteractable from './CardGameArea';

export default function CardGameMatchHistoryModal({
  cardGameArea,
  player,
  onReplayGame,
  onLeave,
}: {
  cardGameArea: CardGameAreaInteractable;
  player: CardGamePlayer;
  onReplayGame: (cardGame: MatchHistory) => void;
  onLeave: () => void;
}): JSX.Element {
  const coveyTownController = useTownController();
  const matchHistory = useMatchHistory(player.playerId);

  const closeModal = useCallback(() => {
    coveyTownController.interactEnd(cardGameArea);
    coveyTownController.unPause();
  }, [coveyTownController, cardGameArea]);

  function displayGame(game: MatchHistory, gameIdx: number): JSX.Element {
    const playerIdx = game.players.findIndex(
      gamePlayer => gamePlayer.player.playerId === player.playerId,
    );
    // Do not display this game if this player did not actually play in the game
    if (playerIdx === -1) {
      return <></>;
    }
    return (
      <Fragment key={`game-${gameIdx}`}>
        <Box>Game from {dateFormat(new Date(game.startTime), 'mmmm dS, yyyy, h:MM TT Z')}</Box>
        {/* TODO: Visual representation of first, second and third places. */}
        <Box>Players: {game.players.map(gamePlayer => gamePlayer.player.username).join(', ')}</Box>
        <Box>
          Rating Change: {game.players[playerIdx].prevElo} {'-->'} {game.players[playerIdx].newElo}
        </Box>
        <BetterButton
          border='dashed'
          color='orange'
          height='30px'
          onClick={() => onReplayGame(game)}
          width='200px'>
          Replay This Game
        </BetterButton>
      </Fragment>
    );
  }

  return (
    <Modal isOpen={true} onClose={closeModal} size={'xl'}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Match History for {player.username}</ModalHeader>
        {/* Sort match history from latest start time to earliest start time */}
        {matchHistory.sort((g1, g2) => g2.startTime - g1.startTime).map(displayGame)}
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
