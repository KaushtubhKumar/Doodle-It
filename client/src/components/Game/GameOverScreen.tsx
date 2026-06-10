import React from 'react';
import { Player } from '../../types';

interface Props {
  winner: Player;
  scores: Player[];
  onPlayAgain: () => void;
  onLeave: () => void;
}

export const GameOverScreen: React.FC<Props> = ({ winner, scores, onPlayAgain, onLeave }) => {
  const sorted = [...scores].sort((a, b) => b.score - a.score);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Winner banner */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-400 p-6 text-center">
          <p className="text-4xl mb-2">🏆</p>
          <h2 className="text-2xl font-bold text-white">Game Over!</h2>
          <p className="text-white/90 mt-1">
            <span className="font-bold">{winner.name}</span> wins with {winner.score} points!
          </p>
        </div>

        {/* Final scores */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Final Standings
          </h3>
          <ul className="space-y-2">
            {sorted.map((p, i) => (
              <li key={p.socketId} className="flex items-center gap-3">
                <span className="text-lg">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
                </span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {p.name[0]?.toUpperCase()}
                </div>
                <span className="flex-1 font-medium text-gray-800">{p.name}</span>
                <span className="font-bold text-gray-700">{p.score} pts</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 pt-0">
          <button
            onClick={onLeave}
            className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Leave Room
          </button>
          <button
            onClick={onPlayAgain}
            className="flex-1 py-2.5 bg-blue-500 rounded-xl text-white font-medium hover:bg-blue-600 transition-colors"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
};
