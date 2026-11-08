'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * Audio Effects Engine
 * 
 * Since YouTube IFrame audio can't be processed via Web Audio API (CORS),
 * we implement effects using the controls we DO have:
 * 
 * - setVolume(0-100)    → volume-based effects (echo, reverb, filter kill)
 * - setPlaybackRate()   → pitch/speed effects (flanger)
 * - CSS filters on DOM  → visual feedback
 * 
 * Each effect modifies a "volume multiplier" that gets applied to the base volume.
 */
export function useAudioEffects({
  isPlaying,
  effects,
  baseVolume,
  basePlaybackRate,
  setVolume,
  setPlaybackRate,
  playerElementId,
}) {
  const volumeModifierRef = useRef(1);
  const baseVolumeRef = useRef(baseVolume);
  const echoIntervalRef = useRef(null);
  const flangerIntervalRef = useRef(null);
  const filterIntervalRef = useRef(null);
  const reverbIntervalRef = useRef(null);

  // Sync base volume to ref so the loop always has the latest without restarting
  useEffect(() => {
    baseVolumeRef.current = baseVolume;
  }, [baseVolume]);

  // Master volume application loop
  // Runs continuously to combine baseVolume (crossfader+EQ+master) with effects modifier
  useEffect(() => {
    let lastAppliedVol = -1;
    const interval = setInterval(() => {
      if (setVolume) {
        const computedVol = Math.round(baseVolumeRef.current * volumeModifierRef.current);
        // Clamp to 0-100
        const finalVol = Math.max(0, Math.min(100, computedVol));
        if (finalVol !== lastAppliedVol) {
          setVolume(finalVol);
          lastAppliedVol = finalVol;
        }
      }
    }, 50); // 20fps volume updates
    return () => clearInterval(interval);
  }, [setVolume]);

  // Get the iframe element for CSS effects
  const getIframe = useCallback(() => {
    const container = document.getElementById(playerElementId);
    if (!container) return null;
    return container.tagName === 'IFRAME' ? container : container.querySelector('iframe');
  }, [playerElementId]);

  // ─── ECHO EFFECT ───
  useEffect(() => {
    if (!effects.echo || !isPlaying) {
      if (echoIntervalRef.current) {
        clearInterval(echoIntervalRef.current);
        echoIntervalRef.current = null;
      }
      return;
    }

    let phase = 0;
    echoIntervalRef.current = setInterval(() => {
      phase += 1;
      const echoPattern = [1.0, 0.4, 0.65, 0.85];
      const step = phase % (echoPattern.length * 3);
      const idx = Math.floor(step / 3);
      volumeModifierRef.current = echoPattern[idx] ?? 1.0;
    }, 80);

    return () => {
      if (echoIntervalRef.current) clearInterval(echoIntervalRef.current);
      volumeModifierRef.current = 1;
    };
  }, [effects.echo, isPlaying]);

  // ─── FLANGER EFFECT ───
  useEffect(() => {
    if (!effects.flanger || !isPlaying) {
      if (flangerIntervalRef.current) {
        clearInterval(flangerIntervalRef.current);
        flangerIntervalRef.current = null;
        if (setPlaybackRate) setPlaybackRate(basePlaybackRate);
      }
      return;
    }

    let t = 0;
    flangerIntervalRef.current = setInterval(() => {
      t += 0.12;
      const wobble = Math.sin(t) * 0.03;
      const newRate = Math.max(0.25, Math.min(2.0, basePlaybackRate + wobble));
      if (setPlaybackRate) setPlaybackRate(newRate);
    }, 50);

    return () => {
      if (flangerIntervalRef.current) clearInterval(flangerIntervalRef.current);
      if (setPlaybackRate) setPlaybackRate(basePlaybackRate);
    };
  }, [effects.flanger, isPlaying, basePlaybackRate, setPlaybackRate]);

  // ─── FILTER EFFECT ───
  useEffect(() => {
    const iframe = getIframe();

    if (!effects.filter || !isPlaying) {
      if (filterIntervalRef.current) {
        clearInterval(filterIntervalRef.current);
        filterIntervalRef.current = null;
      }
      if (iframe) {
        iframe.style.filter = 'none';
        iframe.style.transition = 'filter 0.3s ease';
      }
      return;
    }

    let t = 0;
    filterIntervalRef.current = setInterval(() => {
      t += 0.04;
      const sweep = (Math.sin(t) + 1) / 2;
      const brightness = 0.5 + sweep * 0.8;
      const contrast = 0.7 + sweep * 0.6;
      const saturate = 0.5 + sweep * 1.5;

      if (iframe) {
        iframe.style.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`;
        iframe.style.transition = 'none';
      }

      const volMod = 0.7 + sweep * 0.3;
      if (!effects.echo) {
        volumeModifierRef.current = volMod;
      }
    }, 50);

    return () => {
      if (filterIntervalRef.current) clearInterval(filterIntervalRef.current);
      if (iframe) iframe.style.filter = 'none';
      volumeModifierRef.current = 1;
    };
  }, [effects.filter, isPlaying, getIframe, effects.echo]);

  // ─── REVERB EFFECT ───
  useEffect(() => {
    if (!effects.reverb || !isPlaying) {
      if (reverbIntervalRef.current) {
        clearInterval(reverbIntervalRef.current);
        reverbIntervalRef.current = null;
      }
      return;
    }

    let t = 0;
    reverbIntervalRef.current = setInterval(() => {
      t += 0.03;
      const swell = 0.65 + Math.sin(t) * 0.35;
      if (!effects.echo && !effects.filter) {
        volumeModifierRef.current = swell;
      }
    }, 60);

    return () => {
      if (reverbIntervalRef.current) clearInterval(reverbIntervalRef.current);
      volumeModifierRef.current = 1;
    };
  }, [effects.reverb, isPlaying, effects.echo, effects.filter]);

  // Cleanup all on unmount
  useEffect(() => {
    return () => {
      [echoIntervalRef, flangerIntervalRef, filterIntervalRef, reverbIntervalRef].forEach((ref) => {
        if (ref.current) clearInterval(ref.current);
      });
    };
  }, []);
}
