import React, { useState, useRef, useEffect } from 'react';
import { debounce } from 'lodash';
import { ChatMessage } from '../../types';

interface Props {
  messages: ChatMessage[];
  isDrawer: boolean;
  roomId: string;
  playerId: string;
  playerName: string;
  onSendMessage: (roomId: string, msg: string, playerName: string) => void;
  onSendGuess: (roomId: string, guess: string, playerId: string, playerName: string) => void;
}

export const ChatBox: React.FC<Props> = ({
  messages,
  isDrawer,
  roomId,
  playerId,
  playerName,
  onSendMessage,
  onSendGuess,
}) => {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom when a new message arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* We wrap the debounce inside a useRef hook. 
    This is extremely important in React because otherwise, every time the component 
    re-renders (e.g., when you type a character), a brand new debounce timer instance 
    is created, which completely breaks the debounce logic and allows spamming.
  */
  const debouncedSendRef = useRef(
    debounce(
      (text: string, currentIsDrawer: boolean) => {
        if (currentIsDrawer) {
          onSendMessage(roomId, text, playerName);
        } else {
          onSendGuess(roomId, text, playerId, playerName);
        }
      },
      400, // 400ms cooling period to prevent fast message/guess macros
      { leading: true, trailing: false } // Fires the message instantly on the first click, then locks out for 400ms
    )
  );

  // Clean up the debounce timer if the component ever unmounts to prevent memory leaks
  useEffect(() => {
    const currentDebounce = debouncedSendRef.current;
    return () => {
      currentDebounce.cancel();
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    // Pass down arguments safely into the stable debounced execution context
    debouncedSendRef.current(text, isDrawer);
    setInput('');
  };

  const msgClass = (type: ChatMessage['type']) => {
    switch (type) {
      case 'correct-guess':
        return 'bg-green-50 border-l-4 border-green-400 text-green-800';
      case 'system':
        return 'bg-blue-50 border-l-4 border-blue-300 text-blue-700 italic';
      default:
        return 'bg-white';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-600">
          {isDrawer ? '💬 Chat' : '💡 Guess the word!'}
        </h3>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`px-2 py-1 rounded text-sm ${msgClass(msg.type)}`}
          >
            {msg.type !== 'system' && (
              <span className="font-semibold text-gray-700 mr-1">{msg.sender}:</span>
            )}
            <span>{msg.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex border-t border-gray-200">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isDrawer ? 'Chat with players...' : 'Type your guess...'}
          maxLength={100}
          className="flex-1 px-3 py-2 text-sm outline-none"
          autoComplete="off"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
};