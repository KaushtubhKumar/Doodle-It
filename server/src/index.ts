import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth';
import { registerSocketHandlers } from './socket/handlers';

// ── Startup guard — fail loud rather than silently accept bad config ────────
if (!process.env.JWT_SECRET) {
  console.error('[Server] FATAL: JWT_SECRET is not set in environment. Refusing to start.');
  process.exit(1);
}

const app = express();
const httpServer = createServer(app);
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';

const io = new Server(httpServer, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'], credentials: true },
});

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiter — 10 attempts per 15 minutes on auth routes only
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Socket + DB ─────────────────────────────────────────────────────────────
registerSocketHandlers(io);

const PORT = Number(process.env.PORT ?? 3001);
const MONGO_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/skribbl';

async function main(): Promise<void> {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('[DB] Connected to MongoDB');
    httpServer.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

main();

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});