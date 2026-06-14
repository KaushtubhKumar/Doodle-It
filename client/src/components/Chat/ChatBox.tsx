// ChatBox.tsx — Doodle-It Redesign
// DROP-IN REPLACEMENT: same props/socket events, pure visual overhaul
// Props: { messages: Message[], onSendGuess: (guess: string) => void, isDrawer: boolean }

import React, { useEffect, useRef, useState } from 'react';
import '../../styles/doodle-theme.css';

interface Message {
  id:        string;
  sender:    string;
  text:      string;
  type:      'guess' | 'correct' | 'system';
  timestamp: number;
}

interface ChatBoxProps {
  messages:     Message[];
  onSendGuess:  (guess: string) => void;
  isDrawer:     boolean;
}

const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendGuess, isDrawer }) => {
  const [input, setInput]   = useState('');
  const bottomRef           = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isDrawer) return;
    onSendGuess(input.trim());
    setInput('');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--paper)',
      borderLeft: 'var(--border-ink)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px 10px',
        borderBottom: 'var(--border-thin)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '1.1rem' }}>💬</span>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>
          Guesses
        </h3>
        {isDrawer && (
          <span style={{
            marginLeft: 'auto',
            background: 'var(--cream-dark)',
            border: 'var(--border-thin)',
            borderRadius: 'var(--radius-pill)',
            padding: '2px 10px',
            fontFamily: 'var(--font-hand)',
            fontSize: '0.8rem',
            color: 'var(--ink-light)',
          }}>
            You're drawing!
          </span>
        )}
      </div>

      {/* Message list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '32px 16px',
            fontFamily: 'var(--font-hand)',
            fontSize: '1rem',
            color: 'var(--ink-light)',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🤔</div>
            Start guessing!
          </div>
        )}

        {messages.map(msg => {
          if (msg.type === 'system') return (
            <div key={msg.id} className="chat-bubble system" style={{ alignSelf: 'center' }}>
              {msg.text}
            </div>
          );

          if (msg.type === 'correct') return (
            <div key={msg.id} className="correct-banner">
              🎉 <strong>{msg.sender}</strong> guessed it! +points
            </div>
          );

          return (
            <div key={msg.id} className="chat-bubble guess" style={{ position: 'relative' }}>
              <span style={{
                fontFamily: 'var(--font-hand)',
                fontSize: '0.8rem',
                color: 'var(--ink-light)',
                marginRight: 6,
              }}>
                {msg.sender}:
              </span>
              {msg.text}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        style={{
          padding: '10px 12px',
          borderTop: 'var(--border-thin)',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
          background: 'var(--cream-dark)',
        }}
      >
        <input
          className="input-field"
          style={{ flex: 1, padding: '10px 14px', fontSize: '0.95rem' }}
          placeholder={isDrawer ? "You're drawing… 🤫" : "Type your guess…"}
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={isDrawer}
          autoComplete="off"
        />
        <button
          type="submit"
          className="btn btn-coral btn-sm"
          disabled={isDrawer || !input.trim()}
          style={{ flexShrink: 0 }}
        >
          ✓
        </button>
      </form>
    </div>
  );
};

export default ChatBox;
