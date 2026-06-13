import React, { useRef, useEffect, useState, useCallback } from 'react';
import { DrawPoint } from '../../types';
import { throttle } from 'lodash';

interface Props {
  isDrawer: boolean;
  roomId: string;
  onDraw: (roomId: string, point: DrawPoint) => void;
  onClearCanvas: (roomId: string) => void;
  subscribeToDrawEvents: (cb: (point: DrawPoint) => void) => () => void;
  subscribeToClearEvents: (cb: () => void) => () => void;
  /**
   * Called by this component when the server requests a canvas snapshot
   * (mid-game join: a new player just entered while we're drawing).
   * Only the current drawer needs to handle this.
   */
  onSendSnapshot: (roomId: string, snapshot: string, requestedBy: string | null) => void;
  /**
   * Register a callback that fires whenever a canvas snapshot arrives
   * from the server (mid-game join: we just entered a game in progress).
   * Returns a cleanup function.
   */
  onRestoreSnapshot: (cb: (snapshot: string) => void) => () => void;
}

const COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f59e0b', '#6366f1', '#84cc16', '#06b6d4', '#a855f7',
  '#f43f5e',
];

const STROKE_WIDTHS = [2, 4, 8, 16];

export const DrawingCanvas: React.FC<Props> = ({
  isDrawer,
  roomId,
  onDraw,
  onClearCanvas,
  subscribeToDrawEvents,
  subscribeToClearEvents,
  onSendSnapshot,
  onRestoreSnapshot,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(4);

  // ── Canvas helpers ────────────────────────────────────────────────────

  const getCtx = (): CanvasRenderingContext2D | null => {
    return canvasRef.current?.getContext('2d') ?? null;
  };

  const drawPoint = useCallback((point: DrawPoint) => {
    const ctx = getCtx();
    if (!ctx) return;

    ctx.strokeStyle = point.color;
    ctx.lineWidth = point.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (point.type === 'start') {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    } else if (point.type === 'draw') {
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  }, []);

  const clearCanvasLocal = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // ── Subscribe to incoming draw/clear events ───────────────────────────

  useEffect(() => {
    const unsubDraw = subscribeToDrawEvents(drawPoint);
    const unsubClear = subscribeToClearEvents(clearCanvasLocal);
    return () => {
      unsubDraw();
      unsubClear();
    };
  }, [subscribeToDrawEvents, subscribeToClearEvents, drawPoint, clearCanvasLocal]);

  // ── Init canvas background ────────────────────────────────────────────

  useEffect(() => {
    clearCanvasLocal();
  }, [clearCanvasLocal]);

  // ── Restore snapshot (mid-game join: we just arrived mid-turn) ────────
  // When the server sends us a canvas snapshot we paint it onto the canvas
  // via drawImage so we immediately see what has been drawn so far.

  useEffect(() => {
    const unsubRestore = onRestoreSnapshot((snapshot: string) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const img = new Image();
      img.onload = () => {
        // Draw the snapshot over the current canvas (server already cleared
        // on turn start, so this is the only content we need)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = snapshot;
    });
    return unsubRestore;
  }, [onRestoreSnapshot]);

  // ── Snapshot request (mid-game join: a new player just joined while we draw) ──
  // The server sends REQUEST_CANVAS_SNAPSHOT → useSocket fires
  // the doodle:requestSnapshot DOM event → we capture the canvas here.
  // Only the current drawer should respond.

  useEffect(() => {
    if (!isDrawer) return;

    const handleRequest = (e: Event) => {
      const { roomId: reqRoomId, requestedBy } = (e as CustomEvent<{
        roomId: string;
        requestedBy: string | null;
      }>).detail;

      if (reqRoomId !== roomId) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Compress to JPEG at 0.7 quality — keeps the base64 small (~50-150 KB)
      const snapshot = canvas.toDataURL('image/jpeg', 0.7);
      onSendSnapshot(roomId, snapshot, requestedBy);
    };

    window.addEventListener('doodle:requestSnapshot', handleRequest);
    return () => window.removeEventListener('doodle:requestSnapshot', handleRequest);
  }, [isDrawer, roomId, onSendSnapshot]);

  // ── Mouse event helpers ───────────────────────────────────────────────

  const getPos = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] ?? e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const throttledNetworkDraw = useRef(
    throttle((id: string, pt: DrawPoint, drawCb: typeof onDraw) => {
      drawCb(id, pt);
    }, 30)
  ).current;

  const emitPoint = useCallback(
    (type: DrawPoint['type'], x: number, y: number) => {
      const point: DrawPoint = { x, y, color, strokeWidth, type };

      drawPoint(point);

      if (type === 'start' || type === 'end') {
        onDraw(roomId, point);
      } else {
        throttledNetworkDraw(roomId, point, onDraw);
      }
    },
    [color, strokeWidth, drawPoint, onDraw, roomId]
  );

  // ── Mouse handlers ────────────────────────────────────────────────────

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;
    isDrawingRef.current = true;
    const { x, y } = getPos(e);
    emitPoint('start', x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawingRef.current) return;
    const { x, y } = getPos(e);
    emitPoint('draw', x, y);
  };

  const handleMouseUp = () => {
    if (!isDrawer) return;
    isDrawingRef.current = false;
    const point: DrawPoint = { x: 0, y: 0, color, strokeWidth, type: 'end' };
    onDraw(roomId, point);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawer) return;
    isDrawingRef.current = true;
    const { x, y } = getPos(e);
    emitPoint('start', x, y);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawer || !isDrawingRef.current) return;
    const { x, y } = getPos(e);
    emitPoint('draw', x, y);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    isDrawingRef.current = false;
    const point: DrawPoint = { x: 0, y: 0, color, strokeWidth, type: 'end' };
    onDraw(roomId, point);
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Canvas */}
      <div className="relative border-2 border-gray-300 rounded-lg overflow-hidden bg-white shadow-md">
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          className={`w-full touch-none ${isDrawer ? 'cursor-crosshair' : 'cursor-default'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        {!isDrawer && (
          <div className="absolute inset-0 pointer-events-none" />
        )}
      </div>

      {/* Drawing toolbar - only shown to drawer */}
      {isDrawer && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
          {/* Color palette */}
          <div className="flex flex-wrap gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  color === c ? 'border-blue-500 scale-110' : 'border-gray-300'
                }`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-gray-200" />

          {/* Stroke widths */}
          <div className="flex items-center gap-2">
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => setStrokeWidth(w)}
                className={`flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
                  strokeWidth === w
                    ? 'bg-blue-100 border-blue-400'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
                title={`${w}px`}
              >
                <div
                  className="rounded-full bg-gray-800"
                  style={{ width: w, height: w }}
                />
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-gray-200" />

          {/* Clear button */}
          <button
            onClick={() => {
              clearCanvasLocal();
              onClearCanvas(roomId);
            }}
            className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            🗑 Clear
          </button>
        </div>
      )}
    </div>
  );
};