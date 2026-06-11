// ============================================================
// SHARED TYPES — used by both server and client
// ============================================================

export interface User {
  _id: string;
  name: string;
  email: string;
  profilePic: string;
  wins: number;
  createdAt: string;
}

export interface Player {
  userId: string;
  name: string;
  profilePic: string;
  score: number;
  isDrawing: boolean;
  hasGuessedCorrectly: boolean;
  socketId: string;
  isConnected: boolean;
}

export interface Room {
  id: string;
  name: string;
  maxPlayers: number;
  rounds: number;
  currentRound: number;
  drawTime: number;       // seconds per turn
  players: Player[];
  isPlaying: boolean;
  currentWord?: string;
  currentDrawer?: string; // socketId
}

export interface DrawPoint {
  x: number;
  y: number;
  color: string;
  strokeWidth: number;
  type: 'start' | 'draw' | 'end';
}

export interface ChatMessage {
  id: string;
  sender: string;       // player name
  message: string;
  type: 'chat' | 'system' | 'correct-guess';
  timestamp: number;
}

export interface GameState {
  room: Room;
  messages: ChatMessage[];
  timeLeft: number;
  wordHint: string;     // e.g., "_ _ _ _ _"
}

// ============================================================
// SOCKET EVENT PAYLOADS
// ============================================================

export interface JoinRoomPayload {
  roomId: string;
  userId: string;
  name: string;
  profilePic: string;
}

export interface CreateRoomPayload {
  name: string;
  maxPlayers: number;
  rounds: number;
  drawTime: number;
  userId: string;
  userName: string;
  profilePic: string;
}

export interface DrawPayload {
  roomId: string;
  point: DrawPoint;
}

export interface GuessPayload {
  roomId: string;
  guess: string;
  playerId: string;
  playerName: string;
}

export interface ClearCanvasPayload {
  roomId: string;
}

// ============================================================
// SOCKET EVENT NAMES (typed constants)
// ============================================================

export const SOCKET_EVENTS = {
  // Connection
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',

  // Room
  CREATE_ROOM: 'createRoom',
  JOIN_ROOM: 'joinRoom',
  LEAVE_ROOM: 'leaveRoom',
  ROOM_CREATED: 'roomCreated',
  ROOM_JOINED: 'roomJoined',
  ROOM_LEFT: 'roomLeft',
  ROOM_UPDATE: 'roomUpdate',
  ROOMS_LIST: 'roomsList',
  GET_ROOMS: 'getRooms',
  ERROR: 'error',

  // Game
  GAME_STARTED: 'gameStarted',
  NEW_TURN: 'newTurn',
  YOUR_TURN: 'yourTurn',
  TURN_ENDED: 'turnEnded',
  GAME_ENDED: 'gameEnded',
  TIMER_UPDATE: 'timerUpdate',
  WORD_HINT: 'wordHint',
  PLAYER_GUESSED: 'playerGuessed',
  SCORES_UPDATE: 'scoresUpdate',

  // Drawing
  DRAW: 'draw',
  CLEAR_CANVAS: 'clearCanvas',

  // Chat
  SEND_MESSAGE: 'sendMessage',
  NEW_MESSAGE: 'newMessage',
  SEND_GUESS: 'sendGuess',
} as const;

export type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
