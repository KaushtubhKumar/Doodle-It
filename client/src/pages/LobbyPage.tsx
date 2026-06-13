import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../context/authStore';
import { useGameStore } from '../context/gameStore';
import { useSocket } from '../hooks/useSocket';
import { LobbyRoom } from '../types';

interface CreateRoomForm {
  name: string;
  maxPlayers: number;
  rounds: number;
  drawTime: number;
}

export const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { lobbyRooms, room } = useGameStore();
  const { getRooms, createRoom, joinRoom } = useSocket();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateRoomForm>({
    name: `${user?.name ?? 'Player'}'s Room`,
    maxPlayers: 8,
    rounds: 3,
    drawTime: 80,
  });

  // Poll lobby every 2s
  useEffect(() => {
    getRooms();
    const interval = setInterval(getRooms, 2000);
    return () => clearInterval(interval);
  }, [getRooms]);

  // Navigate to game when room is set
  useEffect(() => {
    if (room) navigate('/game');
  }, [room, navigate]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    createRoom({
      name: form.name,
      maxPlayers: form.maxPlayers,
      rounds: form.rounds,
      drawTime: form.drawTime,
      userId: user._id,
      userName: user.name,
      profilePic: user.profilePic,
    });
    setShowCreate(false);
  };

  // ── Join handler (works for both pre-game and mid-game) ───────────────
  // Previously this had `if (r.isPlaying) return` — that guard is now removed
  // so players can join in-progress rooms. The server handles mid-game catch-up.
  const handleJoinRoom = (r: LobbyRoom) => {
    if (!user) return;
    if (r.players >= r.maxPlayers) return; // still block full rooms
    joinRoom(r.id, user._id, user.name, user.profilePic);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎨</span>
            <h1 className="text-xl font-bold text-gray-800">Skribbl</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                {user?.name[0]?.toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-700">{user?.name}</span>
              <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full">
                🏆 {user?.wins ?? 0} wins
              </span>
            </div>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Game Rooms</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {lobbyRooms.length} room{lobbyRooms.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-600 transition-colors shadow-sm"
          >
            + Create Room
          </button>
        </div>

        {/* Room list */}
        {lobbyRooms.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-5xl mb-4">🎭</p>
            <p className="text-lg font-medium">No rooms yet</p>
            <p className="text-sm mt-1">Create one and invite your friends!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lobbyRooms.map((r) => {
              const isFull = r.players >= r.maxPlayers;
              const canJoin = !isFull;

              return (
                <div
                  key={r.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-gray-800 truncate">{r.name}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0 ${
                          r.isPlaying
                            ? 'bg-orange-100 text-orange-600'
                            : 'bg-green-100 text-green-600'
                        }`}
                      >
                        {r.isPlaying ? '🟠 In Progress' : '🟢 Open'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 space-y-1">
                      <p>👥 {r.players}/{r.maxPlayers} players</p>
                      <p>🔄 {r.rounds} rounds · ⏱ {r.drawTime}s</p>
                      <p className="font-mono text-xs text-gray-400">#{r.id}</p>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => handleJoinRoom(r)}
                      disabled={!canJoin}
                      className={`w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        r.isPlaying && canJoin
                          ? 'bg-orange-500 text-white hover:bg-orange-600'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {isFull
                        ? 'Full'
                        : r.isPlaying
                        ? '⚡ Join Mid-Game'
                        : 'Join Room'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-5">Create a Room</h3>
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Room Name
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    maxLength={40}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Players
                    </label>
                    <select
                      value={form.maxPlayers}
                      onChange={(e) => setForm({ ...form, maxPlayers: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      {[2, 4, 6, 8, 10, 12].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rounds
                    </label>
                    <select
                      value={form.rounds}
                      onChange={(e) => setForm({ ...form, rounds: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      {[2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Draw Time
                    </label>
                    <select
                      value={form.drawTime}
                      onChange={(e) => setForm({ ...form, drawTime: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    >
                      {[30, 60, 80, 120, 180].map((n) => (
                        <option key={n} value={n}>{n}s</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-blue-500 rounded-xl text-white font-semibold hover:bg-blue-600 transition-colors"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};