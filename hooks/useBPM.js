'use client';

import { useCallback, useRef, useState } from 'react';
import { calculateBPM } from '@/utils/audio';

/**
 * Custom hook for BPM tap tempo detection
 * Calculates BPM from user tapping a button
 */
export function useBPM() {
  const [bpm, setBpm] = useState(null);
  const tapsRef = useRef([]);
  const timeoutRef = useRef(null);

  const tap = useCallback(() => {
    const now = performance.now();

    // Reset if last tap was more than 3 seconds ago
    if (tapsRef.current.length > 0) {
      const lastTap = tapsRef.current[tapsRef.current.length - 1];
      if (now - lastTap > 3000) {
        tapsRef.current = [];
      }
    }

    tapsRef.current.push(now);

    // Keep last 8 taps for accuracy
    if (tapsRef.current.length > 8) {
      tapsRef.current = tapsRef.current.slice(-8);
    }

    const calculatedBpm = calculateBPM(tapsRef.current);
    if (calculatedBpm) {
      setBpm(calculatedBpm);
    }

    // Auto-reset after 5 seconds of no tapping
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      tapsRef.current = [];
    }, 5000);
  }, []);

  const reset = useCallback(() => {
    tapsRef.current = [];
    setBpm(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const setManualBpm = useCallback((value) => {
    setBpm(value);
  }, []);

  return { bpm, tap, reset, setManualBpm };
}
