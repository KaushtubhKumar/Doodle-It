// WordSelectionModal.tsx — Doodle-It Redesign
// DROP-IN REPLACEMENT: same onSelectWord callback, visual overhaul
// Props: { words: string[], onSelectWord: (word: string) => void, timeLeft: number }

import React, { useState, useEffect } from 'react';
import '../styles/doodle-theme.css';

interface WordSelectionModalProps {
  words:         string[];
  onSelectWord:  (word: string) => void;
  timeLeft:      number;
}

const WordSelectionModal: React.FC<WordSelectionModalProps> = ({
  words, onSelectWord, timeLeft,
}) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const isUrgent = timeLeft <= 5;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(44,24,16,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      backdropFilter: 'blur(3px)',
      padding: 16,
    }}>
      <div
        className="paper-card no-tape"
        style={{
          width: '100%',
          maxWidth: 500,
          padding: '36px 32px',
          transform: 'rotate(-0.5deg)',
          animation: 'slide-in 0.4s var(--bounce)',
        }}
      >
        {/* Tape strips at top */}
        {['-30px', '40%'].map((left, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: -12,
            left,
            width: 64,
            height: 20,
            background: 'var(--tape)',
            border: '1px solid rgba(44,24,16,0.15)',
            borderRadius: 3,
            transform: `rotate(${i === 0 ? '-3deg' : '2deg'})`,
          }} />
        ))}

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.8rem',
            marginBottom: 4,
          }}>
            ✏️ Pick your word!
          </h2>
          <p style={{
            fontFamily: 'var(--font-hand)',
            fontSize: '1rem',
            color: 'var(--ink-light)',
          }}>
            Choose wisely — everyone else has to guess it
          </p>
        </div>

        {/* Timer pill */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: 24,
        }}>
          <div style={{
            background: isUrgent ? 'var(--coral)' : 'var(--cream-dark)',
            color: isUrgent ? '#fff' : 'var(--ink)',
            border: 'var(--border-ink)',
            borderRadius: 'var(--radius-pill)',
            padding: '6px 20px',
            fontFamily: 'var(--font-display)',
            fontSize: '1.2rem',
            boxShadow: 'var(--shadow-sm)',
            transition: 'background 0.3s',
            animation: isUrgent ? 'timer-pulse 0.5s ease infinite alternate' : 'none',
          }}>
            ⏱ {timeLeft}s
          </div>
        </div>

        {/* Word choices */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          {words.map((word, i) => {
            const colors = ['var(--coral)', 'var(--sage)', 'var(--sky)'];
            const rotations = ['-1deg', '0.5deg', '-0.3deg'];
            const isHov = hovered === word;

            return (
              <button
                key={word}
                className="btn"
                onClick={() => onSelectWord(word)}
                onMouseEnter={() => setHovered(word)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  background: isHov ? colors[i % colors.length] : 'var(--paper)',
                  color: isHov ? (i === 0 ? '#fff' : 'var(--ink)') : 'var(--ink)',
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.25rem',
                  letterSpacing: 1,
                  padding: '16px 24px',
                  textTransform: 'capitalize',
                  transform: isHov
                    ? `rotate(${rotations[i % rotations.length]}) scale(1.03)`
                    : `rotate(${rotations[i % rotations.length]})`,
                  width: '100%',
                  justifyContent: 'center',
                  transition: 'all 0.2s var(--bounce)',
                  boxShadow: isHov ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
                }}
              >
                {word}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WordSelectionModal;
