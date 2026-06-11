import { v4 as uuidv4 } from 'uuid';
import { Room, Player } from '../types';

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

class RoomManager {
  private rooms: Map<string, Room> = new Map();
  // Countdown interval for each room (ticks every second, emits TIMER_UPDATE)
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  // Hint reveal interval for each room (fires every 15s, reveals one letter)
  private hintIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  create(opts: {
    name: string;
    maxPlayers: number;
    rounds: number;
    drawTime: number;
    creatorPlayer: Player;
  }): Room {
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
    this.rooms.set(id, room);
    return room;
  }

  get(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getAll(): Room[] {
    return Array.from(this.rooms.values());
  }

  delete(roomId: string): void {
    this.clearIntervalRef(roomId);
    this.clearHintIntervalRef(roomId);
    this.rooms.delete(roomId);
  }

  addPlayer(roomId: string, player: Player): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.players.length >= room.maxPlayers) return null;
    if (room.players.find((p) => p.socketId === player.socketId)) return room;
    room.players.push(player);
    return room;
  }

  removePlayer(socketId: string): { room: Room; wasDrawer: boolean } | null {
    for (const room of this.rooms.values()) {
      const idx = room.players.findIndex((p) => p.socketId === socketId);
      if (idx !== -1) {
        const wasDrawer = room.currentDrawer === socketId;
        room.players.splice(idx, 1);
        if (wasDrawer) room.currentDrawer = undefined;
        if (room.players.length === 0) {
          this.delete(room.id);
          return null;
        }
        return { room, wasDrawer };
      }
    }
    return null;
  }

  findRoomBySocket(socketId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.players.find((p) => p.socketId === socketId)) return room;
    }
    return null;
  }

  startGame(roomId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room || room.isPlaying || room.players.length < 2) return null;
    room.isPlaying = true;
    room.currentRound = 1;
    room.players.forEach((p) => {
      p.score = 0;
      p.hasGuessedCorrectly = false;
      p.isDrawing = false;
    });
    return room;
  }

  startTurn(roomId: string): {
    room: Room;
    word: string;
    hint: string;
    drawer: Player;
  } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.players.forEach((p) => {
      p.hasGuessedCorrectly = false;
      p.isDrawing = false;
    });

    // Round-robin: (currentRound - 1) so round 1 starts at index 0
    const drawerIdx = (room.currentRound - 1) % room.players.length;
    const drawer = room.players[drawerIdx];
    drawer.isDrawing = true;
    room.currentDrawer = drawer.socketId;

    const word = getRandomWord();
    room.currentWord = word;

    return { room, word, hint: buildHint(word), drawer };
  }

  checkGuess(
    roomId: string,
    socketId: string,
    guess: string
  ): { correct: boolean; allGuessed: boolean } {
    const room = this.rooms.get(roomId);
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

    return { correct: true, allGuessed };
  }

  advanceRound(roomId: string): { gameOver: boolean; room: Room } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.currentRound++;
    if (room.currentRound > room.rounds * room.players.length) {
      room.isPlaying = false;
      room.currentWord = undefined;
      room.currentDrawer = undefined;
      return { gameOver: true, room };
    }
    return { gameOver: false, room };
  }

  // ── Countdown interval (one per room) ──────────────────────────────────

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

  // ── Hint reveal interval (one per room) ────────────────────────────────

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

  // Kept for backward compat — no-ops now that we use intervals instead
  setTimer(_roomId: string, _cb: () => void, _ms: number): void {}
  clearTimer(_roomId: string): void {}

  // ── Reconnection support ──────────────────────────────────────────────────

// Track disconnected players: socketId → { roomId, playerId, timer }
private disconnected = new Map<string, { roomId: string; playerId: string; timer: ReturnType<typeof setTimeout> }>();

markDisconnected(socketId: string, roomId: string): void {
  const room = this.rooms.get(roomId);
  if (!room) return;

  const player = room.players.find(p => p.socketId === socketId);
  if (!player) return;

  player.isConnected = false;

  // Hold the slot for 30 seconds before removing
  const timer = setTimeout(() => {
    this.forceRemovePlayer(roomId, socketId);
  }, 30_000);

  this.disconnected.set(socketId, { roomId, playerId: player.userId, timer });
}

rejoinRoom(roomId: string, playerId: string, newSocketId: string): Room | null {
  const room = this.rooms.get(roomId);
  if (!room) return null;

  const player = room.players.find(p => p.userId === playerId);
  if (!player) return null;

  // Cancel the removal timer
  const held = [...this.disconnected.values()].find(d => d.playerId === playerId && d.roomId === roomId);
  if (held) {
    clearTimeout(held.timer);
    // Remove old socketId entry
    for (const [sid, d] of this.disconnected) {
      if (d.playerId === playerId) { this.disconnected.delete(sid); break; }
    }
  }

  player.socketId    = newSocketId;
  player.isConnected = true;
  return room;
}

private forceRemovePlayer(roomId: string, socketId: string): void {
  const room = this.rooms.get(roomId);
  if (!room) return;
  room.players = room.players.filter(p => p.socketId !== socketId);
  if (room.players.length === 0) {
    this.rooms.delete(roomId);
  }
  this.disconnected.delete(socketId);
}
}

export const roomManager = new RoomManager();