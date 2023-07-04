import {
  Button,
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
} from '@chakra-ui/react';
import React, { useCallback, useEffect, useState } from 'react';
import RoundButton from './RoundButton';
import useTownController from '../../../hooks/useTownController';
import { CardGamePlayer, EloRating } from '../../../types/CoveyTownSocket';
import CardGameAreaInteractable from './CardGameArea';

export default function CardGameLeaderboardModal({
  cardGameArea,
  onLeave,
  onMatchHistory,
}: {
  cardGameArea: CardGameAreaInteractable;
  onLeave: () => void;
  onMatchHistory: (player: CardGamePlayer) => void;
}): JSX.Element {
  const coveyTownController = useTownController();
  const curPlayerId = coveyTownController.ourPlayer.googleEmail;

  const [eloRatings, setEloRatings] = useState<EloRating[]>([]);
  const [sortKey, setSortKey] = useState<string>('rating');
  const [order, setOrder] = useState<string>('descending');

  useEffect(() => {
    async function fetchEloRatings() {
      const currEloRatings = await coveyTownController.getCardGameEloRatings();

      if (sortKey == 'username') {
        currEloRatings.sort((a, b) => a.username.localeCompare(b.username));
      } else if (sortKey == 'rating') {
        currEloRatings.sort((a, b) => a.rating - b.rating);
      } else if (sortKey == 'numPlayed') {
        currEloRatings.sort((a, b) => a.numPlayed - b.numPlayed);
      }

      if (order == 'descending') {
        currEloRatings.reverse();
      }
      setEloRatings(currEloRatings);
    }
    fetchEloRatings();
  }, [sortKey, order, coveyTownController]);

  const closeModal = useCallback(() => {
    coveyTownController.interactEnd(cardGameArea);
    coveyTownController.unPause();
  }, [coveyTownController, cardGameArea]);

  return (
    <Modal isOpen={true} onClose={closeModal} size={'xl'}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Leaderboard</ModalHeader>
        <table>
          <tr>
            <td>
              <label htmlFor='sortBy'>
                <b>Sort By</b>
              </label>
            </td>
            <td>
              <select
                name='sortBy'
                id='sortBy'
                onChange={option => {
                  setSortKey(option.target.value);
                }}>
                <option value='rating'>Elo Rating</option>
                <option value='username'>Google Account Name</option>
                <option value='numPlayed'>Number of Games</option>
              </select>
            </td>
          </tr>
          <tr>
            <td>
              <label htmlFor='order'>
                <b>Order</b>
              </label>
            </td>
            <td>
              <select
                name='order'
                id='order'
                onChange={option => {
                  setOrder(option.target.value);
                }}>
                <option value='descending'>Descending</option>
                <option value='ascending'>Ascending</option>
              </select>
            </td>
          </tr>
        </table>
        <br />
        <table>
          <tr>
            <td>
              <b>Google Account Name</b>
            </td>
            <td>
              <b>Elo Rating</b>
            </td>
            <td>
              <b>Number of Games</b>
            </td>
          </tr>

          {eloRatings.map(eachEloRating => (
            <tr key={eachEloRating.playerId}>
              <td>
                <Button
                  colorScheme='orange'
                  mr={3}
                  onClick={() =>
                    onMatchHistory({
                      playerId: eachEloRating.playerId,
                      username: eachEloRating.username,
                    })
                  }>
                  {curPlayerId && curPlayerId == eachEloRating.playerId ? '\u2B50' : ''}
                  {eachEloRating.username}
                </Button>
              </td>
              <td>{eachEloRating.rating}</td>
              <td>{eachEloRating.numPlayed}</td>
            </tr>
          ))}
        </table>
        <br />
        <ModalCloseButton />
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
