// Re-export all shared types for the client

export interface User {
  _id: string;
  name: string;
  email: string;
  profilePic: string;
  wins: number;
}

export interface Player {
  userId: string;
  name: string;
  profilePic: string;
  score: number;
  isDrawing: boolean;
  hasGuessedCorrectly: boolean;
  socketId: string;
}

export interface Room {
  id: string;
  name: string;
  maxPlayers: number;
  rounds: number;
  currentRound: number;
  drawTime: number;
  players: Player[];
  isPlaying: boolean;
  currentDrawer?: string;
}

export interface LobbyRoom {
  id: string;
  name: string;
  players: number;
  maxPlayers: number;
  rounds: number;
  drawTime: number;
  isPlaying: boolean;
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
  sender: string;
  message: string;
  type: 'chat' | 'system' | 'correct-guess';
  timestamp: number;
}

export interface TurnInfo {
  drawerId: string;
  drawerName: string;
  hint: string;
  round: number;
  totalRounds: number;
}

export interface TurnEndInfo {
  word: string;
  scores: Player[];
}

export interface GameEndInfo {
  players: Player[];
  winner: Player;
}

// ─── Auth API responses ────────────────────────────────────────────────────

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
}
