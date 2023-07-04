import React, { useState } from 'react';
import CardGameAreaInteractable from './CardGameArea';
import { useInteractable } from '../../../classes/TownController';
import CardGameLobbyModal from './CardGameLobbyModal';
import CardGameNonStartedModal from './CardGameNotStartedModal';
import CardGameJoinModal from './CardGameJoinModal';
import CardGameOngoingModal from './CardGameOngoingModal';
import CardGameSpectatorChoosingModal from './CardGameSpectatorChoosingModal';
import CardGameLeaderboardModal from './CardGameLeaderboardModal';
import CardGameMatchHistoryModal from './CardGameMatchHistoryModal';
import { CardGamePlayer, MatchHistory } from '../../../types/CoveyTownSocket';
import CardGameReplayGameModal from './CardGameReplayGameModal';

enum CardGameStateType {
  LOBBY,
  GAME_NOT_STARTED,
  JOINING_GAME,
  CHOOSING_GAME_TO_SPECTATE,
  GAME_ONGOING,
  LEADERBOARD,
  MATCH_HISTORY,
  REPLAY_GAME,
}

type CardGameState =
  | { type: CardGameStateType.LOBBY }
  | { type: CardGameStateType.GAME_NOT_STARTED; id: string }
  | { type: CardGameStateType.JOINING_GAME }
  | { type: CardGameStateType.CHOOSING_GAME_TO_SPECTATE }
  | { type: CardGameStateType.GAME_ONGOING; id: string }
  | { type: CardGameStateType.LEADERBOARD }
  | { type: CardGameStateType.MATCH_HISTORY; player: CardGamePlayer }
  | { type: CardGameStateType.REPLAY_GAME; prevPlayer: CardGamePlayer; game: MatchHistory };

/**
 * The CardGameAreaWrapper is suitable to be *always* rendered inside of a town, and
 * will activate only if the player begins interacting with a card game area.
 */
export default function CardGameAreaWrapper(): JSX.Element {
  const cardGameArea = useInteractable<CardGameAreaInteractable>('cardGameArea');
  const [gameState, setGameState] = useState<CardGameState>({ type: CardGameStateType.LOBBY });
  if (cardGameArea) {
    if (gameState.type === CardGameStateType.LOBBY) {
      return (
        <CardGameLobbyModal
          cardGameArea={cardGameArea}
          onCreateGame={gameId =>
            setGameState({ type: CardGameStateType.GAME_NOT_STARTED, id: gameId })
          }
          onJoinGame={() => setGameState({ type: CardGameStateType.JOINING_GAME })}
          onLeaderboard={() => setGameState({ type: CardGameStateType.LEADERBOARD })}
          onSpectateGame={() => setGameState({ type: CardGameStateType.CHOOSING_GAME_TO_SPECTATE })}
        />
      );
    }
    if (gameState.type === CardGameStateType.GAME_NOT_STARTED) {
      return (
        <CardGameNonStartedModal
          cardGameArea={cardGameArea}
          gameId={gameState.id}
          onStartGame={() =>
            setGameState({ type: CardGameStateType.GAME_ONGOING, id: gameState.id })
          }
          onLeave={() => setGameState({ type: CardGameStateType.LOBBY })}
        />
      );
    }
    if (gameState.type === CardGameStateType.JOINING_GAME) {
      return (
        <CardGameJoinModal
          cardGameArea={cardGameArea}
          onJoinGame={gameId =>
            setGameState({ type: CardGameStateType.GAME_NOT_STARTED, id: gameId })
          }
          onLeave={() => setGameState({ type: CardGameStateType.LOBBY })}
        />
      );
    }
    if (gameState.type === CardGameStateType.CHOOSING_GAME_TO_SPECTATE) {
      return (
        <CardGameSpectatorChoosingModal
          cardGameArea={cardGameArea}
          onChooseGame={gameId =>
            setGameState({ type: CardGameStateType.GAME_ONGOING, id: gameId })
          }
          onLeave={() => setGameState({ type: CardGameStateType.LOBBY })}
        />
      );
    }
    if (gameState.type === CardGameStateType.GAME_ONGOING) {
      return (
        <CardGameOngoingModal
          cardGameArea={cardGameArea}
          gameId={gameState.id}
          onLeave={() => setGameState({ type: CardGameStateType.LOBBY })}
        />
      );
    }
    if (gameState.type === CardGameStateType.LEADERBOARD) {
      return (
        <CardGameLeaderboardModal
          cardGameArea={cardGameArea}
          onLeave={() => setGameState({ type: CardGameStateType.LOBBY })}
          onMatchHistory={player => setGameState({ type: CardGameStateType.MATCH_HISTORY, player })}
        />
      );
    }
    if (gameState.type === CardGameStateType.MATCH_HISTORY) {
      return (
        <CardGameMatchHistoryModal
          cardGameArea={cardGameArea}
          player={gameState.player}
          onReplayGame={game =>
            setGameState({
              type: CardGameStateType.REPLAY_GAME,
              prevPlayer: gameState.player,
              game,
            })
          }
          onLeave={() => setGameState({ type: CardGameStateType.LEADERBOARD })}
        />
      );
    }
    if (gameState.type === CardGameStateType.REPLAY_GAME) {
      return (
        <CardGameReplayGameModal
          cardGameArea={cardGameArea}
          matchHistory={gameState.game}
          onLeave={() =>
            setGameState({
              type: CardGameStateType.MATCH_HISTORY,
              player: gameState.prevPlayer,
            })
          }
        />
      );
    }
  }
  return <></>;
}
