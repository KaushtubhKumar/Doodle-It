import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { UserModel } from '../models/User';
import { roomManager } from './roomManager';
import jwt from 'jsonwebtoken';
import { redis } from '../utils/redis';
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

async function broadcastLobby(io: Server): Promise<void> {
  const allRooms = (await roomManager.getAll()).map((r) => ({
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

function broadcastHint(io: Server, roomId: string, drawerSocketId: string, hint: string): void {
  const roomSockets = io.sockets.adapter.rooms.get(roomId);
  if (!roomSockets) return;
  for (const socketId of roomSockets) {
    if (socketId !== drawerSocketId) {
      io.to(socketId).emit(SOCKET_EVENTS.WORD_HINT, hint);
    }
  }
}

export function registerSocketHandlers(io: Server): void {
  io.on('connection', async (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    let currentRoomId: string | null = null;

    // ── Auto-rejoin on reconnect ──────────────────────────────────────────
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
          id: string;
        };
        const roomId = await redis.get(`player:${decoded.id}:room`);
        if (roomId) {
          const room = await roomManager.rejoinRoom(
            roomId,
            decoded.id,
            socket.id,
          );
          if (room) {
            socket.join(roomId);
            currentRoomId = roomId;
            socket.emit("rejoinSuccess", room);
            socket.to(roomId).emit("roomUpdate", room);

            if (room.isPlaying) {
              const cachedSnapshot = await roomManager.getSnapshot(room.id);
              socket.emit(SOCKET_EVENTS.MID_GAME_JOIN_STATE, {
                canvasSnapshot: cachedSnapshot,
                wordHint: room.currentHint ?? "",
                timeLeft: room.currentTimeLeft ?? 0,
              });
              const rejoiningPlayer = room.players.find(p => p.socketId === socket.id);
              if (rejoiningPlayer && room.currentDrawer === socket.id) {
                socket.emit(SOCKET_EVENTS.YOUR_TURN, {
                  word: room.currentWord,
                });
              }
            }
          } else {
            await redis.del(`player:${decoded.id}:room`);
          }
        }
      } catch {
        // fresh connection, no prior room
      }
    }

    // ── Lobby ─────────────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.GET_ROOMS, async () => {
      const rooms = (await roomManager.getAll()).map((r) => ({
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

    socket.on('rejoinRoom', async ({ roomId, userId }: { roomId: string; userId: string }) => {
      const room = await roomManager.rejoinRoom(roomId, userId, socket.id);
      if (!room) {
        socket.emit('rejoinFailed', { reason: 'Room no longer exists.' });
        return;
      }
      socket.join(roomId);
      socket.emit('rejoinSuccess', room);
      socket.to(roomId).emit('roomUpdate', room);

      if (room.isPlaying) {
        const cachedSnapshot = await roomManager.getSnapshot(room.id);
        socket.emit(SOCKET_EVENTS.MID_GAME_JOIN_STATE, {
          canvasSnapshot: cachedSnapshot,
          wordHint: room.currentHint ?? "",
          timeLeft: room.currentTimeLeft ?? 0,
        });
        if (room.currentDrawer === socket.id) {
          socket.emit(SOCKET_EVENTS.YOUR_TURN, { word: room.currentWord });
        }
      }
    });

    // ── Create room ───────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.CREATE_ROOM, async (payload: CreateRoomPayload) => {
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

      const room = await roomManager.create({
        name: payload.name,
        maxPlayers: payload.maxPlayers,
        rounds: payload.rounds,
        drawTime: payload.drawTime,
        creatorPlayer: creator,
      });

      socket.join(room.id);
      currentRoomId = room.id;
      socket.emit(SOCKET_EVENTS.ROOM_CREATED, room);
      await broadcastLobby(io);
      console.log(`[Socket] Room created: ${room.id}`);
    });

    // ── Join room (pre-game AND mid-game) ─────────────────────────────────
    socket.on(SOCKET_EVENTS.JOIN_ROOM, async (payload: JoinRoomPayload) => {
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

      const result = await roomManager.addPlayer(payload.roomId, player);
      if (!result) {
        socket.emit(SOCKET_EVENTS.ERROR, 'Room not found or full');
        return;
      }

      const { room, isMidGameJoin } = result;

      socket.join(room.id);
      currentRoomId = room.id;
      socket.emit(SOCKET_EVENTS.ROOM_JOINED, room);
      socket.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, room);
      io.to(room.id).emit(SOCKET_EVENTS.NEW_MESSAGE, makeSystemMsg(`${player.name} joined the room!`));
      await broadcastLobby(io);
      console.log(`[Socket] ${player.name} joined room ${room.id}${isMidGameJoin ? ' (mid-game)' : ''}`);

      // ── Mid-game catch-up ──────────────────────────────────────────────
      if (isMidGameJoin) {
        const cachedSnapshot = await roomManager.getSnapshot(room.id);

        socket.emit(SOCKET_EVENTS.MID_GAME_JOIN_STATE, {
          canvasSnapshot: cachedSnapshot,
          wordHint: room.currentHint ?? '',
          timeLeft: room.currentTimeLeft ?? 0,
        });

        if (room.currentDrawer) {
          io.to(room.currentDrawer).emit(SOCKET_EVENTS.REQUEST_CANVAS_SNAPSHOT, {
            roomId: room.id,
            requestedBy: socket.id,
          });
        }
      }
    });

    // ── Canvas snapshot from drawer ───────────────────────────────────────
    socket.on(
      SOCKET_EVENTS.CANVAS_SNAPSHOT,
      async ({ roomId, snapshot, requestedBy }: { roomId: string; snapshot: string; requestedBy?: string }) => {
        const room = await roomManager.get(roomId);
        if (!room || room.currentDrawer !== socket.id) return;

        await roomManager.saveSnapshot(roomId, snapshot);

        if (requestedBy) {
          io.to(requestedBy).emit(SOCKET_EVENTS.MID_GAME_JOIN_STATE, {
            canvasSnapshot: snapshot,
            wordHint: room.currentHint ?? '',
            timeLeft: room.currentTimeLeft ?? 0,
          });
        }
      }
    );

    // ── Leave room ────────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.LEAVE_ROOM, async (roomId: string) => {
      const result = await roomManager.removePlayer(socket.id);
      socket.leave(roomId);
      currentRoomId = null;
      if (result) {
        const { room, wasDrawer } = result;
        io.to(room.id).emit(SOCKET_EVENTS.NEW_MESSAGE, makeSystemMsg('A player left the room.'));
        io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, room);
        if (wasDrawer && room.isPlaying) await endTurn(io, room.id);
      }
      await broadcastLobby(io);
    });

    // ── Start game ────────────────────────────────────────────────────────
    socket.on('startGame', async (roomId: string) => {
      const room = await roomManager.startGame(roomId);
      if (!room) {
        socket.emit(SOCKET_EVENTS.ERROR, 'Cannot start game (need at least 2 players)');
        return;
      }
      io.to(roomId).emit(SOCKET_EVENTS.GAME_STARTED, room);
      await broadcastLobby(io);
      await startNewTurn(io, roomId);
    });

    // ── Draw ──────────────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.DRAW, async (payload: DrawPayload) => {
      socket.to(payload.roomId).emit(SOCKET_EVENTS.DRAW, payload.point);

      if (payload.point.type === 'end') {
        socket.emit(SOCKET_EVENTS.REQUEST_CANVAS_SNAPSHOT, {
          roomId: payload.roomId,
          requestedBy: null,
        });
      }
    });

    // ── Clear canvas ──────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.CLEAR_CANVAS, async (payload: ClearCanvasPayload) => {
      const room = await roomManager.get(payload.roomId);
      if (!room) return;
      if (room.currentDrawer === socket.id) {
        io.to(payload.roomId).emit(SOCKET_EVENTS.CLEAR_CANVAS);
        await roomManager.clearSnapshot(payload.roomId);
      }
    });

    // ── Chat ──────────────────────────────────────────────────────────────
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

    // ── Guess ─────────────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.SEND_GUESS, async (payload: GuessPayload) => {
      const room = await roomManager.get(payload.roomId);
      if (!room || !room.isPlaying) return;
      if (room.currentDrawer === socket.id) return;

      const { correct, allGuessed } = await roomManager.checkGuess(
        payload.roomId,
        socket.id,
        payload.guess
      );

      if (correct) {
        // Fetch updated room for latest scores
        const updatedRoom = await roomManager.get(payload.roomId);
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
        if (updatedRoom) {
          io.to(payload.roomId).emit(SOCKET_EVENTS.SCORES_UPDATE, updatedRoom.players);
        }
        if (allGuessed) await endTurn(io, payload.roomId);
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

    // ── Disconnect ────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
      if (!currentRoomId) return;

      await roomManager.markDisconnected(socket.id, currentRoomId);
      socket.to(currentRoomId).emit('playerDisconnected', { socketId: socket.id });
      await broadcastLobby(io);
    });
  });
}

// ─── Turn management ──────────────────────────────────────────────────────────

async function startNewTurn(io: Server, roomId: string): Promise<void> {
  // Release any lingering end-turn lock from the previous turn
  await roomManager.releaseEndTurnLock(roomId);

  await roomManager.clearSnapshot(roomId).catch(() => {});
  io.to(roomId).emit(SOCKET_EVENTS.CLEAR_CANVAS);

  const result = await roomManager.startTurn(roomId);
  if (!result) return;

  const { room, word, hint, drawer } = result;

  io.to(roomId).emit(SOCKET_EVENTS.ROOM_UPDATE, room);
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

  const hintArr: string[] = word.split('').map((ch) => (ch === ' ' ? ' ' : '_'));

  const hintInterval = setInterval(async () => {
    const hiddenIndices = hintArr
      .map((ch, i) => (ch === '_' ? i : -1))
      .filter((i) => i !== -1);

    if (hiddenIndices.length === 0) {
      clearInterval(hintInterval);
      return;
    }

    const pick = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
    hintArr[pick] = word[pick];
    const newHint = hintArr.join(' ');

    // Persist updated hint to Redis so mid-game joiners get the latest
    await roomManager.updateHint(roomId, newHint);

    broadcastHint(io, roomId, drawer.socketId, newHint);
  }, 15000);

  let timeLeft = room.drawTime;
  const countdownInterval = setInterval(async () => {
    timeLeft -= 1;

    // Persist timeLeft to Redis every 5s (not every second — reduces Redis load)
    if (timeLeft % 5 === 0) {
      await roomManager.updateTimeLeft(roomId, timeLeft);
    }

    io.to(roomId).emit(SOCKET_EVENTS.TIMER_UPDATE, timeLeft);

    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      clearInterval(hintInterval);
      await endTurn(io, roomId);
    }
  }, 1000);

  roomManager.setIntervalRef(roomId, countdownInterval);
  roomManager.setHintIntervalRef(roomId, hintInterval);
}

async function endTurn(io: Server, roomId: string): Promise<void> {
  // Redis lock prevents double-fire across instances AND within same instance
  const acquired = await roomManager.acquireEndTurnLock(roomId);
  if (!acquired) return;

  roomManager.clearIntervalRef(roomId);
  roomManager.clearHintIntervalRef(roomId);
  await roomManager.clearSnapshot(roomId).catch(() => {});

  const room = await roomManager.get(roomId);
  if (!room) {
    await roomManager.releaseEndTurnLock(roomId);
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

  const advancement = await roomManager.advanceRound(roomId);
  if (!advancement) {
    await roomManager.releaseEndTurnLock(roomId);
    return;
  }

  if (advancement.gameOver) {
    const winner = [...advancement.room.players].sort((a, b) => b.score - a.score)[0];
    io.to(roomId).emit(SOCKET_EVENTS.GAME_ENDED, {
      players: advancement.room.players,
      winner,
    });
    await broadcastLobby(io);
    await roomManager.releaseEndTurnLock(roomId);

    if (winner?.userId) {
      UserModel.findByIdAndUpdate(winner.userId, { $inc: { wins: 1 } }).catch(
        (err) => console.error('[DB] Failed to update wins:', err)
      );
    }
  } else {
    // 4s pause between turns, then release lock and start next turn
    setTimeout(async () => {
      await roomManager.releaseEndTurnLock(roomId);
      await startNewTurn(io, roomId);
    }, 4000);
  }
}