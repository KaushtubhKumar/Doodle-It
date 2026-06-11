/**
 * NEW FILE: client/src/hooks/useRejoin.ts
 * 
 * Call this once inside GamePage.tsx.
 * On socket reconnect it auto-emits rejoinRoom so the player
 * is restored without any manual action.
 */
import { useEffect } from 'react';
import { socket } from '../utils/socket';
import { useGameStore } from '../context/gameStore';
import { useAuthStore } from '../context/authStore';

export function useRejoin() {
  const currentRoom = useGameStore(s => s.room);
  const user        = useAuthStore(s => s.user);

  useEffect(() => {
    function onReconnect() {
      if (!currentRoom || !user) return;
      socket.emit('rejoinRoom', {
        roomId: currentRoom.id,
        userId: user._id,        // adjust field name to match your auth store
      });
    }

    socket.on('reconnect', onReconnect);
    return () => { socket.off('reconnect', onReconnect); };
  }, [currentRoom, user]);
}