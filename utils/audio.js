/**
 * Audio math utilities for DJ mixing
 * Handles crossfade curves, volume calculations, and BPM math
 */

/**
 * Equal-power crossfade curve
 * Provides a natural-sounding transition between two sources
 * 
 * @param {number} position - Crossfader position (0 = full A, 0.5 = center, 1 = full B)
 * @returns {{ volA: number, volB: number }} - Volume levels 0-100 for each deck
 */
export function equalPowerCrossfade(position) {
  const volA = Math.cos(position * Math.PI / 2) * 100;
  const volB = Math.sin(position * Math.PI / 2) * 100;
  return { volA: Math.round(volA), volB: Math.round(volB) };
}

/**
 * Linear crossfade curve (simpler but less natural)
 */
export function linearCrossfade(position) {
  return {
    volA: Math.round((1 - position) * 100),
    volB: Math.round(position * 100),
  };
}

/**
 * Calculate BPM from an array of tap timestamps
 * @param {number[]} taps - Array of timestamps (ms) from performance.now()
 * @returns {number|null} - BPM or null if not enough taps
 */
export function calculateBPM(taps) {
  if (taps.length < 2) return null;

  // Calculate intervals between consecutive taps
  const intervals = [];
  for (let i = 1; i < taps.length; i++) {
    intervals.push(taps[i] - taps[i - 1]);
  }

  // Average interval in milliseconds
  const avgInterval = intervals.reduce((sum, iv) => sum + iv, 0) / intervals.length;

  // Convert to BPM: 60000ms / interval
  const bpm = 60000 / avgInterval;

  // Clamp to reasonable range
  return Math.round(Math.max(40, Math.min(300, bpm)) * 10) / 10;
}

/**
 * Calculate playback rate to match a target BPM
 * @param {number} currentBPM - Current deck BPM
 * @param {number} targetBPM - Target BPM to match
 * @returns {number} - Playback rate (clamped to 0.25-2.0)
 */
export function calculateSyncRate(currentBPM, targetBPM) {
  if (!currentBPM || !targetBPM) return 1;
  const rate = targetBPM / currentBPM;
  return Math.max(0.25, Math.min(2.0, rate));
}

/**
 * Apply EQ simulation to volume
 * Since we can't actually filter frequencies, this provides
 * a volume multiplier based on EQ knob positions
 * 
 * @param {number} baseVolume - Base volume (0-100)
 * @param {{ hi: number, mid: number, low: number }} eq - EQ values (-1 to 1)
 * @returns {number} - Adjusted volume (0-100)
 */
export function applyEQToVolume(baseVolume, eq) {
  // Average EQ contribution affects overall volume slightly
  const eqFactor = 1 + (eq.hi + eq.mid + eq.low) / 6;
  return Math.round(Math.max(0, Math.min(100, baseVolume * eqFactor)));
}

/**
 * Generate a simple hash for consistent waveform generation per video
 */
export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}
