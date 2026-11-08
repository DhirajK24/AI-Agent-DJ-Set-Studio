'use client';

import { useEffect, useRef } from 'react';

/**
 * Animated waveform visualization (simulated)
 * Draws a responsive, audio-reactive waveform on canvas
 */
export default function WaveformViz({ 
  isPlaying, 
  currentTime, 
  duration, 
  color = '#00f0ff',
  dimColor = '#007a82',
  videoId,
  className = ''
}) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const barsRef = useRef([]);
  const phaseRef = useRef(0);

  // Generate deterministic "waveform" based on video ID
  useEffect(() => {
    const bars = [];
    const numBars = 200;
    const seed = videoId ? hashCode(videoId) : 42;
    
    for (let i = 0; i < numBars; i++) {
      // Create a pseudo-random but deterministic waveform shape
      const x = i / numBars;
      const base = 0.3 + 
        0.3 * Math.sin(x * 6.28 * 3 + seed) + 
        0.2 * Math.sin(x * 6.28 * 7 + seed * 2) +
        0.15 * Math.cos(x * 6.28 * 13 + seed * 0.5) +
        0.1 * Math.sin(x * 6.28 * 23 + seed * 3);
      bars.push(Math.max(0.1, Math.min(1, Math.abs(base))));
    }
    barsRef.current = bars;
  }, [videoId]);

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
    window.addEventListener('resize', resize);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      const bars = barsRef.current;
      if (bars.length === 0) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      const numBars = bars.length;
      const barWidth = w / numBars;
      const progress = duration > 0 ? currentTime / duration : 0;
      const progressX = progress * w;

      if (isPlaying) {
        phaseRef.current += 0.02;
      }

      for (let i = 0; i < numBars; i++) {
        const x = i * barWidth;
        let barHeight = bars[i] * h * 0.8;

        // Add subtle animation when playing
        if (isPlaying) {
          const wave = Math.sin(phaseRef.current + i * 0.15) * 0.15;
          barHeight *= (1 + wave);
        }

        const halfBar = barHeight / 2;
        const centerY = h / 2;

        // Color: played = bright, unplayed = dim
        if (x < progressX) {
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = isPlaying ? 4 : 2;
        } else {
          ctx.fillStyle = dimColor;
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }

        // Draw symmetric bar
        const bw = Math.max(1, barWidth - 1);
        ctx.fillRect(x, centerY - halfBar, bw, halfBar);
        
        // Lower half slightly dimmer
        ctx.globalAlpha = 0.6;
        ctx.fillRect(x, centerY, bw, halfBar);
        ctx.globalAlpha = 1;
      }

      // Playhead line
      if (duration > 0) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(progressX - 1, 0, 2, h);

        // Glow on playhead
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = color;
        ctx.fillRect(progressX - 0.5, 0, 1, h);
        ctx.shadowBlur = 0;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, currentTime, duration, color, dimColor]);

  return (
    <canvas 
      ref={canvasRef} 
      className={`waveform-canvas ${className}`}
      style={{ 
        width: '100%', 
        height: '48px', 
        display: 'block',
        borderRadius: 'var(--radius-sm)',
        background: 'rgba(0,0,0,0.3)',
      }} 
    />
  );
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
