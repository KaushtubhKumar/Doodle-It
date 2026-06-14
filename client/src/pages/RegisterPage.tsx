// RegisterPage.tsx — Doodle-It Redesign
// DROP-IN REPLACEMENT: same logic, visual overhaul only

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuthStore from '../context/authStore';
import '../styles/doodle-theme.css';

const AVATAR_EMOJIS = ['🐼', '🦊', '🐸', '🦄', '🐙', '🦋', '🐯', '🦉', '🐳', '🦁'];

const RegisterPage: React.FC = () => {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [avatar, setAvatar]     = useState(AVATAR_EMOJIS[0]);
  const [error, setError]       = useState('');
  const { register, isLoading } = useAuthStore();
  const navigate                = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await register(name, email, password);
      navigate('/lobby');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    }
  };

  return (
    <div className="auth-page">
      {/* Floating decorations */}
      <div style={{
        position: 'fixed', top: 50, right: 80,
        fontSize: '3.5rem', opacity: 0.15, transform: 'rotate(12deg)',
        pointerEvents: 'none',
      }}>🎭</div>
      <div style={{
        position: 'fixed', bottom: 60, left: 60,
        fontSize: '3rem', opacity: 0.13, transform: 'rotate(-8deg)',
        pointerEvents: 'none',
      }}>🖍️</div>

      <div className="auth-card paper-card no-tape" style={{ maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2.8rem',
            lineHeight: 1,
          }}>
            <span style={{ color: 'var(--sage-dark)' }}>Join</span>{' '}
            <span style={{ color: 'var(--coral)' }}>the Fun!</span>
          </h1>
          <p className="auth-tagline" style={{ marginTop: 6 }}>Pick your character and start drawing</p>
        </div>

        {/* Avatar picker */}
        <div style={{
          background: 'var(--cream-dark)',
          border: 'var(--border-thin)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          marginBottom: 20,
        }}>
          <span className="input-label" style={{ marginBottom: 10 }}>Choose your character badge</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {AVATAR_EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => setAvatar(emoji)}
                style={{
                  width: 48,
                  height: 48,
                  fontSize: '1.6rem',
                  border: avatar === emoji ? '2.5px solid var(--ink)' : '2px solid transparent',
                  borderRadius: '50%',
                  background: avatar === emoji ? 'var(--sun)' : 'var(--paper)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  boxShadow: avatar === emoji ? 'var(--shadow-sm)' : 'none',
                  transform: avatar === emoji ? 'scale(1.15)' : 'scale(1)',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="input-label">Your name</label>
            <input
              type="text"
              className="input-field"
              placeholder="What do your friends call you?"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="input-label">Email</label>
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
              placeholder="Make it hard to guess!"
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
            className="btn btn-sage btn-lg"
            disabled={isLoading}
            style={{ width: '100%', marginTop: 4 }}
          >
            {isLoading ? '⏳ Creating account…' : '🎨 Start Drawing!'}
          </button>
        </form>

        <hr className="divider" />

        <p style={{ textAlign: 'center', fontWeight: 600 }}>
          Already playing?{' '}
          <Link to="/login" style={{ color: 'var(--coral)', textDecoration: 'none', fontWeight: 800 }}>
            Sign in →
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
