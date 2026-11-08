'use client';

import { useRef, useCallback } from 'react';

/**
 * Rotary EQ knob component
 * Visual-only (can't actually filter YouTube audio frequencies)
 * but provides satisfying interaction with rotation animation
 */
export default function EQKnob({
  label,
  value = 0,       // -1 to 1
  onChange,
  color = 'var(--neon-cyan)',
  size = 44,
}) {
  const knobRef = useRef(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  // Convert value (-1 to 1) to rotation angle (-135 to 135 degrees)
  const rotation = value * 135;

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startValue.current = value;

    const handleMouseMove = (moveEvent) => {
      if (!dragging.current) return;
      const delta = (startY.current - moveEvent.clientY) / 100;
      const newValue = Math.max(-1, Math.min(1, startValue.current + delta));
      onChange(newValue);
    };

    const handleMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [value, onChange]);

  // Double-click to reset
  const handleDoubleClick = () => {
    onChange(0);
  };

  const knobStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: `radial-gradient(circle at 40% 35%, var(--bg-control-hover), var(--bg-control))`,
    border: `2px solid ${value !== 0 ? color : 'var(--border-dim)'}`,
    position: 'relative',
    cursor: 'ns-resize',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'border-color 0.15s ease',
    boxShadow: value !== 0
      ? `0 0 8px ${color}33, 0 0 2px ${color}66`
      : '0 2px 4px rgba(0,0,0,0.3)',
    userSelect: 'none',
  };

  const indicatorStyle = {
    position: 'absolute',
    width: 2,
    height: size / 2 - 6,
    background: value !== 0 ? color : 'var(--text-dim)',
    borderRadius: 1,
    top: 4,
    left: '50%',
    transformOrigin: `center ${size / 2 - 4}px`,
    transform: `translateX(-50%) rotate(${rotation}deg)`,
    transition: dragging.current ? 'none' : 'transform 0.1s ease',
    boxShadow: value !== 0 ? `0 0 4px ${color}` : 'none',
  };

  return (
    <div className="eq-knob-wrapper" style={{ textAlign: 'center' }}>
      <div
        ref={knobRef}
        style={knobStyle}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        title={`${label}: ${(value * 100).toFixed(0)}% (drag up/down, double-click to reset)`}
      >
        <div style={indicatorStyle} />
        {/* Center dot */}
        <div style={{
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: 'var(--text-dim)',
          position: 'absolute',
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: '0.5rem',
        fontWeight: 600,
        letterSpacing: '1px',
        color: value !== 0 ? color : 'var(--text-dim)',
        marginTop: 4,
        display: 'block',
        textTransform: 'uppercase',
        transition: 'color 0.15s ease',
      }}>
        {label}
      </span>
    </div>
  );
}
