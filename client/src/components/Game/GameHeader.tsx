import React from 'react';

interface Props {
  myWord: string | null;
  wordHint: string;
  timeLeft: number;
  totalTime: number;
  currentRound: number;
  totalRounds: number;
  drawerName: string;
  isDrawer: boolean;
  phase: string;
  revealedWord: string | null;
}

export const GameHeader: React.FC<Props> = ({
  myWord,
  wordHint,
  timeLeft,
  totalTime,
  currentRound,
  totalRounds,
  drawerName,
  isDrawer,
  phase,
  revealedWord,
}) => {
  const timerPct = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
  const timerColor =
    timerPct > 50 ? 'bg-green-500' : timerPct > 25 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Timer bar */}
      <div className="h-2 bg-gray-100">
        <div
          className={`h-full transition-all duration-1000 ${timerColor}`}
          style={{ width: `${timerPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        {/* Round */}
        <span className="text-sm text-gray-500 font-medium">
          Round {currentRound}/{totalRounds}
        </span>

        {/* Word / hint */}
        <div className="text-center">
          {phase === 'turn-end' && revealedWord ? (
            <div className="text-center">
              <p className="text-xs text-gray-400 uppercase tracking-wider">The word was</p>
              <p className="text-xl font-bold text-blue-600">{revealedWord}</p>
            </div>
          ) : isDrawer && myWord ? (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider">Your word</p>
              <p className="text-xl font-bold text-purple-600 tracking-wide">{myWord}</p>
            </div>
          ) : (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">
                {drawerName} is drawing
              </p>
              <p className="text-xl font-mono font-bold tracking-[0.3em] text-gray-800">
                {wordHint}
              </p>
            </div>
          )}
        </div>

        {/* Timer */}
        <div
          className={`text-2xl font-bold tabular-nums min-w-[3rem] text-right ${
            timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-gray-700'
          }`}
        >
          {timeLeft}s
        </div>
      </div>
    </div>
  );
};
