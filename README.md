# 🎨 Skribbl.io Clone — MERN + TypeScript

A full-stack real-time multiplayer drawing & guessing game, converted from the original Flutter + Node/Express project to a complete **MERN + TypeScript** stack.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | Zustand (auth + game stores) |
| Routing | React Router v6 |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB + Mongoose |
| Real-time | Socket.IO v4 |
| Validation | Zod (server-side request validation) |
| Auth | JWT + bcryptjs |

---

## Project Structure

```
skribbl-mern/
├── package.json              ← root scripts (concurrently)
│
├── server/
│   ├── src/
│   │   ├── index.ts          ← Express + Socket.IO bootstrap
│   │   ├── types/index.ts    ← All shared interfaces & socket event constants
│   │   ├── models/
│   │   │   └── User.ts       ← Mongoose model (bcrypt, comparePassword)
│   │   ├── middleware/
│   │   │   └── auth.ts       ← JWT protect middleware
│   │   ├── routes/
│   │   │   └── auth.ts       ← /register /login /me /profile (Zod validated)
│   │   └── socket/
│   │       ├── handlers.ts   ← All Socket.IO event handlers
│   │       └── roomManager.ts← In-memory room/game state + turn/timer logic
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
└── client/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx           ← React Router setup
    │   ├── types/index.ts    ← Client-side type definitions
    │   ├── utils/
    │   │   ├── socket.ts     ← Socket.IO singleton
    │   │   └── api.ts        ← Axios instance with JWT interceptor
    │   ├── context/
    │   │   ├── authStore.ts  ← Zustand auth store
    │   │   └── gameStore.ts  ← Zustand game/lobby store
    │   ├── hooks/
    │   │   └── useSocket.ts  ← All socket events wired to game store
    │   ├── components/
    │   │   ├── ProtectedRoute.tsx
    │   │   ├── Canvas/
    │   │   │   └── DrawingCanvas.tsx  ← HTML5 Canvas, mouse+touch events
    │   │   ├── Chat/
    │   │   │   └── ChatBox.tsx        ← Chat + guess input
    │   │   └── Game/
    │   │       ├── GameHeader.tsx     ← Word hint, timer bar, round info
    │   │       ├── Scoreboard.tsx     ← Player list with scores
    │   │       └── GameOverScreen.tsx ← Winner + final standings overlay
    │   └── pages/
    │       ├── LoginPage.tsx
    │       ├── RegisterPage.tsx
    │       ├── LobbyPage.tsx  ← Room list + create room modal
    │       └── GamePage.tsx   ← Orchestrates the full game UI
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.js
    └── .env.example
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### 1. Clone & install

```bash
git clone <your-repo>
cd skribbl-mern
npm run install:all
```

### 2. Configure environment variables

**Server** — copy `server/.env.example` to `server/.env`:
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/skribbl
JWT_SECRET=change_this_to_a_long_random_string
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

**Client** — copy `client/.env.example` to `client/.env`:
```env
VITE_API_URL=http://localhost:3001/api
VITE_SERVER_URL=http://localhost:3001
```

### 3. Run in development

```bash
npm run dev
```

This starts both server (port 3001) and client (port 5173) concurrently.

### 4. Build for production

```bash
npm run build
# Server output → server/dist/
# Client output → client/dist/  (serve with nginx or express static)
```

---

## Game Flow

```
Register / Login
      ↓
    Lobby  ──────────────────→  Create Room
      ↓                              ↓
  Join Room ←────────────────  Room appears in list
      ↓
  Waiting Room (host sees Start button when ≥2 players)
      ↓
  [Host clicks Start]
      ↓
  ┌─ Turn Loop ─────────────────────────────────────────┐
  │  Server picks random drawer (round-robin)           │
  │  Drawer gets the word, everyone else gets hint      │
  │  Timer counts down (configurable 30–180s)           │
  │  Players type guesses → correct guess = points      │
  │  More points for guessing earlier                   │
  │  Drawer gets +20pts per correct guesser             │
  │  Turn ends when: all guessed OR timer hits 0        │
  │  Word revealed → 4s pause → next turn               │
  └─────────────────────────────────────────────────────┘
      ↓  (after rounds × players turns)
  Game Over screen — winner announced
  Win stored to MongoDB (user.wins++)
```

---

## TypeScript Safety Highlights

### `SOCKET_EVENTS` constant object
No raw string literals anywhere — all event names are typed:
```ts
socket.emit(SOCKET_EVENTS.SEND_GUESS, payload); // ✅
socket.emit('sendGuess', payload);               // ❌ avoided
```

### Zod validation on all API routes
```ts
const RegisterSchema = z.object({
  name: z.string().min(2).max(30),
  email: z.string().email(),
  password: z.string().min(6),
});
const parsed = RegisterSchema.safeParse(req.body);
if (!parsed.success) { res.status(400).json(...); return; }
```

### Typed socket payloads
Every socket event has a typed interface:
```ts
interface GuessPayload {
  roomId: string;
  guess: string;
  playerId: string;
  playerName: string;
}
```

### Mongoose document typing
```ts
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  comparePassword(candidate: string): Promise<boolean>;
}
```

### Zustand stores with full generics
```ts
const useAuthStore = create<AuthState>((set) => ({ ... }))
```

---

## Key Differences vs Original Flutter Project

| Feature | Original | This Conversion |
|---------|----------|-----------------|
| Frontend | Flutter (Dart) | React + TypeScript |
| UI Styling | Flutter widgets | Tailwind CSS |
| State management | Provider/Riverpod | Zustand |
| Canvas drawing | Flutter CustomPainter | HTML5 Canvas API |
| Type safety | Dart types | TypeScript strict mode + Zod |
| Auth | Basic JWT | JWT + bcrypt + Zod validation |
| Socket events | String literals | `SOCKET_EVENTS` typed const |
| Deployment | Mobile APK + server | Web app + server |

---

## API Reference

### Auth endpoints

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | `{name, email, password}` | Create account |
| POST | `/api/auth/login` | `{email, password}` | Login, get JWT |
| GET | `/api/auth/me` | — (Bearer token) | Get current user |
| PATCH | `/api/auth/profile` | `{name?, profilePic?}` | Update profile |

### Socket events (client → server)

| Event | Payload | Description |
|-------|---------|-------------|
| `getRooms` | — | Fetch lobby room list |
| `createRoom` | `CreateRoomPayload` | Create + join new room |
| `joinRoom` | `JoinRoomPayload` | Join existing room |
| `startGame` | `roomId: string` | Host starts the game |
| `draw` | `DrawPayload` | Send a draw point |
| `clearCanvas` | `{roomId}` | Clear canvas (drawer only) |
| `sendGuess` | `GuessPayload` | Submit a word guess |
| `sendMessage` | `{roomId, message, playerName}` | Send chat message |

### Socket events (server → client)

| Event | Payload | Description |
|-------|---------|-------------|
| `roomsList` | `LobbyRoom[]` | All available rooms |
| `roomCreated` | `Room` | Room successfully created |
| `roomJoined` | `Room` | Joined room state |
| `roomUpdate` | `Room` | Player joined/left |
| `gameStarted` | `Room` | Game begins |
| `newTurn` | `TurnInfo` | New drawing turn started |
| `yourTurn` | `{word}` | Sent only to current drawer |
| `timerUpdate` | `number` | Seconds remaining |
| `playerGuessed` | `{playerId, playerName}` | A player guessed correctly |
| `scoresUpdate` | `Player[]` | Updated scores |
| `turnEnded` | `TurnEndInfo` | Turn over, word revealed |
| `gameEnded` | `GameEndInfo` | Game over, final scores |
| `newMessage` | `ChatMessage` | New chat/system/guess message |
| `clearCanvas` | — | Clear the canvas |
