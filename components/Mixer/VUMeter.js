'use client';

import { useEffect, useRef } from 'react';

/**
 * VU Meter — Animated level meter
 * Simulated based on volume and playing state
 */
export default function VUMeter({ isPlaying, volume = 100, color = 'var(--neon-cyan)', label = '' }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const levelRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      // Target level
      const target = isPlaying ? (volume / 100) * (0.5 + Math.random() * 0.5) : 0;
      
      // Smooth approach
      levelRef.current += (target - levelRef.current) * 0.15;
      const level = levelRef.current;

      const numBars = 20;
      const barHeight = (h - (numBars - 1) * 2) / numBars;
      const barWidth = w - 4;

      for (let i = 0; i < numBars; i++) {
        const barLevel = (numBars - i) / numBars;
        const y = i * (barHeight + 2) + 2;
        
        if (barLevel <= level) {
          // Determine color: green → yellow → red
          if (barLevel > 0.85) {
            ctx.fillStyle = '#ff0040';
            ctx.shadowColor = '#ff0040';
          } else if (barLevel > 0.7) {
            ctx.fillStyle = '#ffe600';
            ctx.shadowColor = '#ffe600';
          } else {
            ctx.fillStyle = typeof color === 'string' && color.startsWith('var(')
              ? '#00f0ff' : color;
            ctx.shadowColor = ctx.fillStyle;
          }
          ctx.shadowBlur = 4;
          ctx.globalAlpha = 0.9;
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
        }

        ctx.fillRect(2, y, barWidth, barHeight);
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, volume, color]);

  return (
    <div className="vu-meter-wrapper">
      {label && (
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '0.5rem',
          fontWeight: 600,
          letterSpacing: '1px',
          color: 'var(--text-dim)',
          textAlign: 'center',
          display: 'block',
          marginBottom: 4,
        }}>
          {label}
        </span>
      )}
      <canvas
        ref={canvasRef}
        style={{
          width: 20,
          height: 150,
          display: 'block',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid var(--border-dim)',
        }}
      />
    </div>
  );
}
