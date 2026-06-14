// GameHeader.tsx — Doodle-It Redesign
// DROP-IN REPLACEMENT: same props interface, visual overhaul only
// Props: { wordHint: string[], timer: number, round: number, totalRounds: number,
//          drawerName: string, isDrawer: boolean, currentWord?: string }

import React from 'react';
import '../../styles/doodle-theme.css';

interface GameHeaderProps {
  wordHint:     string[];
  timer:        number;
  round:        number;
  totalRounds:  number;
  drawerName:   string;
  isDrawer:     boolean;
  currentWord?: string;
  maxTime:      number;
}

const GameHeader: React.FC<GameHeaderProps> = ({
  wordHint, timer, round, totalRounds, drawerName, isDrawer, currentWord, maxTime,
}) => {
  const isUrgent    = timer <= 10;
  const progress    = timer / maxTime;
  const circumference = 2 * Math.PI * 28; // r=28

  // Progress ring color
  const ringColor = isUrgent ? 'var(--coral)' : progress > 0.4 ? 'var(--sage)' : 'var(--sun)';

  return (
    <div className="game-header" style={{ gap: 20, flexWrap: 'nowrap', overflowX: 'auto' }}>
      {/* Round badge */}
      <div style={{ flexShrink: 0 }}>
        <div className="round-badge">
          Round {round}/{totalRounds}
        </div>
        <div style={{
          fontFamily: 'var(--font-hand)',
          fontSize: '0.85rem',
          color: 'var(--ink-light)',
          marginTop: 4,
          textAlign: 'center',
        }}>
          {isDrawer ? '✏️ Your turn!' : `🎨 ${drawerName} is drawing`}
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 48, background: 'rgba(44,24,16,0.15)', flexShrink: 0 }} />

      {/* Word hint — centered, takes remaining space */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        {isDrawer && currentWord ? (
          /* Drawer sees the word on a sticky-note */
          <div style={{
            background: 'var(--sun)',
            border: 'var(--border-ink)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 20px',
            fontFamily: 'var(--font-display)',
            fontSize: '1.6rem',
            letterSpacing: 2,
            boxShadow: 'var(--shadow-sm)',
            transform: 'rotate(-0.5deg)',
          }}>
            {currentWord}
          </div>
        ) : (
          /* Guessers see the hint letters */
          <div className="word-hint">
            {wordHint.map((char, i) => (
              char === ' ' ? (
                <div key={i} style={{ width: 18 }} />
              ) : (
                <div
                  key={i}
                  className={`hint-letter ${char !== '_' ? 'revealed' : ''}`}
                >
                  {char !== '_' ? char : ''}
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 48, background: 'rgba(44,24,16,0.15)', flexShrink: 0 }} />

      {/* Timer ring */}
      <div className={`timer-ring ${isUrgent ? 'wiggle-anim' : ''}`} style={{ flexShrink: 0 }}>
        <svg width="80" height="80" viewBox="0 0 70 70">
          {/* Track */}
          <circle cx="35" cy="35" r="28" fill="none" stroke="rgba(44,24,16,0.1)" strokeWidth="6" />
          {/* Progress */}
          <circle
            cx="35" cy="35" r="28"
            fill="none"
            stroke={ringColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
          />
        </svg>
        <div className={`timer-number ${isUrgent ? 'timer-urgent' : ''}`}>
          {timer}
        </div>
      </div>
    </div>
  );
};

export default GameHeader;
