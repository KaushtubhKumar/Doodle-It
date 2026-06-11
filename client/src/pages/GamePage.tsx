import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../context/authStore';
import { useGameStore } from '../context/gameStore';
import { useSocket } from '../hooks/useSocket';

import { DrawingCanvas } from '../components/Canvas/DrawingCanvas';
import { ChatBox } from '../components/Chat/ChatBox';
import { Scoreboard } from '../components/Game/Scoreboard';
import { GameHeader } from '../components/Game/GameHeader';
import { GameOverScreen } from '../components/Game/GameOverScreen';
// At the top with other imports:
// Inside the GamePage component, with your other hooks:


export const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    room,
    phase,
    turnInfo,
    myWord,
    wordHint,
    timeLeft,
    revealedWord,
    winner,
    finalScores,
    messages,
    mySocketId,
    leaveRoom: leaveRoomStore,
    resetGame,
  } = useGameStore();

  const {
    startGame,
    leaveRoom,
    sendDraw,
    clearCanvas,
    sendMessage,
    sendGuess,
    onDraw,
    onClearCanvas,
  } = useSocket();

  useEffect(() => {
    if (!room) navigate('/lobby');
  }, [room, navigate]);

  if (!room || !user) return null;

  // Use mySocketId from Zustand store — set reliably on socket 'connect' event.
  // Never read socket.id directly in render; it's undefined until after connect.

  
  const isDrawer =
    !!mySocketId &&
    (room.currentDrawer === mySocketId ||
      !!room.players.find((p) => p.socketId === mySocketId && p.isDrawing));

  const isHost = room.players[0]?.socketId === mySocketId;

  const handleLeave = () => {
    leaveRoom(room.id);
    leaveRoomStore();
    navigate('/lobby');
  };

  const handlePlayAgain = () => {
    resetGame();
    startGame(room.id);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎨</span>
          <span className="font-bold text-gray-800">Skribbl</span>
          <span className="text-sm text-gray-400 ml-2">Room #{room.id}</span>
        </div>
        <button
          onClick={handleLeave}
          className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
        >
          Leave Room
        </button>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 flex flex-col gap-3">
        {/* Waiting room */}
        {phase === 'waiting' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="text-center">
              <p className="text-4xl mb-3">👋</p>
              <h2 className="text-2xl font-bold text-gray-800">{room.name}</h2>
              <p className="text-gray-500 mt-1">
                {room.players.length}/{room.maxPlayers} players · {room.rounds} rounds · {room.drawTime}s per turn
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-full max-w-sm p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Players
              </h3>
              <ul className="space-y-2">
                {room.players.map((p, i) => (
                  <li key={p.socketId} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
                      {p.name[0]?.toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-700">{p.name}</span>
                    {i === 0 && (
                      <span className="ml-auto text-xs bg-yellow-100 text-yellow-600 px-2 py-0.5 rounded-full">
                        Host
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {isHost ? (
              <button
                onClick={() => startGame(room.id)}
                disabled={room.players.length < 2}
                className="px-8 py-3 bg-green-500 text-white font-bold text-lg rounded-xl hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-md"
              >
                {room.players.length < 2 ? 'Waiting for players...' : '▶ Start Game'}
              </button>
            ) : (
              <p className="text-gray-500 text-sm animate-pulse">
                Waiting for the host to start...
              </p>
            )}
          </div>
        )}

        {/* Active game layout */}
        {(phase === 'drawing' || phase === 'turn-end') && (
          <>
            <GameHeader
              myWord={myWord}
              wordHint={wordHint}
              timeLeft={timeLeft}
              totalTime={room.drawTime}
              currentRound={room.currentRound}
              totalRounds={room.rounds}
              drawerName={turnInfo?.drawerName ?? ''}
              isDrawer={isDrawer}
              phase={phase}
              revealedWord={revealedWord}
            />

            <div className="flex flex-col lg:flex-row gap-3 flex-1">
              <div className="lg:w-52 flex-shrink-0">
                <Scoreboard
                  players={room.players}
                  currentDrawerId={room.currentDrawer}
                  mySocketId={mySocketId ?? ''}
                />
              </div>

              <div className="flex-1">
                <DrawingCanvas
                  isDrawer={isDrawer}
                  roomId={room.id}
                  onDraw={sendDraw}
                  onClearCanvas={clearCanvas}
                  subscribeToDrawEvents={onDraw}
                  subscribeToClearEvents={onClearCanvas}
                />
              </div>

              <div className="lg:w-64 flex-shrink-0 h-[500px] lg:h-auto">
                <ChatBox
                  messages={messages}
                  isDrawer={isDrawer}
                  roomId={room.id}
                  playerId={mySocketId ?? ''}
                  playerName={user.name}
                  onSendMessage={sendMessage}
                  onSendGuess={sendGuess}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {phase === 'game-over' && winner && (
        <GameOverScreen
          winner={winner}
          scores={finalScores}
          onPlayAgain={handlePlayAgain}
          onLeave={handleLeave}
        />
      )}
    </div>
  );
};