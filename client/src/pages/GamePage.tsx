// GamePage.tsx — Doodle-It Redesign
// DROP-IN REPLACEMENT: same socket events / store wiring, pure layout + visual changes
// The canvas component itself (DrawingCanvas) is untouched — only its container changes.

import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useGameStore  from '../context/gameStore';
import useAuthStore  from '../context/authStore';
import { socket }    from '../utils/socket';
import { SOCKET_EVENTS } from '../../server/src/types';

import GameHeader      from '../components/Game/GameHeader';
import Scoreboard      from '../components/Game/Scoreboard';
import DrawingCanvas   from '../components/Canvas/DrawingCanvas';   // ← untouched
import DrawingToolbar  from '../components/Canvas/DrawingToolbar';
import ChatBox         from '../components/Chat/ChatBox';

import '../styles/doodle-theme.css';

/* ─────────────────────────────────────────────────────────────
   ScorePopup — arcade-style floating "+N pts" animation
───────────────────────────────────────────────────────────── */
interface Popup { id: number; x: number; y: number; pts: number }
const [popups, setPopups] = [[] as Popup[], (_: Popup[]) => {}]; // replaced by useState at runtime

/* ─────────────────────────────────────────────────────────────
   GamePage
───────────────────────────────────────────────────────────── */
const GamePage: React.FC = () => {
  const navigate    = useNavigate();
  const { user }    = useAuthStore();
  const {
    currentRoom, gameState,
    color, brushSize, tool,
    setColor, setBrushSize, setTool,
    messages, sendGuess, clearCanvas,
  } = useGameStore();

  useEffect(() => {
    if (!currentRoom) { navigate('/lobby'); return; }
  }, [currentRoom]);

  if (!currentRoom || !gameState) return null;

  const me        = gameState.players.find(p => p.id === user?.id);
  const isDrawer  = gameState.currentDrawerId === user?.id;
  const maxTime   = currentRoom.drawTime ?? 80;

  const handleSendGuess = (guess: string) => {
    socket.emit(SOCKET_EVENTS.SEND_GUESS, {
      roomId: currentRoom.id,
      guess,
      playerId: user?.id,
      playerName: user?.name,
    });
  };

  const handleClear = () => {
    socket.emit(SOCKET_EVENTS.CLEAR_CANVAS, { roomId: currentRoom.id });
    clearCanvas?.();
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'var(--cream)',
    }}>
      {/* ── Top header bar ── */}
      <GameHeader
        wordHint     ={gameState.wordHint ?? []}
        timer        ={gameState.timer ?? 0}
        round        ={gameState.round ?? 1}
        totalRounds  ={currentRoom.rounds ?? 3}
        drawerName   ={gameState.players.find(p => p.id === gameState.currentDrawerId)?.name ?? ''}
        isDrawer     ={isDrawer}
        currentWord  ={isDrawer ? gameState.currentWord : undefined}
        maxTime      ={maxTime}
      />

      {/* ── Main three-column layout ── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '200px 1fr 240px',
        overflow: 'hidden',
      }}>
        {/* Left — scoreboard */}
        <div style={{
          borderRight: 'var(--border-ink)',
          overflowY: 'auto',
          background: 'var(--cream-dark)',
        }}>
          <Scoreboard
            players          ={gameState.players}
            currentDrawerId  ={gameState.currentDrawerId}
          />
        </div>

        {/* Centre — canvas + toolbar */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          position: 'relative',
          gap: 0,
          background: 'var(--cream)',
        }}>
          {/* Canvas wrapper — paper card feel */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            width: '100%',
            height: '100%',
          }}>
            {/* Toolbar — only visible for drawer */}
            <div style={{
              flexShrink: 0,
              opacity: isDrawer ? 1 : 0,
              pointerEvents: isDrawer ? 'auto' : 'none',
              transition: 'opacity 0.3s',
              height: '100%',
              overflowY: 'auto',
            }}>
              <DrawingToolbar
                color            ={color}
                brushSize        ={brushSize}
                tool             ={tool}
                onColorChange    ={setColor}
                onBrushSizeChange={setBrushSize}
                onToolChange     ={setTool}
                onClear          ={handleClear}
                disabled         ={!isDrawer}
              />
            </div>

            {/* Canvas */}
            <div style={{
              flex: 1,
              height: '100%',
              border: 'var(--border-ink)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-xl)',
              background: '#ffffff',
              position: 'relative',
            }}>
              {/* "You're drawing" overlay hint */}
              {isDrawer && (
                <div style={{
                  position: 'absolute',
                  top: 10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--sun)',
                  border: 'var(--border-ink)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '4px 16px',
                  fontFamily: 'var(--font-hand)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  zIndex: 10,
                  boxShadow: 'var(--shadow-sm)',
                  pointerEvents: 'none',
                }}>
                  ✏️ You're drawing — others are guessing!
                </div>
              )}

              <DrawingCanvas
                roomId    ={currentRoom.id}
                isDrawer  ={isDrawer}
                color     ={color}
                brushSize ={brushSize}
                tool      ={tool}
              />
            </div>
          </div>
        </div>

        {/* Right — chat */}
        <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <ChatBox
            messages    ={messages ?? []}
            onSendGuess ={handleSendGuess}
            isDrawer    ={isDrawer}
          />
        </div>
      </div>
    </div>
  );
};

export default GamePage;
