import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { UserModel } from '../models/User';
import { roomManager } from './roomManager';
import {
  SOCKET_EVENTS,
  JoinRoomPayload,
  CreateRoomPayload,
  DrawPayload,
  GuessPayload,
  ClearCanvasPayload,
  Player,
  ChatMessage,
} from '../types';

const makeSystemMsg = (message: string): ChatMessage => ({
  id: uuidv4(),
  sender: 'System',
  message,
  type: 'system',
  timestamp: Date.now(),
});

function broadcastLobby(io: Server): void {
  const allRooms = roomManager.getAll().map((r) => ({
    id: r.id,
    name: r.name,
    players: r.players.length,
    maxPlayers: r.maxPlayers,
    rounds: r.rounds,
    drawTime: r.drawTime,
    isPlaying: r.isPlaying,
  }));
  io.emit(SOCKET_EVENTS.ROOMS_LIST, allRooms);
}

// Emit hint update to all sockets in the room except the drawer
function broadcastHint(io: Server, roomId: string, drawerSocketId: string, hint: string): void {
  const roomSockets = io.sockets.adapter.rooms.get(roomId);
  if (!roomSockets) return;
  for (const socketId of roomSockets) {
    if (socketId !== drawerSocketId) {
      io.to(socketId).emit(SOCKET_EVENTS.WORD_HINT, hint);
    }
  }
}

// Prevents endTurn double-fire (interval expiry + allGuessed racing)
const endingTurns = new Set<string>();

export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on(SOCKET_EVENTS.GET_ROOMS, () => {
      const rooms = roomManager.getAll().map((r) => ({
        id: r.id,
        name: r.name,
        players: r.players.length,
        maxPlayers: r.maxPlayers,
        rounds: r.rounds,
        drawTime: r.drawTime,
        isPlaying: r.isPlaying,
      }));
      socket.emit(SOCKET_EVENTS.ROOMS_LIST, rooms);
    });

    socket.on('rejoinRoom', ({ roomId, userId }: { roomId: string; userId: string }) => {
  const room = roomManager.rejoinRoom(roomId, userId, socket.id);
  if (!room) {
    socket.emit('rejoinFailed', { reason: 'Room no longer exists.' });
    return;
  }
  socket.join(roomId);
  // Send them the full current room state so they can restore
  socket.emit('rejoinSuccess', room);
  // Tell others this player is back
  socket.to(roomId).emit('roomUpdate', room);
});

    socket.on(SOCKET_EVENTS.CREATE_ROOM, (payload: CreateRoomPayload) => {
      const creator: Player = {
        userId: payload.userId,
        name: payload.userName,
        profilePic: payload.profilePic,
        score: 0,
        isDrawing: false,
        hasGuessedCorrectly: false,
        socketId: socket.id,
         isConnected: true,
      };

      const room = roomManager.create({
        name: payload.name,
        maxPlayers: payload.maxPlayers,
        rounds: payload.rounds,
        drawTime: payload.drawTime,
        creatorPlayer: creator,
      });

      socket.join(room.id);
      socket.emit(SOCKET_EVENTS.ROOM_CREATED, room);
      broadcastLobby(io);
      console.log(`[Socket] Room created: ${room.id}`);
    });

    socket.on(SOCKET_EVENTS.JOIN_ROOM, (payload: JoinRoomPayload) => {
      const player: Player = {
        userId: payload.userId,
        name: payload.name,
        profilePic: payload.profilePic,
        score: 0,
        isDrawing: false,
        hasGuessedCorrectly: false,
        socketId: socket.id,
         isConnected: true,
      };

      const room = roomManager.addPlayer(payload.roomId, player);
      if (!room) {
        socket.emit(SOCKET_EVENTS.ERROR, 'Room not found or full');
        return;
      }

      socket.join(room.id);
      socket.emit(SOCKET_EVENTS.ROOM_JOINED, room);
      socket.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, room);
      io.to(room.id).emit(SOCKET_EVENTS.NEW_MESSAGE, makeSystemMsg(`${player.name} joined the room!`));
      broadcastLobby(io);
      console.log(`[Socket] ${player.name} joined room ${room.id}`);
    });

    socket.on(SOCKET_EVENTS.LEAVE_ROOM, (roomId: string) => {
      const result = roomManager.removePlayer(socket.id);
      socket.leave(roomId);
      if (result) {
        const { room, wasDrawer } = result;
        io.to(room.id).emit(SOCKET_EVENTS.NEW_MESSAGE, makeSystemMsg('A player left the room.'));
        io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, room);
        if (wasDrawer && room.isPlaying) endTurn(io, room.id);
      }
      broadcastLobby(io);
    });

    socket.on('startGame', (roomId: string) => {
      const room = roomManager.startGame(roomId);
      if (!room) {
        socket.emit(SOCKET_EVENTS.ERROR, 'Cannot start game (need at least 2 players)');
        return;
      }
      io.to(roomId).emit(SOCKET_EVENTS.GAME_STARTED, room);
      broadcastLobby(io);
      startNewTurn(io, roomId);
    });

    socket.on(SOCKET_EVENTS.DRAW, (payload: DrawPayload) => {
      socket.to(payload.roomId).emit(SOCKET_EVENTS.DRAW, payload.point);
    });

    socket.on(SOCKET_EVENTS.CLEAR_CANVAS, (payload: ClearCanvasPayload) => {
      const room = roomManager.get(payload.roomId);
      if (!room) return;
      if (room.currentDrawer === socket.id) {
        io.to(payload.roomId).emit(SOCKET_EVENTS.CLEAR_CANVAS);
      }
    });

    socket.on(
      SOCKET_EVENTS.SEND_MESSAGE,
      (payload: { roomId: string; message: string; playerName: string }) => {
        const msg: ChatMessage = {
          id: uuidv4(),
          sender: payload.playerName,
          message: payload.message,
          type: 'chat',
          timestamp: Date.now(),
        };
        io.to(payload.roomId).emit(SOCKET_EVENTS.NEW_MESSAGE, msg);
      }
    );

    socket.on(SOCKET_EVENTS.SEND_GUESS, async (payload: GuessPayload) => {
      const room = roomManager.get(payload.roomId);
      if (!room || !room.isPlaying) return;
      if (room.currentDrawer === socket.id) return;

      const { correct, allGuessed } = roomManager.checkGuess(
        payload.roomId,
        socket.id,
        payload.guess
      );

      if (correct) {
        io.to(payload.roomId).emit(SOCKET_EVENTS.NEW_MESSAGE, {
          id: uuidv4(),
          sender: payload.playerName,
          message: `${payload.playerName} guessed the word!`,
          type: 'correct-guess',
          timestamp: Date.now(),
        } as ChatMessage);
        io.to(payload.roomId).emit(SOCKET_EVENTS.PLAYER_GUESSED, {
          playerId: socket.id,
          playerName: payload.playerName,
        });
        io.to(payload.roomId).emit(SOCKET_EVENTS.SCORES_UPDATE, room.players);
        if (allGuessed) endTurn(io, payload.roomId);
      } else {
        io.to(payload.roomId).emit(SOCKET_EVENTS.NEW_MESSAGE, {
          id: uuidv4(),
          sender: payload.playerName,
          message: payload.guess,
          type: 'chat',
          timestamp: Date.now(),
        } as ChatMessage);
      }
    });

    // socket.on(SOCKET_EVENTS.DISCONNECT, () => {
    //   console.log(`[Socket] Disconnected: ${socket.id}`);
    //   const result = roomManager.removePlayer(socket.id);
    //   if (result) {
    //     const { room, wasDrawer } = result;
    //     io.to(room.id).emit(SOCKET_EVENTS.NEW_MESSAGE, makeSystemMsg('A player left the room.'));
    //     io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, room);
    //     if (wasDrawer && room.isPlaying) endTurn(io, room.id);
    //   }
    //   broadcastLobby(io);
    // });


    socket.on('disconnect', () => {
  for (const roomId of socket.rooms) {
    if (roomId === socket.id) continue;
    // Hold slot for 30s instead of removing immediately
    roomManager.markDisconnected(socket.id, roomId);
    // Notify others the player went offline
    socket.to(roomId).emit('playerDisconnected', { socketId: socket.id });
  }
});
  });
}

// ─── Turn management ──────────────────────────────────────────────────────────

function startNewTurn(io: Server, roomId: string): void {
  endingTurns.delete(roomId);

  const result = roomManager.startTurn(roomId);
  if (!result) return;

  const { room, word, hint, drawer } = result;

  // Send fresh room state so clients get updated currentDrawer + isDrawing flags
  io.to(roomId).emit(SOCKET_EVENTS.ROOM_UPDATE, room);

  // Tell the drawer their word first, then tell everyone the turn started
  io.to(drawer.socketId).emit(SOCKET_EVENTS.YOUR_TURN, { word });

  io.to(roomId).emit(SOCKET_EVENTS.NEW_TURN, {
    drawerId: drawer.socketId,
    drawerName: drawer.name,
    hint,
    round: room.currentRound,
    totalRounds: room.rounds,
  });

  io.to(roomId).emit(
    SOCKET_EVENTS.NEW_MESSAGE,
    makeSystemMsg(`${drawer.name} is now drawing! Guess the word!`)
  );

  // Build a mutable hint array — spaces pre-revealed, letters start as '_'
  const hintArr: string[] = word.split('').map((ch) => (ch === ' ' ? ' ' : '_'));

  // Every 15 seconds reveal one random unrevealed letter to guessers
  const hintInterval = setInterval(() => {
    const hiddenIndices = hintArr
      .map((ch, i) => (ch === '_' ? i : -1))
      .filter((i) => i !== -1);

    // Nothing left to reveal — stop the interval
    if (hiddenIndices.length === 0) {
      clearInterval(hintInterval);
      return;
    }

    const pick = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
    hintArr[pick] = word[pick];

    // Send updated hint to everyone except the drawer (they already know the word)
    broadcastHint(io, roomId, drawer.socketId, hintArr.join(' '));
  }, 15000);

  // Countdown timer
  let timeLeft = room.drawTime;
  const countdownInterval = setInterval(() => {
    timeLeft -= 1;
    io.to(roomId).emit(SOCKET_EVENTS.TIMER_UPDATE, timeLeft);
    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      clearInterval(hintInterval);
      endTurn(io, roomId);
    }
  }, 1000);

  // Store both so endTurn can cancel them early (e.g. all players guessed)
  roomManager.setIntervalRef(roomId, countdownInterval);
  roomManager.setHintIntervalRef(roomId, hintInterval);
}

function endTurn(io: Server, roomId: string): void {
  // Guard: prevent double-fire from interval expiry + allGuessed racing
  if (endingTurns.has(roomId)) return;
  endingTurns.add(roomId);

  // Cancel both the countdown and the hint reveal
  roomManager.clearIntervalRef(roomId);
  roomManager.clearHintIntervalRef(roomId);

  const room = roomManager.get(roomId);
  if (!room) {
    endingTurns.delete(roomId);
    return;
  }

  const wordReveal = room.currentWord ?? '???';

  io.to(roomId).emit(SOCKET_EVENTS.TURN_ENDED, {
    word: wordReveal,
    scores: room.players,
  });
  io.to(roomId).emit(
    SOCKET_EVENTS.NEW_MESSAGE,
    makeSystemMsg(`The word was: "${wordReveal}"`)
  );

  const advancement = roomManager.advanceRound(roomId);
  if (!advancement) {
    endingTurns.delete(roomId);
    return;
  }

  if (advancement.gameOver) {
    const winner = [...advancement.room.players].sort((a, b) => b.score - a.score)[0];
    io.to(roomId).emit(SOCKET_EVENTS.GAME_ENDED, {
      players: advancement.room.players,
      winner,
    });
    broadcastLobby(io);
    endingTurns.delete(roomId);

    if (winner?.userId) {
      UserModel.findByIdAndUpdate(winner.userId, { $inc: { wins: 1 } }).catch(
        (err) => console.error('[DB] Failed to update wins:', err)
      );
    }
  } else {
    // 4 second pause so players can read the revealed word before next turn
    setTimeout(() => startNewTurn(io, roomId), 4000);
  }
}