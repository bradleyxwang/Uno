import {
  Modal,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  useToast,
} from '@chakra-ui/react';
import React, { useCallback, useEffect } from 'react';
import './style.css';
import RoundButton from './RoundButton';
import BetterButton from './BetterButton';
import { useCardGameAreaController, useLoginStatus } from '../../../classes/TownController';
import useTownController from '../../../hooks/useTownController';
import CardGameAreaInteractable from './CardGameArea';
import { GoogleLogin } from '@react-oauth/google';
import { GoogleOAuthProvider } from '@react-oauth/google';

export default function CardGameLobbyModal({
  cardGameArea,
  onCreateGame,
  onJoinGame,
  onSpectateGame,
  onLeaderboard,
}: {
  cardGameArea: CardGameAreaInteractable;
  onCreateGame: (gameId: string) => void;
  onJoinGame: () => void;
  onSpectateGame: () => void;
  onLeaderboard: () => void;
}): JSX.Element {
  const coveyTownController = useTownController();
  const cardGameAreaController = useCardGameAreaController(cardGameArea.id);
  const toast = useToast();
  const loginErrorMessage = 'There was a problem with your google account. Try logging in again.';

  const { googleEmail, googleAccountName } = useLoginStatus();

  useEffect(() => {
    coveyTownController.pause();
  }, [coveyTownController]);

  function parseLogin(token: string | undefined) {
    if (token == undefined) {
      console.log('Login Failed');
      return;
    }
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .toString()
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(''),
    );
    const parsedJsonPayload = JSON.parse(jsonPayload);
    coveyTownController.emitPlayerLoginChange(parsedJsonPayload.email, parsedJsonPayload.name);
  }

  const closeModal = useCallback(() => {
    coveyTownController.interactEnd(cardGameArea);
    coveyTownController.unPause();
  }, [coveyTownController, cardGameArea]);

  const createGame = useCallback(() => {
    coveyTownController.createCardGame(cardGameAreaController).then(newId => {
      onCreateGame(newId);
    });
  }, [coveyTownController, cardGameAreaController, onCreateGame]);

  return (
    <Modal isOpen={true} onClose={closeModal} colorScheme={'gray'}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{cardGameArea.name}&apos;s Card Game Lobby</ModalHeader>
        {googleEmail ? (
          <>
            SIGNED IN AS: {googleAccountName}
            <div className='container'>
              <div className='row'>
                <RoundButton
                  border='dashed'
                  color='red'
                  height='30px'
                  onClick={() => {
                    coveyTownController.emitPlayerLoginChange(undefined, undefined);
                  }}
                  radius='50%'
                  width='110px'>
                  Logout
                </RoundButton>
              </div>{' '}
              <div className='row'>
                <BetterButton
                  border='dashed'
                  color='blue'
                  height='30px'
                  onClick={createGame}
                  width='220px'>
                  Create Game
                </BetterButton>{' '}
                <BetterButton
                  border='dashed'
                  color='green'
                  height='30px'
                  onClick={onJoinGame}
                  width='220px'>
                  Join Game
                </BetterButton>
              </div>
            </div>
          </>
        ) : (
          <>
            Sign in below
            <GoogleOAuthProvider clientId='630522099972-p0v65dpus0o9btvdgnbdcatqiroolbln.apps.googleusercontent.com'>
              <GoogleLogin
                onSuccess={credentialResponse => parseLogin(credentialResponse.credential)}
                onError={() => {
                  toast({
                    title: 'Error',
                    description: loginErrorMessage,
                    status: 'error',
                  });
                }}
              />
            </GoogleOAuthProvider>
          </>
        )}
        <div className='container'>
          <div className='row'>
            <BetterButton
              border='dashed'
              color='orange'
              height='30px'
              onClick={onSpectateGame}
              width='220px'>
              Spectate Game
            </BetterButton>{' '}
            <BetterButton
              border='dashed'
              color='purple'
              height='30px'
              onClick={onLeaderboard}
              width='220px'>
              View Leaderboard
            </BetterButton>
          </div>
        </div>
        <ModalCloseButton />
      </ModalContent>
    </Modal>
  );
}
