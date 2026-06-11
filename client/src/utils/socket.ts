import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  auth: (cb) => {
    // Called on every connect/reconnect — always sends fresh token
    const token = localStorage.getItem('skribbl_token');
    cb({ token });
  },
});

export const connectSocket = (): void => {
  if (!socket.connected) socket.connect();
};

export const disconnectSocket = (): void => {
  if (socket.connected) socket.disconnect();
};