// LoginPage.tsx — Doodle-It Redesign
// DROP-IN REPLACEMENT: same imports/exports, pure visual changes only
// All logic (useAuthStore, navigate, handleSubmit) stays identical

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../context/authStore';
import '../styles/doodle-theme.css';

const LoginPage: React.FC = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const { login, isLoading }    = useAuthStore();
  const navigate                = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/lobby');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="auth-page">
      {/* Floating doodle decorations */}
      <div style={{
        position: 'fixed', top: 40, left: 60,
        fontSize: '3rem', opacity: 0.18, transform: 'rotate(-15deg)',
        pointerEvents: 'none', userSelect: 'none',
      }}>✏️</div>
      <div style={{
        position: 'fixed', bottom: 80, right: 80,
        fontSize: '4rem', opacity: 0.13, transform: 'rotate(10deg)',
        pointerEvents: 'none', userSelect: 'none',
      }}>🎨</div>
      <div style={{
        position: 'fixed', top: '30%', right: 40,
        fontSize: '2.5rem', opacity: 0.14, transform: 'rotate(8deg)',
        pointerEvents: 'none', userSelect: 'none',
      }}>⭐</div>

      <div className="auth-card paper-card no-tape">
        {/* Big playful title */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '3.2rem',
            lineHeight: 1,
            letterSpacing: '-1px',
          }}>
            <span style={{ color: 'var(--coral)' }}>Doodle</span>
            <span style={{ color: 'var(--ink)' }}>-It</span>
            <span style={{ marginLeft: 8, fontSize: '2rem' }}>✏️</span>
          </h1>
          <p className="auth-tagline">Draw. Guess. Win the room.</p>
        </div>

        {/* Sticky note sub-header */}
        <div style={{
          background: 'var(--sun)',
          border: 'var(--border-ink)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 16px',
          marginBottom: 24,
          fontFamily: 'var(--font-hand)',
          fontSize: '1.1rem',
          textAlign: 'center',
          transform: 'rotate(0.5deg)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          Welcome back, artist! 🖌️
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className="input-label">Email address</label>
            <input
              type="email"
              className="input-field"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="input-label">Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div style={{
              background: '#FFE5DF',
              border: '2px solid var(--coral)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              fontWeight: 700,
              fontSize: '0.9rem',
              color: 'var(--coral-dark)',
            }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-coral btn-lg"
            disabled={isLoading}
            style={{ width: '100%', marginTop: 4 }}
          >
            {isLoading ? '⏳ Signing in…' : '🚀 Let\'s Draw!'}
          </button>
        </form>

        <hr className="divider" />

        <p style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.95rem' }}>
          New here?{' '}
          <Link to="/register" style={{ color: 'var(--coral)', textDecoration: 'none', fontWeight: 800 }}>
            Join the game →
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
