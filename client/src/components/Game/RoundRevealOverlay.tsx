// RoundRevealOverlay.tsx — Doodle-It Redesign
// Shown between rounds: reveals the word + score changes
// Props: { word: string, scores: ScoreDelta[], onDone: () => void }

import React, { useEffect, useState } from 'react';
import '../styles/doodle-theme.css';

interface ScoreDelta {
  playerId:   string;
  playerName: string;
  gained:     number;
  total:      number;
}

interface RoundRevealProps {
  word:    string;
  scores:  ScoreDelta[];
  onDone:  () => void;
  round:   number;
  totalRounds: number;
}

const RoundRevealOverlay: React.FC<RoundRevealProps> = ({
  word, scores, onDone, round, totalRounds,
}) => {
  const [step, setStep] = useState<'word' | 'scores' | 'done'>('word');

  useEffect(() => {
    const t1 = setTimeout(() => setStep('scores'), 1400);
    const t2 = setTimeout(() => { setStep('done'); onDone(); }, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(44,24,16,0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 3000,
      backdropFilter: 'blur(4px)',
      padding: 16,
    }}>
      <div
        className="paper-card no-tape"
        style={{
          width: '100%',
          maxWidth: 520,
          padding: '40px 32px',
          textAlign: 'center',
          animation: 'slide-in 0.5s var(--bounce)',
        }}
      >
        {/* Tape decoration */}
        <div style={{
          position: 'absolute', top: -14, left: '50%',
          transform: 'translateX(-50%) rotate(-1deg)',
          width: 80, height: 24,
          background: 'var(--tape)',
          border: '1px solid rgba(44,24,16,0.15)',
          borderRadius: 3,
        }} />

        {/* Round label */}
        <div style={{
          fontFamily: 'var(--font-hand)',
          fontSize: '1rem',
          color: 'var(--ink-light)',
          marginBottom: 8,
        }}>
          Round {round} of {totalRounds} complete!
        </div>

        {/* Word reveal */}
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.4rem',
          marginBottom: 12,
          color: 'var(--ink-light)',
        }}>
          The word was…
        </h2>

        <div style={{
          display: 'inline-block',
          background: 'var(--sun)',
          border: 'var(--border-ink)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 32px',
          fontFamily: 'var(--font-display)',
          fontSize: '2.2rem',
          letterSpacing: 2,
          textTransform: 'capitalize',
          boxShadow: 'var(--shadow-md)',
          animation: 'letter-pop 0.5s var(--bounce)',
          marginBottom: 28,
        }}>
          {word}
        </div>

        {/* Score deltas */}
        {step !== 'word' && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            animation: 'slide-in 0.4s var(--bounce)',
          }}>
            <div style={{
              fontFamily: 'var(--font-hand)',
              fontSize: '1.1rem',
              color: 'var(--ink-light)',
              marginBottom: 4,
            }}>
              Score changes
            </div>

            {scores
              .sort((a, b) => b.gained - a.gained)
              .map((s, i) => (
                <div
                  key={s.playerId}
                  className="score-row"
                  style={{
                    opacity: 0,
                    animation: `slide-in 0.4s var(--bounce) ${i * 0.1}s forwards`,
                  }}
                >
                  <span style={{ flex: 1, fontWeight: 700 }}>{s.playerName}</span>
                  {s.gained > 0 ? (
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      color: 'var(--sage-dark)',
                      fontSize: '1rem',
                    }}>
                      +{s.gained}
                    </span>
                  ) : (
                    <span style={{
                      fontFamily: 'var(--font-hand)',
                      color: 'var(--ink-light)',
                      fontSize: '0.9rem',
                    }}>—</span>
                  )}
                  <span className="score-points" style={{ marginLeft: 16 }}>{s.total}</span>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
};

export default RoundRevealOverlay;
