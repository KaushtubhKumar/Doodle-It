// DrawingToolbar.tsx — Doodle-It Redesign
// DROP-IN REPLACEMENT: same props/callbacks, visual overhaul only
// Props: { color, brushSize, tool, onColorChange, onBrushSizeChange, onToolChange, onClear }

import React, { useState } from 'react';
import '../../styles/doodle-theme.css';

interface DrawingToolbarProps {
  color:             string;
  brushSize:         number;
  tool:              'pen' | 'eraser' | 'fill';
  onColorChange:     (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onToolChange:      (tool: 'pen' | 'eraser' | 'fill') => void;
  onClear:           () => void;
  disabled?:         boolean;
}

const PALETTE = [
  // Row 1 — darks / neutrals
  '#1a1a1a', '#5C3D2E', '#6B4C2A', '#4A4A8A', '#1B4F72', '#1A5C36',
  // Row 2 — mids
  '#E74C3C', '#E67E22', '#F1C40F', '#27AE60', '#2980B9', '#8E44AD',
  // Row 3 — lights / pastels
  '#FADBD8', '#FDEBD0', '#FEF9E7', '#D5F5E3', '#D6EAF8', '#E8DAEF',
  // Row 4 — warm spectrum
  '#FF6B47', '#FFD23F', '#6BCB77', '#5BC0EB', '#FF9FF3', '#ffffff',
];

const BRUSH_SIZES = [
  { label: '·',  value: 3  },
  { label: '●',  value: 8  },
  { label: '⬤',  value: 16 },
  { label: '⬛', value: 28 },
];

const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  color, brushSize, tool,
  onColorChange, onBrushSizeChange, onToolChange, onClear,
  disabled = false,
}) => {
  const [showSizes, setShowSizes] = useState(false);

  return (
    <div
      className="toolbar"
      style={{
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        userSelect: disabled ? 'none' : 'auto',
      }}
    >
      {/* ── Tool section ── */}
      <div style={{
        fontFamily: 'var(--font-hand)',
        fontSize: '0.75rem',
        color: 'var(--ink-light)',
        textAlign: 'center',
        marginBottom: 2,
      }}>Tools</div>

      <button
        className={`tool-btn ${tool === 'pen' ? 'active' : ''}`}
        onClick={() => onToolChange('pen')}
        title="Pen"
      >✏️</button>

      <button
        className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
        onClick={() => onToolChange('eraser')}
        title="Eraser"
      >🧹</button>

      <button
        className={`tool-btn ${tool === 'fill' ? 'active' : ''}`}
        onClick={() => onToolChange('fill')}
        title="Fill bucket"
      >🪣</button>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'rgba(44,24,16,0.15)', margin: '4px 0' }} />

      {/* ── Brush size picker ── */}
      <div style={{
        fontFamily: 'var(--font-hand)',
        fontSize: '0.75rem',
        color: 'var(--ink-light)',
        textAlign: 'center',
        marginBottom: 2,
      }}>Size</div>

      {BRUSH_SIZES.map(({ label, value }) => (
        <button
          key={value}
          className={`tool-btn ${brushSize === value ? 'active' : ''}`}
          onClick={() => onBrushSizeChange(value)}
          title={`${value}px`}
          style={{ fontSize: value <= 8 ? '0.7rem' : value <= 16 ? '1rem' : '1.4rem' }}
        >
          {label}
        </button>
      ))}

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'rgba(44,24,16,0.15)', margin: '4px 0' }} />

      {/* ── Color swatches ── */}
      <div style={{
        fontFamily: 'var(--font-hand)',
        fontSize: '0.75rem',
        color: 'var(--ink-light)',
        textAlign: 'center',
        marginBottom: 4,
      }}>Colors</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {/* Chunk into rows of 2 */}
        {Array.from({ length: Math.ceil(PALETTE.length / 2) }, (_, rowIdx) => (
          <div key={rowIdx} style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
            {PALETTE.slice(rowIdx * 2, rowIdx * 2 + 2).map(c => (
              <button
                key={c}
                className={`color-swatch ${color === c ? 'active' : ''}`}
                style={{
                  background: c,
                  width: 28,
                  height: 28,
                  border: c === '#ffffff'
                    ? '2px solid rgba(44,24,16,0.3)'
                    : color === c
                    ? '2.5px solid var(--ink)'
                    : '1.5px solid rgba(44,24,16,0.2)',
                }}
                onClick={() => onColorChange(c)}
                title={c}
              />
            ))}
          </div>
        ))}
      </div>

      {/* ── Current color preview ── */}
      <div style={{
        margin: '6px auto 0',
        width: 36,
        height: 36,
        borderRadius: 'var(--radius-sm)',
        background: color,
        border: 'var(--border-ink)',
        boxShadow: 'var(--shadow-sm)',
      }} />

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'rgba(44,24,16,0.15)', margin: '6px 0' }} />

      {/* ── Clear button ── */}
      <button
        className="tool-btn"
        onClick={onClear}
        title="Clear canvas"
        style={{ color: 'var(--coral)', fontWeight: 700 }}
      >
        🗑️
      </button>
    </div>
  );
};

export default DrawingToolbar;
