// Scoreboard.tsx — Doodle-It Redesign
// DROP-IN REPLACEMENT: same props, pure visual changes
// Props: { players: Player[], currentDrawerId?: string }

import React from 'react';
import '../../styles/doodle-theme.css';

interface Player {
  id:      string;
  name:    string;
  score:   number;
  hasGuessed?: boolean;
}

interface ScoreboardProps {
  players:          Player[];
  currentDrawerId?: string;
}

const AVATAR_COLORS = [
  'var(--coral)', 'var(--sage)', 'var(--sky)', 'var(--sun)',
  '#FFB5E8', '#B5DEFF', '#BAFFC9', '#FFD1A9',
];

const RANK_LABELS = ['🥇', '🥈', '🥉'];

const Scoreboard: React.FC<ScoreboardProps> = ({ players, currentDrawerId }) => {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: 'var(--border-thin)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: '1.2rem' }}>🏆</span>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem' }}>
          Players
        </h3>
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'var(--font-hand)',
          fontSize: '0.9rem',
          color: 'var(--ink-light)',
        }}>
          {players.length} in room
        </span>
      </div>

      {/* Player list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
      }}>
        {sorted.map((player, i) => {
          const isDrawer  = player.id === currentDrawerId;
          const bgColor   = AVATAR_COLORS[i % AVATAR_COLORS.length];
          const hasGuessed = player.hasGuessed;

          return (
            <div
              key={player.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                background: hasGuessed ? 'rgba(107,203,119,0.15)' : 'var(--paper)',
                border: `2px solid ${hasGuessed ? 'var(--sage)' : 'rgba(44,24,16,0.15)'}`,
                borderRadius: 'var(--radius-md)',
                transition: 'all 0.3s var(--bounce)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Rank */}
              <span style={{ fontSize: '1rem', width: 22, flexShrink: 0, textAlign: 'center' }}>
                {RANK_LABELS[i] ?? `${i+1}.`}
              </span>

              {/* Avatar */}
              <div style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: bgColor,
                border: '2px solid var(--ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: '0.95rem',
                flexShrink: 0,
                fontWeight: 700,
              }}>
                {player.name[0]?.toUpperCase()}
              </div>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {player.name}
                  {isDrawer && (
                    <span style={{
                      marginLeft: 6,
                      fontSize: '0.75rem',
                      background: 'var(--coral)',
                      color: '#fff',
                      borderRadius: 'var(--radius-pill)',
                      padding: '1px 7px',
                      fontFamily: 'var(--font-display)',
                    }}>✏️ Drawing</span>
                  )}
                  {hasGuessed && !isDrawer && (
                    <span style={{
                      marginLeft: 6,
                      fontSize: '0.75rem',
                      background: 'var(--sage)',
                      color: 'var(--ink)',
                      borderRadius: 'var(--radius-pill)',
                      padding: '1px 7px',
                      fontFamily: 'var(--font-display)',
                    }}>✓ Got it!</span>
                  )}
                </div>
              </div>

              {/* Score */}
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.1rem',
                color: 'var(--coral)',
                flexShrink: 0,
              }}>
                {player.score}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Scoreboard;
