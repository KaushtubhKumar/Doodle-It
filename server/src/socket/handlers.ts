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
  io.on('connection', async (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    let currentRoomId: string | null = null;

    // ── Auto-rejoin on reconnect ──────────────────────────────────────────
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
        const roomId = await redis.get(`player:${decoded.id}:room`);
        if (roomId) {
          const room = await roomManager.rejoinRoom(roomId, decoded.id, socket.id);
          if (room) {
            socket.join(roomId);
            currentRoomId = roomId;
            socket.emit('rejoinSuccess', room);
            socket.to(roomId).emit('roomUpdate', room);
          } else {
            await redis.del(`player:${decoded.id}:room`);
          }
        }
      } catch {
        // fresh connection, no prior room
      }
    }
    // ── Lobby ─────────────────────────────────────────────────────────────
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

    socket.on('rejoinRoom', async ({ roomId, userId }: { roomId: string; userId: string }) => {
      const room = await roomManager.rejoinRoom(roomId, userId, socket.id);
      if (!room) {
        socket.emit('rejoinFailed', { reason: 'Room no longer exists.' });
        return;
      }
      socket.join(roomId);
      socket.emit('rejoinSuccess', room);
      socket.to(roomId).emit('roomUpdate', room);
    });

    // ── Create room ───────────────────────────────────────────────────────
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
      currentRoomId = room.id;
      socket.emit(SOCKET_EVENTS.ROOM_CREATED, room);
      broadcastLobby(io);
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

      const result = roomManager.addPlayer(payload.roomId, player);
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
      broadcastLobby(io);
      console.log(`[Socket] ${player.name} joined room ${room.id}${isMidGameJoin ? ' (mid-game)' : ''}`);

      // ── Mid-game catch-up ──────────────────────────────────────────────
      // Send the new joiner the current canvas, word hint and time remaining
      // so they aren't staring at a blank canvas with no context.
      if (isMidGameJoin) {
        // 1. Immediately send whatever snapshot we have in Redis (may be a few
        //    strokes behind — that's fine, we'll get a fresher one right after).
        const cachedSnapshot = await roomManager.getSnapshot(room.id);

        socket.emit(SOCKET_EVENTS.MID_GAME_JOIN_STATE, {
          canvasSnapshot: cachedSnapshot,          // base64 PNG | null
          wordHint: room.currentHint ?? '',        // current blanks/revealed letters
          timeLeft: room.currentTimeLeft ?? 0,     // seconds remaining
        });

        // 2. Ask the drawer to send a fresh snapshot right now.
        //    The drawer's client responds with CANVAS_SNAPSHOT which we store
        //    and forward (see handler below).
        if (room.currentDrawer) {
          io.to(room.currentDrawer).emit(SOCKET_EVENTS.REQUEST_CANVAS_SNAPSHOT, {
            roomId: room.id,
            // Tag with the new joiner's socket so we can forward specifically to them
            requestedBy: socket.id,
          });
        }
      }
    });

    // ── Canvas snapshot from drawer ───────────────────────────────────────
    // Triggered by REQUEST_CANVAS_SNAPSHOT above (fresh snapshot on demand)
    // OR by the stroke-end handler below (periodic background saves).
    socket.on(
      SOCKET_EVENTS.CANVAS_SNAPSHOT,
      async ({ roomId, snapshot, requestedBy }: { roomId: string; snapshot: string; requestedBy?: string }) => {
        const room = roomManager.get(roomId);
        // Only accept snapshots from the current drawer
        if (!room || room.currentDrawer !== socket.id) return;

        // Persist to Redis (TTL is set inside saveSnapshot)
        await roomManager.saveSnapshot(roomId, snapshot);

        // If this was triggered by a specific mid-game joiner's request, forward
        // the fresh snapshot directly to that player so they don't wait for the
        // next periodic save.
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
    socket.on(SOCKET_EVENTS.LEAVE_ROOM, (roomId: string) => {
      const result = roomManager.removePlayer(socket.id);
      socket.leave(roomId);
      currentRoomId = null;
      if (result) {
        const { room, wasDrawer } = result;
        io.to(room.id).emit(SOCKET_EVENTS.NEW_MESSAGE, makeSystemMsg('A player left the room.'));
        io.to(room.id).emit(SOCKET_EVENTS.ROOM_UPDATE, room);
        if (wasDrawer && room.isPlaying) endTurn(io, room.id);
      }
      broadcastLobby(io);
    });

    // ── Start game ────────────────────────────────────────────────────────
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

    // ── Draw ──────────────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.DRAW, async (payload: DrawPayload) => {
      // Relay to everyone else in the room
      socket.to(payload.roomId).emit(SOCKET_EVENTS.DRAW, payload.point);

      // On stroke-end, ask the drawer for a fresh snapshot so Redis always
      // has the latest canvas state ready for any mid-game joiners.
      if (payload.point.type === 'end') {
        socket.emit(SOCKET_EVENTS.REQUEST_CANVAS_SNAPSHOT, {
          roomId: payload.roomId,
          requestedBy: null, // background save — no one to forward to
        });
      }
    });

    // ── Clear canvas ──────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.CLEAR_CANVAS, async (payload: ClearCanvasPayload) => {
      const room = roomManager.get(payload.roomId);
      if (!room) return;
      if (room.currentDrawer === socket.id) {
        io.to(payload.roomId).emit(SOCKET_EVENTS.CLEAR_CANVAS);
        // Wipe the stored snapshot — new joiners should see a blank canvas
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

    // ── Disconnect ────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
      if (!currentRoomId) return;

      await roomManager.markDisconnected(socket.id, currentRoomId);
      socket.to(currentRoomId).emit('playerDisconnected', { socketId: socket.id });
      broadcastLobby(io);
    });
  });
}

// ─── Turn management ──────────────────────────────────────────────────────────

function startNewTurn(io: Server, roomId: string): void {
  endingTurns.delete(roomId);

  // Clear the stored canvas snapshot — new turn = blank canvas
  roomManager.clearSnapshot(roomId).catch(() => {});

  const result = roomManager.startTurn(roomId);
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

  const hintInterval = setInterval(() => {
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

    // Update the room's cached hint so mid-game joiners get the latest version
    const r = roomManager.get(roomId);
    if (r) r.currentHint = newHint;

    broadcastHint(io, roomId, drawer.socketId, newHint);
  }, 15000);

  let timeLeft = room.drawTime;
  const countdownInterval = setInterval(() => {
    timeLeft -= 1;

    // Keep the room's timeLeft in sync for mid-game joiners
    const r = roomManager.get(roomId);
    if (r) r.currentTimeLeft = timeLeft;

    io.to(roomId).emit(SOCKET_EVENTS.TIMER_UPDATE, timeLeft);
    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      clearInterval(hintInterval);
      endTurn(io, roomId);
    }
  }, 1000);

  roomManager.setIntervalRef(roomId, countdownInterval);
  roomManager.setHintIntervalRef(roomId, hintInterval);
}

function endTurn(io: Server, roomId: string): void {
  if (endingTurns.has(roomId)) return;
  endingTurns.add(roomId);

  roomManager.clearIntervalRef(roomId);
  roomManager.clearHintIntervalRef(roomId);

  // Clear the snapshot now that the turn is over
  roomManager.clearSnapshot(roomId).catch(() => {});

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
    setTimeout(() => startNewTurn(io, roomId), 4000);
  }
}