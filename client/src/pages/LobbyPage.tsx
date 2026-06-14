// LobbyPage.tsx — Doodle-It Redesign
// DROP-IN REPLACEMENT: same socket events / store calls, pure visual changes

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../context/authStore';
import useGameStore from '../context/gameStore';
import { socket } from '../utils/socket';
import { SOCKET_EVENTS } from '../../server/src/types'; // adjust path as needed
import '../styles/doodle-theme.css';

const ROOM_COLORS = ['var(--sun)', 'var(--sage)', 'var(--sky)', '#FFB5E8', '#B5DEFF'];

const LobbyPage: React.FC = () => {
  const { user, logout }         = useAuthStore();
  const { rooms, currentRoom }   = useGameStore();
  const navigate                 = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [roomName, setRoomName]     = useState('');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [rounds, setRounds]         = useState(3);
  const [drawTime, setDrawTime]     = useState(80);

  useEffect(() => {
    socket.emit(SOCKET_EVENTS.GET_ROOMS);
  }, []);

  useEffect(() => {
    if (currentRoom) navigate('/game');
  }, [currentRoom]);

  const handleCreate = () => {
    if (!roomName.trim()) return;
    socket.emit(SOCKET_EVENTS.CREATE_ROOM, {
      name: roomName,
      maxPlayers,
      rounds,
      drawTime,
      hostId: user?.id,
      hostName: user?.name,
    });
    setShowCreate(false);
    setRoomName('');
  };

  const handleJoin = (roomId: string) => {
    socket.emit(SOCKET_EVENTS.JOIN_ROOM, { roomId, playerId: user?.id, playerName: user?.name });
  };

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px' }}>
      {/* ── Header ── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        maxWidth: 860,
        margin: '0 auto 32px',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '2.6rem',
            lineHeight: 1,
          }}>
            <span style={{ color: 'var(--coral)' }}>Doodle</span>
            <span style={{ color: 'var(--ink)' }}>-It</span>
            <span style={{ marginLeft: 8 }}>✏️</span>
          </h1>
          <p style={{ fontFamily: 'var(--font-hand)', fontSize: '1.1rem', color: 'var(--ink-light)', marginTop: 2 }}>
            Pick a room and show off your skills!
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* User badge */}
          <div className="player-badge" style={{ transform: 'rotate(-1deg)' }}>
            <div className="player-avatar" style={{ background: 'var(--sun)' }}>
              {user?.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <span className="player-name">{user?.name}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
        </div>
      </header>

      {/* ── Main content ── */}
      <main style={{ maxWidth: 860, margin: '0 auto' }}>
        {/* Create room CTA */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}>
            🎪 Open Rooms
            {rooms.length > 0 && (
              <span style={{
                marginLeft: 10,
                background: 'var(--coral)',
                color: '#fff',
                borderRadius: 'var(--radius-pill)',
                padding: '2px 12px',
                fontSize: '1rem',
                border: 'var(--border-thin)',
                verticalAlign: 'middle',
              }}>{rooms.length}</span>
            )}
          </h2>
          <button
            className="btn btn-coral"
            onClick={() => setShowCreate(true)}
          >
            + Start a new room
          </button>
        </div>

        {/* Room list */}
        {rooms.length === 0 ? (
          <div className="paper-card no-tape" style={{
            padding: '48px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '4rem', marginBottom: 12 }}>🎨</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginBottom: 8 }}>
              No rooms open yet
            </h3>
            <p style={{ fontFamily: 'var(--font-hand)', fontSize: '1.1rem', color: 'var(--ink-light)', marginBottom: 20 }}>
              Be the first to kick things off!
            </p>
            <button className="btn btn-coral btn-lg" onClick={() => setShowCreate(true)}>
              🚀 Create the first room
            </button>
          </div>
        ) : (
          <div>
            {rooms.map((room, i) => (
              <div
                key={room.id}
                className="room-row"
                style={{ borderLeft: `5px solid ${ROOM_COLORS[i % ROOM_COLORS.length]}` }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>{room.name}</div>
                  <div style={{ fontFamily: 'var(--font-hand)', fontSize: '0.95rem', color: 'var(--ink-light)', marginTop: 2 }}>
                    👤 {room.players?.length ?? 0}/{room.maxPlayers} players
                    &nbsp;·&nbsp; 🔄 {room.rounds} rounds
                    &nbsp;·&nbsp; ⏱ {room.drawTime}s
                  </div>
                </div>

                {/* Ticket-style room code */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{
                    background: 'var(--cream-dark)',
                    border: 'var(--border-thin)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '4px 10px',
                    fontFamily: 'var(--font-hand)',
                    fontSize: '0.85rem',
                    color: 'var(--ink-light)',
                    letterSpacing: 1,
                  }}>
                    #{room.id?.slice(-6).toUpperCase()}
                  </div>
                  <button
                    className="btn btn-sun btn-sm"
                    onClick={() => handleJoin(room.id)}
                    disabled={room.players?.length >= room.maxPlayers || room.status === 'playing'}
                  >
                    {room.status === 'playing' ? '🔒 In progress' : 'Join →'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Create Room Modal ── */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(44,24,16,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16,
          backdropFilter: 'blur(2px)',
        }}>
          <div className="paper-card no-tape" style={{
            width: '100%',
            maxWidth: 460,
            padding: '36px 32px',
            transform: 'rotate(-0.5deg)',
          }}>
            {/* Tape decoration */}
            <div style={{
              position: 'absolute', top: -14, left: '50%',
              transform: 'translateX(-50%) rotate(-2deg)',
              width: 72, height: 22,
              background: 'var(--tape)',
              border: '1px solid rgba(44,24,16,0.15)',
              borderRadius: 3,
            }} />

            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: 6 }}>
              🎪 New Room
            </h2>
            <p style={{ fontFamily: 'var(--font-hand)', color: 'var(--ink-light)', marginBottom: 24, fontSize: '1rem' }}>
              Set the stage for your drawing showdown
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="input-label">Room name</label>
                <input
                  className="input-field"
                  placeholder="e.g. Saturday Doodlers"
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label className="input-label">Players</label>
                  <select
                    className="input-field"
                    value={maxPlayers}
                    onChange={e => setMaxPlayers(Number(e.target.value))}
                  >
                    {[2,4,6,8,10,12].map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Rounds</label>
                  <select
                    className="input-field"
                    value={rounds}
                    onChange={e => setRounds(Number(e.target.value))}
                  >
                    {[1,2,3,4,5,6].map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Draw time</label>
                  <select
                    className="input-field"
                    value={drawTime}
                    onChange={e => setDrawTime(Number(e.target.value))}
                  >
                    {[30,45,60,80,100,120,150,180].map(n => <option key={n}>{n}s</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)} style={{ flex: 1 }}>
                Cancel
              </button>
              <button
                className="btn btn-coral"
                onClick={handleCreate}
                disabled={!roomName.trim()}
                style={{ flex: 2 }}
              >
                🎨 Create Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LobbyPage;
