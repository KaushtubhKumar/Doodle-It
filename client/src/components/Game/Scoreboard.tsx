import React from 'react';
import { Player } from '../../types';

interface Props {
  players: Player[];
  currentDrawerId?: string;
  mySocketId?: string;
}

export const Scoreboard: React.FC<Props> = ({ players, currentDrawerId, mySocketId }) => {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-600">👥 Players</h3>
      </div>
      <ul className="divide-y divide-gray-100">
        {sorted.map((p, i) => (
          <li
            key={p.socketId}
            className={`flex items-center gap-3 px-4 py-2.5 ${
              p.socketId === mySocketId ? 'bg-blue-50' : ''
            }`}
          >
            {/* Rank */}
            <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>

            {/* Avatar */}
            <div className="relative">
              {p.profilePic ? (
                <img
                  src={p.profilePic}
                  alt={p.name}
                  className="w-8 h-8 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                  {p.name[0]?.toUpperCase()}
                </div>
              )}
              {/* Status badges */}
              {p.socketId === currentDrawerId && (
                <span className="absolute -top-1 -right-1 text-xs">✏️</span>
              )}
              {p.hasGuessedCorrectly && !p.isDrawing && (
                <span className="absolute -top-1 -right-1 text-xs">✅</span>
              )}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {p.name}
                {p.socketId === mySocketId && (
                  <span className="ml-1 text-xs text-blue-500">(you)</span>
                )}
              </p>
            </div>

            {/* Score */}
            <span className="text-sm font-bold text-gray-700">{p.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
