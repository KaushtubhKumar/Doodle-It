// GameOverPage.tsx — Doodle-It Redesign
// DROP-IN REPLACEMENT: same logic/socket events, full visual overhaul
// Props sourced from useGameStore (same as before)

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useGameStore from '../context/gameStore';
import useAuthStore from '../context/authStore';
import '../styles/doodle-theme.css';

/* ─── Confetti particle ─── */
const CONFETTI_COLORS = [
  'var(--coral)', 'var(--sun)', 'var(--sage)', 'var(--sky)', '#FFB5E8', '#B5DEFF',
];

interface Piece {
  id:    number;
  left:  number;
  delay: number;
  color: string;
  size:  number;
  rot:   number;
}

const GameOverPage: React.FC = () => {
  const navigate         = useNavigate();
  const { user }         = useAuthStore();
  const { gameState, currentRoom, resetGame } = useGameStore();
  const [confetti, setConfetti] = useState<Piece[]>([]);
  const [revealed, setRevealed] = useState(false);

  const sorted = [...(gameState?.players ?? [])].sort((a, b) => b.score - a.score);
  const top3   = sorted.slice(0, 3);
  const rest   = sorted.slice(3);
  const myRank = sorted.findIndex(p => p.id === user?.id) + 1;

  /* Spawn confetti on mount */
  useEffect(() => {
    const pieces: Piece[] = Array.from({ length: 48 }, (_, i) => ({
      id:    i,
      left:  Math.random() * 100,
      delay: Math.random() * 2.5,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size:  8 + Math.random() * 10,
      rot:   Math.random() * 360,
    }));
    setConfetti(pieces);
    /* Stagger reveal of podium */
    setTimeout(() => setRevealed(true), 200);
  }, []);

  const handlePlayAgain = () => {
    resetGame?.();
    navigate('/lobby');
  };

  /* Podium order: 2nd, 1st, 3rd */
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const podiumHeight: Record<number, number> = { 0: 90, 1: 130, 2: 70 };
  const podiumLabel:  Record<number, string> = { 0: '🥈', 1: '🥇', 2: '🥉' };
  const podiumColor:  Record<number, string> = {
    0: '#D0D0D0',
    1: 'var(--sun)',
    2: '#C9906A',
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: '32px 16px 48px',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* ── Confetti ── */}
      {confetti.map(p => (
        <div
          key={p.id}
          style={{
            position: 'fixed',
            left:     `${p.left}%`,
            top:      -20,
            width:    p.size,
            height:   p.size * 0.6,
            background: p.color,
            border:   '1px solid rgba(44,24,16,0.2)',
            borderRadius: 2,
            transform: `rotate(${p.rot}deg)`,
            animation: `confetti-fall ${3 + Math.random()}s ${p.delay}s linear forwards`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      ))}

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto' }}>
        {/* ── Title ── */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.4rem, 6vw, 4rem)',
            lineHeight: 1.1,
            marginBottom: 6,
          }}>
            <span style={{ color: 'var(--coral)' }}>Game</span>{' '}
            <span style={{ color: 'var(--ink)' }}>Over!</span>{' '}
            <span>🎉</span>
          </h1>
          <p style={{
            fontFamily: 'var(--font-hand)',
            fontSize: '1.3rem',
            color: 'var(--ink-light)',
          }}>
            {myRank === 1
              ? "You won! You absolute genius. 🏆"
              : myRank <= 3
              ? `Nice work — you finished #${myRank}! Almost there…`
              : `You finished #${myRank}. Better luck next round!`
            }
          </p>
        </div>

        {/* ── Podium ── */}
        {top3.length > 0 && (
          <div className="paper-card no-tape" style={{
            padding: '28px 24px 0',
            marginBottom: 24,
            overflow: 'visible',
          }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.3rem',
              marginBottom: 20,
              textAlign: 'center',
            }}>
              🏆 Top Players
            </h2>

            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: 10,
            }}>
              {podiumOrder.map((player, displayIdx) => {
                /* Map display positions back to actual rank */
                const actualRank = top3.indexOf(player); // 0=1st, 1=2nd, 2=3rd
                const height = podiumHeight[displayIdx];
                const isMe   = player?.id === user?.id;

                return player ? (
                  <div
                    key={player.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      opacity: revealed ? 1 : 0,
                      transform: revealed ? 'translateY(0)' : 'translateY(30px)',
                      transition: `all 0.5s var(--bounce) ${displayIdx * 0.12}s`,
                    }}
                  >
                    {/* Player avatar */}
                    <div style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      background: podiumColor[displayIdx],
                      border: 'var(--border-ink)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--font-display)',
                      fontSize: '1.5rem',
                      boxShadow: isMe ? '0 0 0 3px var(--coral), var(--shadow-md)' : 'var(--shadow-md)',
                    }}>
                      {player.name[0]?.toUpperCase()}
                    </div>

                    <div style={{
                      fontFamily: 'var(--font-hand)',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      textAlign: 'center',
                      maxWidth: 80,
                      wordBreak: 'break-word',
                    }}>
                      {player.name}{isMe ? ' (you)' : ''}
                    </div>

                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '1rem',
                      color: 'var(--coral)',
                    }}>
                      {player.score} pts
                    </div>

                    {/* Podium block */}
                    <div style={{
                      width: 90,
                      height,
                      background: podiumColor[displayIdx],
                      border: 'var(--border-ink)',
                      borderRadius: '8px 8px 0 0',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      paddingTop: 8,
                      fontSize: '1.6rem',
                      boxShadow: 'var(--shadow-md)',
                    }}>
                      {podiumLabel[displayIdx]}
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}

        {/* ── Full scoreboard ── */}
        {sorted.length > 0 && (
          <div className="paper-card no-tape" style={{ padding: '20px 20px 24px', marginBottom: 24 }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.2rem',
              marginBottom: 14,
            }}>
              📊 Final Standings
            </h2>

            <div className="scoreboard">
              {sorted.map((player, i) => {
                const isMe = player.id === user?.id;
                const rankEmoji = ['🥇','🥈','🥉'][i] ?? `${i + 1}.`;

                return (
                  <div
                    key={player.id}
                    className="score-row"
                    style={{
                      background: isMe ? 'rgba(255,107,71,0.1)' : 'var(--paper)',
                      border: isMe ? '2px solid var(--coral)' : 'var(--border-thin)',
                      transform: revealed ? 'translateX(0)' : 'translateX(-20px)',
                      opacity: revealed ? 1 : 0,
                      transition: `all 0.4s var(--bounce) ${i * 0.07}s`,
                    }}
                  >
                    <span className="score-rank">{rankEmoji}</span>
                    <span style={{ flex: 1, fontWeight: isMe ? 800 : 600 }}>
                      {player.name}{isMe ? ' ← you' : ''}
                    </span>
                    <span className="score-points">{player.score} pts</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Actions ── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
          <button className="btn btn-coral btn-lg" onClick={handlePlayAgain}>
            🎨 Play Again
          </button>
          <button className="btn btn-ghost" onClick={() => navigate('/lobby')}>
            Back to Lobby
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverPage;
