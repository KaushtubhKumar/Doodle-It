import { create } from 'zustand';
import { Room, Player, ChatMessage, TurnInfo, LobbyRoom, DrawPoint } from '../types';

type GamePhase = 'lobby' | 'waiting' | 'drawing' | 'turn-end' | 'game-over';

interface GameState {
  // Lobby
  lobbyRooms: LobbyRoom[];

  // Current room
  room: Room | null;
  phase: GamePhase;

  // My socket id — stored here so components don't read socket.id directly
  mySocketId: string | null;

  // Turn state
  turnInfo: TurnInfo | null;
  myWord: string | null;
  wordHint: string;
  timeLeft: number;

  // After turn ends
  revealedWord: string | null;

  // Game over
  winner: Player | null;
  finalScores: Player[];

  // Chat
  messages: ChatMessage[];

  // Actions
  setMySocketId: (id: string) => void;
  setLobbyRooms: (rooms: LobbyRoom[]) => void;
  setRoom: (room: Room) => void;
  updateRoom: (room: Room) => void;
  setPhase: (phase: GamePhase) => void;
  setTurnInfo: (info: TurnInfo) => void;
  setMyWord: (word: string | null) => void;
  setWordHint: (hint: string) => void;
  setTimeLeft: (t: number) => void;
  setRevealedWord: (word: string) => void;
  setWinner: (winner: Player, scores: Player[]) => void;
  addMessage: (msg: ChatMessage) => void;
  updateScores: (players: Player[]) => void;
  resetGame: () => void;
  leaveRoom: () => void;

  pendingPoints: DrawPoint[];
  addPendingPoint: (p: DrawPoint) => void;
  clearPendingPoints: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  lobbyRooms: [],
  room: null,
  phase: 'lobby',
  mySocketId: null,
  turnInfo: null,
  myWord: null,
  wordHint: '',
  timeLeft: 0,
  revealedWord: null,
  winner: null,
  finalScores: [],
  messages: [],
  pendingPoints: [],

  setMySocketId: (id) => set({ mySocketId: id }),

  setLobbyRooms: (rooms) => set({ lobbyRooms: rooms }),

  setRoom: (room) => set({ room, phase: 'waiting' }),

  updateRoom: (room) =>
    set((s) => ({
      room,
      phase: s.phase === 'lobby' ? 'lobby' : s.phase,
    })),

  setPhase: (phase) => set({ phase }),

  setTurnInfo: (info) =>
    set({
      turnInfo: info,
      wordHint: info.hint,
      phase: 'drawing',
      revealedWord: null,
    }),

  setMyWord: (word) => set({ myWord: word }),

  setWordHint: (hint) => set({ wordHint: hint }),

  setTimeLeft: (t) => set({ timeLeft: t }),

  setRevealedWord: (word) =>
    set({ revealedWord: word, phase: 'turn-end', myWord: null }),

  setWinner: (winner, scores) =>
    set({ winner, finalScores: scores, phase: 'game-over' }),

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages.slice(-199), msg] })),

  updateScores: (players) =>
    set((s) => ({
      room: s.room ? { ...s.room, players } : null,
    })),

  resetGame: () =>
    set({
      phase: 'waiting',
      turnInfo: null,
      myWord: null,
      wordHint: '',
      timeLeft: 0,
      revealedWord: null,
      winner: null,
      finalScores: [],
      messages: [],
      pendingPoints: [],
    }),

  leaveRoom: () =>
    set({
      room: null,
      phase: 'lobby',
      turnInfo: null,
      myWord: null,
      wordHint: '',
      timeLeft: 0,
      revealedWord: null,
      winner: null,
      finalScores: [],
      messages: [],
      pendingPoints: [],
    }),

  addPendingPoint: (p) =>
    set((s) => ({ pendingPoints: [...s.pendingPoints, p] })),

  clearPendingPoints: () => set({ pendingPoints: [] }),
}));