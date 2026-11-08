'use client';

import { useCallback, useRef } from 'react';
import { equalPowerCrossfade } from '@/utils/audio';

/**
 * Custom hook for crossfader logic
 * Manages volume distribution between two decks
 */
export function useCrossfader(playerA, playerB) {
  const rafRef = useRef(null);

  const applyCrossfade = useCallback((position, masterVolume = 100) => {
    const { volA, volB } = equalPowerCrossfade(position);
    
    // Apply master volume
    const masterFactor = masterVolume / 100;
    const finalA = Math.round(volA * masterFactor);
    const finalB = Math.round(volB * masterFactor);

    if (playerA?.setVolume) playerA.setVolume(finalA);
    if (playerB?.setVolume) playerB.setVolume(finalB);

    return { volA: finalA, volB: finalB };
  }, [playerA, playerB]);

  /**
   * Smooth auto-crossfade transition
   * @param {number} from - Start position (0-1)
   * @param {number} to - End position (0-1)
   * @param {number} durationMs - Transition duration in ms
   * @param {function} onUpdate - Callback with current position
   */
  const autoFade = useCallback((from, to, durationMs, onUpdate, masterVolume = 100) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);

      // Ease in-out
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const current = from + (to - from) * eased;
      applyCrossfade(current, masterVolume);
      onUpdate?.(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  }, [applyCrossfade]);

  const cancelAutoFade = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  return { applyCrossfade, autoFade, cancelAutoFade };
}
