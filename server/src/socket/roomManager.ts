import { v4 as uuidv4 } from 'uuid';
import { Room, Player } from '../types';
import { redis } from '../utils/redis';

const ROOM_TTL = 7200; // 2 hours

const WORDS: string[] = [
  'apple', 'banana', 'castle', 'dragon', 'elephant', 'flower', 'guitar',
  'hospital', 'island', 'jungle', 'kitchen', 'ladder', 'mountain', 'notebook',
  'ocean', 'penguin', 'rainbow', 'shark', 'telephone', 'umbrella', 'volcano',
  'waterfall', 'xylophone', 'zebra', 'airplane', 'basketball', 'camera',
  'diamond', 'earthquake', 'fireplace', 'glasses', 'hammer', 'igloo', 'jellyfish',
  'kangaroo', 'lighthouse', 'magician', 'newspaper', 'ostrich', 'parachute',
  'quicksand', 'rocket', 'submarine', 'thunderstorm', 'unicorn', 'vampire',
  'windmill', 'yacht', 'accordion', 'birthday cake', 'chess', 'dinosaur',
  'fireworks', 'globe', 'helicopter', 'iron', 'juggler', 'keyboard',
  'lemon', 'microscope', 'narwhal', 'obstacle course', 'palm tree',
  'quarter', 'rollercoaster', 'scarecrow', 'telescope', 'universe',
];

const getRandomWord = (): string => WORDS[Math.floor(Math.random() * WORDS.length)];
const buildHint = (word: string): string =>
  word.split('').map((ch) => (ch === ' ' ? ' ' : '_')).join(' ');

// ── Redis key helpers ──────────────────────────────────────────────────────
const roomKey = (id: string) => `room:${id}`;
const ROOMS_INDEX = 'rooms:index'; // Redis Set of all active room IDs

// ── Redis helpers ──────────────────────────────────────────────────────────
async function getRoom(roomId: string): Promise<Room | null> {
  const data = await redis.get(roomKey(roomId)).catch(() => null);
  if (!data) return null;
  try { return JSON.parse(data) as Room; } catch { return null; }
}

async function saveRoom(room: Room): Promise<void> {
  await Promise.all([
    redis.set(roomKey(room.id), JSON.stringify(room), 'EX', ROOM_TTL),
    redis.sadd(ROOMS_INDEX, room.id),
  ]).catch(() => {});
}

async function deleteRoom(roomId: string): Promise<void> {
  await Promise.all([
    redis.del(roomKey(roomId)),
    redis.srem(ROOMS_INDEX, roomId),
  ]).catch(() => {});
}

class RoomManager {
  // Timers stay in-memory — they cannot be serialized to Redis.
  // Only the instance that called startTurn holds these.
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private hintIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  // ── CRUD ────────────────────────────────────────────────────────────────

  async create(opts: {
    name: string;
    maxPlayers: number;
    rounds: number;
    drawTime: number;
    creatorPlayer: Player;
  }): Promise<Room> {
    const id = uuidv4().slice(0, 8).toUpperCase();
    const room: Room = {
      id,
      name: opts.name,
      maxPlayers: opts.maxPlayers,
      rounds: opts.rounds,
      currentRound: 0,
      drawTime: opts.drawTime,
      players: [opts.creatorPlayer],
      isPlaying: false,
    };
    await saveRoom(room);
    await redis
      .set(`player:${opts.creatorPlayer.userId}:room`, id, 'EX', ROOM_TTL)
      .catch(() => {});
    return room;
  }

  async get(roomId: string): Promise<Room | null> {
    return getRoom(roomId);
  }

  async getAll(): Promise<Room[]> {
    const ids = await redis.smembers(ROOMS_INDEX).catch(() => [] as string[]);
    if (!ids.length) return [];
    const results = await Promise.all(ids.map((id) => getRoom(id)));
    // Filter nulls (expired rooms) and clean up the index
    const rooms: Room[] = [];
    const expired: string[] = [];
    results.forEach((r, i) => {
      if (r) rooms.push(r);
      else expired.push(ids[i]);
    });
    if (expired.length) {
      await redis.srem(ROOMS_INDEX, ...expired).catch(() => {});
    }
    return rooms;
  }

  async delete(roomId: string): Promise<void> {
    this.clearIntervalRef(roomId);
    this.clearHintIntervalRef(roomId);
    await deleteRoom(roomId);
  }

  // ── Players ──────────────────────────────────────────────────────────────

  async addPlayer(
    roomId: string,
    player: Player
  ): Promise<{ room: Room; isMidGameJoin: boolean } | null> {
    const room = await getRoom(roomId);
    if (!room) return null;
    if (room.players.length >= room.maxPlayers) return null;
    if (room.players.find((p) => p.socketId === player.socketId)) {
      return { room, isMidGameJoin: false };
    }

    const isMidGameJoin = room.isPlaying;
    room.players.push(player);
    await saveRoom(room);
    await redis
      .set(`player:${player.userId}:room`, room.id, 'EX', ROOM_TTL)
      .catch(() => {});
    return { room, isMidGameJoin };
  }

  async removePlayer(
    socketId: string
  ): Promise<{ room: Room; wasDrawer: boolean } | null> {
    // We need to find which room this socket is in.
    // Scan all rooms — in practice room counts are small.
    const rooms = await this.getAll();
    for (const room of rooms) {
      const idx = room.players.findIndex((p) => p.socketId === socketId);
      if (idx === -1) continue;

      const player = room.players[idx];
      await redis.del(`player:${player.userId}:room`).catch(() => {});

      const wasDrawer = room.currentDrawer === socketId;
      room.players.splice(idx, 1);
      if (wasDrawer) room.currentDrawer = undefined;

      if (room.players.length === 0) {
        await this.delete(room.id);
        return null;
      }
      await saveRoom(room);
      return { room, wasDrawer };
    }
    return null;
  }

  async findRoomBySocket(socketId: string): Promise<Room | null> {
    const rooms = await this.getAll();
    return rooms.find((r) => r.players.find((p) => p.socketId === socketId)) ?? null;
  }

  // ── Game flow ────────────────────────────────────────────────────────────

  async startGame(roomId: string): Promise<Room | null> {
    const room = await getRoom(roomId);
    if (!room || room.isPlaying || room.players.length < 2) return null;
    room.isPlaying = true;
    room.currentRound = 1;
    room.players.forEach((p) => {
      p.score = 0;
      p.hasGuessedCorrectly = false;
      p.isDrawing = false;
    });
    await saveRoom(room);
    return room;
  }

  async startTurn(roomId: string): Promise<{
    room: Room;
    word: string;
    hint: string;
    drawer: Player;
  } | null> {
    const room = await getRoom(roomId);
    if (!room) return null;

    room.players.forEach((p) => {
      p.hasGuessedCorrectly = false;
      p.isDrawing = false;
    });

    const drawerIdx = (room.currentRound - 1) % room.players.length;
    const drawer = room.players[drawerIdx];
    drawer.isDrawing = true;
    room.currentDrawer = drawer.socketId;

    const word = getRandomWord();
    room.currentWord = word;
    const hint = buildHint(word);
    room.currentHint = hint;
    room.currentTimeLeft = room.drawTime;

    await saveRoom(room);
    return { room, word, hint, drawer };
  }

  async checkGuess(
    roomId: string,
    socketId: string,
    guess: string
  ): Promise<{ correct: boolean; allGuessed: boolean }> {
    const room = await getRoom(roomId);
    if (!room || !room.currentWord) return { correct: false, allGuessed: false };

    const correct = guess.trim().toLowerCase() === room.currentWord.toLowerCase();
    if (!correct) return { correct: false, allGuessed: false };

    const player = room.players.find((p) => p.socketId === socketId);
    if (!player || player.hasGuessedCorrectly || player.isDrawing) {
      return { correct: false, allGuessed: false };
    }

    player.hasGuessedCorrectly = true;

    const guessedCount = room.players.filter((p) => p.hasGuessedCorrectly).length;
    const basePoints = Math.max(50, 200 - (guessedCount - 1) * 40);
    player.score += basePoints;

    const drawer = room.players.find((p) => p.socketId === room.currentDrawer);
    if (drawer) drawer.score += 20;

    const nonDrawers = room.players.filter((p) => !p.isDrawing);
    const allGuessed = nonDrawers.every((p) => p.hasGuessedCorrectly);

    await saveRoom(room);
    return { correct: true, allGuessed };
  }

  async advanceRound(
    roomId: string
  ): Promise<{ gameOver: boolean; room: Room } | null> {
    const room = await getRoom(roomId);
    if (!room) return null;

    room.currentRound++;
    if (room.currentRound > room.rounds * room.players.length) {
      room.isPlaying = false;
      room.currentWord = undefined;
      room.currentDrawer = undefined;
      await saveRoom(room);
      return { gameOver: true, room };
    }
    await saveRoom(room);
    return { gameOver: false, room };
  }

  // ── Hint updates (called from handlers.ts during turn) ───────────────────

  async updateHint(roomId: string, hint: string): Promise<void> {
    const room = await getRoom(roomId);
    if (!room) return;
    room.currentHint = hint;
    await saveRoom(room);
  }

  async updateTimeLeft(roomId: string, timeLeft: number): Promise<void> {
    const room = await getRoom(roomId);
    if (!room) return;
    room.currentTimeLeft = timeLeft;
    await saveRoom(room);
  }

  // ── Turn lock (prevents double endTurn across instances) ─────────────────
  // Returns true if this instance successfully acquired the lock (i.e. it
  // should proceed with ending the turn). False means another instance got
  // there first.

  async acquireEndTurnLock(roomId: string): Promise<boolean> {
    // NX = only set if not exists, EX = expire after 10s (safety valve)
const result = await redis
  .set(`lock:ending:${roomId}`, '1', 'EX', 10, 'NX')
  .catch(() => null);
    return result === 'OK';
  }

  async releaseEndTurnLock(roomId: string): Promise<void> {
    await redis.del(`lock:ending:${roomId}`).catch(() => {});
  }

  // ── Timer refs (in-memory, per-instance) ────────────────────────────────

  setIntervalRef(roomId: string, interval: ReturnType<typeof setInterval>): void {
    this.clearIntervalRef(roomId);
    this.intervals.set(roomId, interval);
  }

  clearIntervalRef(roomId: string): void {
    const existing = this.intervals.get(roomId);
    if (existing !== undefined) {
      clearInterval(existing);
      this.intervals.delete(roomId);
    }
  }

  setHintIntervalRef(roomId: string, interval: ReturnType<typeof setInterval>): void {
    this.clearHintIntervalRef(roomId);
    this.hintIntervals.set(roomId, interval);
  }

  clearHintIntervalRef(roomId: string): void {
    const existing = this.hintIntervals.get(roomId);
    if (existing !== undefined) {
      clearInterval(existing);
      this.hintIntervals.delete(roomId);
    }
  }

  // ── Canvas snapshot ──────────────────────────────────────────────────────

  async saveSnapshot(roomId: string, snapshot: string): Promise<void> {
    const room = await getRoom(roomId);
    const ttl = (room?.drawTime ?? 120) + 30;
    await redis.set(`canvas:${roomId}:snapshot`, snapshot, 'EX', ttl).catch(() => {});
  }

  async getSnapshot(roomId: string): Promise<string | null> {
    return redis.get(`canvas:${roomId}:snapshot`).catch(() => null);
  }

  async clearSnapshot(roomId: string): Promise<void> {
    await redis.del(`canvas:${roomId}:snapshot`).catch(() => {});
  }

  // ── Reconnection ─────────────────────────────────────────────────────────

  // In-memory grace-period timers (30s before force-removing a disconnected player)
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

  async markDisconnected(socketId: string, roomId: string): Promise<void> {
    const room = await getRoom(roomId);
    if (!room) return;

    const player = room.players.find((p) => p.socketId === socketId);
    if (!player) return;

    player.isConnected = false;
    await saveRoom(room);

    await redis
      .set(
        `disconnected:${player.userId}`,
        JSON.stringify({ roomId, socketId }),
        'EX',
        35
      )
      .catch(() => {});

    const timer = setTimeout(async () => {
      await this.forceRemovePlayer(roomId, socketId);
      await redis.del(`disconnected:${player.userId}`).catch(() => {});
      this.disconnectTimers.delete(socketId);
    }, 30_000);

    this.disconnectTimers.set(socketId, timer);
  }

  async rejoinRoom(
    roomId: string,
    playerId: string,
    newSocketId: string
  ): Promise<Room | null> {
    const room = await getRoom(roomId);
    if (!room) return null;

    const player = room.players.find((p) => p.userId === playerId);
    if (!player) return null;

    // Cancel the force-remove timer if it's still running
    const timer = this.disconnectTimers.get(player.socketId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(player.socketId);
    }

    await redis.del(`disconnected:${playerId}`).catch(() => {});
const wasDrawer = room.currentDrawer === player.socketId;
player.socketId = newSocketId;
player.isConnected = true;
if (wasDrawer) {
  room.currentDrawer = newSocketId;
}
await saveRoom(room);
return room;
  }

  private async forceRemovePlayer(roomId: string, socketId: string): Promise<void> {
    const room = await getRoom(roomId);
    if (!room) return;
    room.players = room.players.filter((p) => p.socketId !== socketId);
    if (room.players.length === 0) {
      await this.delete(roomId);
    } else {
      await saveRoom(room);
    }
  }
}

export const roomManager = new RoomManager();