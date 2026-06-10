import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

/**
 * Single, persistent socket instance shared across the entire app lifetime.
 * Never disconnected on component unmount — only on explicit logout.
 */
export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
});

export const connectSocket = (): void => {
  if (!socket.connected) socket.connect();
};

export const disconnectSocket = (): void => {
  if (socket.connected) socket.disconnect();
};