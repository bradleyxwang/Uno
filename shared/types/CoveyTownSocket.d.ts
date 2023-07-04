export type TownJoinResponse = {
  /** Unique ID that represents this player * */
  userID: string;
  /** Secret token that this player should use to authenticate
   * in future requests to this service * */
  sessionToken: string;
  /** Secret token that this player should use to authenticate
   * in future requests to the video service * */
  providerVideoToken: string;
  /** List of players currently in this town * */
  currentPlayers: Player[];
  /** Friendly name of this town * */
  friendlyName: string;
  /** Is this a private town? * */
  isPubliclyListed: boolean;
  /** Current state of interactables in this town */
  interactables: Interactable[];
};

export type Interactable = ViewingArea | ConversationArea | PosterSessionArea | CardGameArea;

export type TownSettingsUpdate = {
  friendlyName?: string;
  isPubliclyListed?: boolean;
};

export type Direction = 'front' | 'back' | 'left' | 'right';
export interface Player {
  id: string;
  userName: string;
  location: PlayerLocation;
  googleEmail?: string;
  googleAccountName?: string;
}

export type XY = { x: number; y: number };

export interface PlayerLocation {
  /* The CENTER x coordinate of this player's location */
  x: number;
  /* The CENTER y coordinate of this player's location */
  y: number;
  /** @enum {string} */
  rotation: Direction;
  moving: boolean;
  interactableID?: string;
}
export type ChatMessage = {
  author: string;
  sid: string;
  body: string;
  dateCreated: Date;
  interactableId?: string;
};

export interface ConversationArea {
  id: string;
  topic?: string;
  occupantsByID: string[];
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewingArea {
  id: string;
  video?: string;
  isPlaying: boolean;
  elapsedTimeSec: number;
}

export interface PosterSessionArea {
  id: string;
  stars: number;
  imageContents?: string;
  title?: string;
}

export interface CardGameArea {
  id: string;
  nonStartedGames: NonStartedCardGame[];
  ongoingGames: OngoingCardGame[];
}

export interface GoogleDetails {
  googleEmail: string | undefined;
  googleAccountName: string | undefined;
}

export type Card =
  | { type: 'number'; color: string; value: number }
  | { type: 'draw_two'; color: string }
  | { type: 'reverse'; color: string }
  | { type: 'skip'; color: string }
  | { type: 'wild' }
  | { type: 'wild_draw_four' };

// type: boolean is true for draw moves, false for play moves
// card: number represents the index of this card in the hand, if this is a play move
// color represents new color, if this is a play move with a wild card
// Draw will have undefined card and color
export type PlayableMove = { type: boolean; card?: number; color?: string };

export type BasicMove =
  | PlayableMove
  | { type: 'receive_hand'; cards: Card[] }
  | { type: 'quit' }
  | { type: 'skip' };

export interface FullMove {
  // the player's google email
  playerId: string;
  // Number of milliseconds elapsed since the epoch
  timestamp: number;
  move: BasicMove;
}

export type CardGamePlayer = {
  // the player's google email
  playerId: string;
  // the player's google account name
  username: string;
};

export type EloRatingChange = {
  player: CardGamePlayer;
  prevElo: number;
  newElo: number;
};

export interface OngoingCardGame {
  id: string;
  players: CardGamePlayer[];
  // List of indices representing players who have not yet quit the game
  // INVARIANT: activePlayers is either empty or has >=2 players
  activePlayers: number[];
  // This is the spectator's normal covey.town player id (not the google email)
  spectators: string[];

  // List of indices representing players who have won,
  // in the order in which they won
  // INVARIANT: No number is in both winners and activePlayers
  winners: number[];
  hands: Card[][];
  moves: FullMove[];
  deck: Card[];
  discardPile: Card[];
  currentColor: string;
  // If last card played was draw 2, this number is 2
  // If last card played was draw 4, this number is 4
  // Otherwise, undefined
  lastDrawPlayed?: number;
  // Index into the players array representing whose turn it is
  currentPlayerIdx: number;
  // true means index increments, false means index decrements on next turn
  playerDirection: boolean;
  // stores each player's previous elo rating to make the new elo rating calculation faster
  prevEloRatings: EloRating[];
  // stores the elo rating changes in order from 1st to last (populated at the end of game)
  eloRatingChanges: EloRatingChange[];

  // extra fields for match history
  cardsDrawnDuringGame: Card[];
  startingTopCardDiscardPile: Card;
  // order of hands corresponds to the order in the players field
  initialHands: Card[][];
  startTime: number;
}

export interface NonStartedCardGame {
  id: string;
  players: CardGamePlayer[];
}

export interface MatchHistory {
  // ordered from 1st place to last place
  players: EloRatingChange[];
  playingOrder: string[];
  startTime: number;
  endTime: number;
  cardsDrawnDuringGame: Card[];
  // order of initial hands corresponds to order of players in playingOrder
  initialHands: Card[][];
  startingTopCardDiscardPile: Card;
  events: FullMove[];
}

export interface EloRating {
  // the player's google email
  playerId: string;
  // the player's google account name
  username: string;
  rating: number;
  numPlayed: number;
}

export interface ServerToClientEvents {
  playerMoved: (movedPlayer: Player) => void;
  playerDisconnect: (disconnectedPlayer: Player) => void;
  playerJoined: (newPlayer: Player) => void;
  playerLoginChanged: (changedPlayer: Player) => void;
  initialize: (initialData: TownJoinResponse) => void;
  townSettingsUpdated: (update: TownSettingsUpdate) => void;
  townClosing: () => void;
  chatMessage: (message: ChatMessage) => void;
  interactableUpdate: (interactable: Interactable) => void;
  // Making this a one-argument event makes events easier to test
  matchHistory: (googleEmailWithMatchHistory: [string, MatchHistory[]]) => void;
}

export interface ClientToServerEvents {
  chatMessage: (message: ChatMessage) => void;
  playerMovement: (movementData: PlayerLocation) => void;
  interactableUpdate: (update: Interactable) => void;
  playerLoginLogout: (
    googleEmail: string | undefined,
    googleAccountName: string | undefined,
  ) => void;
  requestMatchHistory: (googleEmail: string) => void;
}
