import { useEffect, useCallback } from 'react';
import { socket, connectSocket } from '../utils/socket';
import { useGameStore } from '../context/gameStore';

import {
  Room,
  LobbyRoom,
  ChatMessage,
  TurnInfo,
  TurnEndInfo,
  GameEndInfo,
  Player,
  DrawPoint,
} from '../types';

const EVENTS = {
  GET_ROOMS: 'getRooms',
  ROOMS_LIST: 'roomsList',
  CREATE_ROOM: 'createRoom',
  JOIN_ROOM: 'joinRoom',
  ROOM_CREATED: 'roomCreated',
  ROOM_JOINED: 'roomJoined',
  ROOM_UPDATE: 'roomUpdate',
  ERROR: 'error',
  GAME_STARTED: 'gameStarted',
  NEW_TURN: 'newTurn',
  YOUR_TURN: 'yourTurn',
  TURN_ENDED: 'turnEnded',
  GAME_ENDED: 'gameEnded',
  TIMER_UPDATE: 'timerUpdate',
  WORD_HINT: 'wordHint',
  PLAYER_GUESSED: 'playerGuessed',
  SCORES_UPDATE: 'scoresUpdate',
  DRAW: 'draw',
  CLEAR_CANVAS: 'clearCanvas',
  NEW_MESSAGE: 'newMessage',
  START_GAME: 'startGame',
  SEND_MESSAGE: 'sendMessage',
  SEND_GUESS: 'sendGuess',
} as const;

interface UseSocketReturn {
  getRooms: () => void;
  createRoom: (opts: {
    name: string;
    maxPlayers: number;
    rounds: number;
    drawTime: number;
    userId: string;
    userName: string;
    profilePic: string;
  }) => void;
  joinRoom: (roomId: string, userId: string, name: string, profilePic: string) => void;
  leaveRoom: (roomId: string) => void;
  startGame: (roomId: string) => void;
  sendDraw: (roomId: string, point: DrawPoint) => void;
  clearCanvas: (roomId: string) => void;
  sendMessage: (roomId: string, message: string, playerName: string) => void;
  sendGuess: (roomId: string, guess: string, playerId: string, playerName: string) => void;
  onDraw: (cb: (point: DrawPoint) => void) => () => void;
  onClearCanvas: (cb: () => void) => () => void;
}

export function useSocket(): UseSocketReturn {
  const store = useGameStore();

  useEffect(() => {
    connectSocket();

    // Save our socket ID into the store as soon as we're connected
    // so GamePage can reliably derive isDrawer without reading socket.id directly
    const onConnect = () => {
      store.setMySocketId(socket.id ?? '');
    };
    if (socket.connected) {
      store.setMySocketId(socket.id ?? '');
    }
    socket.on('connect', onConnect);

    // ── Lobby ────────────────────────────────────────────────────────────
    const onRoomsList = (rooms: LobbyRoom[]) => store.setLobbyRooms(rooms);
    const onRoomCreated = (room: Room) => store.setRoom(room);
    const onRoomJoined = (room: Room) => store.setRoom(room);
    const onRoomUpdate = (room: Room) => store.updateRoom(room);
    const onError = (msg: string) => {
      console.error('[Socket Error]', msg);
      alert(`Socket error: ${msg}`);
    };

socket.on('playerDisconnected', ({ socketId }: { socketId: string }) => {
  const room = useGameStore.getState().room;
  if (!room) return;
  const updated = { ...room, players: room.players.map(p =>
    p.socketId === socketId ? { ...p, isConnected: false } : p
  )};
  useGameStore.getState().updateRoom(updated);
});

socket.on('rejoinSuccess', (room: Room) => {
  store.setRoom(room);
  if (room.isPlaying) store.setPhase('drawing');
});

socket.on('rejoinFailed', ({ reason }: { reason: string }) => {
  console.warn('Rejoin failed:', reason);
});

    // ── Game flow ────────────────────────────────────────────────────────
    // GAME_STARTED: just update the room object — do NOT force phase to 'drawing'
    // here. The phase transition happens on NEW_TURN so the drawer's word arrives
    // in the same React render cycle as isDrawer becoming true.
    const onGameStarted = (room: Room) => {
      store.updateRoom(room);
      store.resetGame();
      // Stay in 'waiting' phase — NEW_TURN will move us to 'drawing'
    };

    const onNewTurn = (info: TurnInfo) => {
      store.setTurnInfo(info); // this sets phase → 'drawing' and clears myWord
      store.clearPendingPoints();
    };

    const onYourTurn = ({ word }: { word: string }) => {
      store.setMyWord(word); // arrives right after NEW_TURN from server
    };

    const onWordHint = (hint: string) => store.setWordHint(hint);
    const onTimerUpdate = (t: number) => store.setTimeLeft(t);
    const onPlayerGuessed = (_data: { playerId: string; playerName: string }) => {};
    const onScoresUpdate = (players: Player[]) => store.updateScores(players);
    const onTurnEnded = (info: TurnEndInfo) => {
      store.setRevealedWord(info.word);
      store.updateScores(info.scores);
    };
    const onGameEnded = (info: GameEndInfo) => store.setWinner(info.winner, info.players);
    const onNewMessage = (msg: ChatMessage) => store.addMessage(msg);

    socket.on(EVENTS.ROOMS_LIST, onRoomsList);
    socket.on(EVENTS.ROOM_CREATED, onRoomCreated);
    socket.on(EVENTS.ROOM_JOINED, onRoomJoined);
    socket.on(EVENTS.ROOM_UPDATE, onRoomUpdate);
    socket.on(EVENTS.ERROR, onError);
    socket.on(EVENTS.GAME_STARTED, onGameStarted);
    socket.on(EVENTS.NEW_TURN, onNewTurn);
    socket.on(EVENTS.YOUR_TURN, onYourTurn);
    socket.on(EVENTS.WORD_HINT, onWordHint);
    socket.on(EVENTS.TIMER_UPDATE, onTimerUpdate);
    socket.on(EVENTS.PLAYER_GUESSED, onPlayerGuessed);
    socket.on(EVENTS.SCORES_UPDATE, onScoresUpdate);
    socket.on(EVENTS.TURN_ENDED, onTurnEnded);
    socket.on(EVENTS.GAME_ENDED, onGameEnded);
    socket.on(EVENTS.NEW_MESSAGE, onNewMessage);

    return () => {
      socket.off('connect', onConnect);
      socket.off(EVENTS.ROOMS_LIST, onRoomsList);
      socket.off(EVENTS.ROOM_CREATED, onRoomCreated);
      socket.off(EVENTS.ROOM_JOINED, onRoomJoined);
      socket.off(EVENTS.ROOM_UPDATE, onRoomUpdate);
      socket.off(EVENTS.ERROR, onError);
      socket.off(EVENTS.GAME_STARTED, onGameStarted);
      socket.off(EVENTS.NEW_TURN, onNewTurn);
      socket.off(EVENTS.YOUR_TURN, onYourTurn);
      socket.off(EVENTS.WORD_HINT, onWordHint);
      socket.off(EVENTS.TIMER_UPDATE, onTimerUpdate);
      socket.off(EVENTS.PLAYER_GUESSED, onPlayerGuessed);
      socket.off(EVENTS.SCORES_UPDATE, onScoresUpdate);
      socket.off(EVENTS.TURN_ENDED, onTurnEnded);
      socket.off(EVENTS.GAME_ENDED, onGameEnded);
      socket.off(EVENTS.NEW_MESSAGE, onNewMessage);
      socket.off('rejoinSuccess');
      socket.off('rejoinFailed');
      // No disconnectSocket() — socket stays alive across re-renders
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getRooms = useCallback(() => socket.emit(EVENTS.GET_ROOMS), []);

  const createRoom = useCallback(
    (opts: {
      name: string;
      maxPlayers: number;
      rounds: number;
      drawTime: number;
      userId: string;
      userName: string;
      profilePic: string;
    }) => socket.emit(EVENTS.CREATE_ROOM, opts),
    []
  );

  const joinRoom = useCallback(
    (roomId: string, userId: string, name: string, profilePic: string) =>
      socket.emit(EVENTS.JOIN_ROOM, { roomId, userId, name, profilePic }),
    []
  );

  const leaveRoom = useCallback(
    (roomId: string) => {
      socket.emit('leaveRoom', roomId);
      store.leaveRoom();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const startGame = useCallback(
    (roomId: string) => socket.emit(EVENTS.START_GAME, roomId),
    []
  );

  const sendDraw = useCallback(
    (roomId: string, point: DrawPoint) => socket.emit(EVENTS.DRAW, { roomId, point }),
    []
  );

  const clearCanvas = useCallback(
    (roomId: string) => socket.emit(EVENTS.CLEAR_CANVAS, { roomId }),
    []
  );

  const sendMessage = useCallback(
    (roomId: string, message: string, playerName: string) =>
      socket.emit(EVENTS.SEND_MESSAGE, { roomId, message, playerName }),
    []
  );

  const sendGuess = useCallback(
    (roomId: string, guess: string, playerId: string, playerName: string) =>
      socket.emit(EVENTS.SEND_GUESS, { roomId, guess, playerId, playerName }),
    []
  );

  const onDraw = useCallback((cb: (point: DrawPoint) => void) => {
    socket.on(EVENTS.DRAW, cb);
    return () => { socket.off(EVENTS.DRAW, cb); };
  }, []);

  const onClearCanvas = useCallback((cb: () => void) => {
    socket.on(EVENTS.CLEAR_CANVAS, cb);
    return () => { socket.off(EVENTS.CLEAR_CANVAS, cb); };
  }, []);

  return {
    getRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    sendDraw,
    clearCanvas,
    sendMessage,
    sendGuess,
    onDraw,
    onClearCanvas,
  };
}