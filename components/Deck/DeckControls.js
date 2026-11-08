'use client';

import { formatTime } from '@/utils/youtube';
import './DeckControls.css';

/**
 * Deck playback controls: play/pause, cue, loop, tempo, hot cues
 */
export default function DeckControls({
  deckId,
  accentColor = 'cyan',
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  bpm,
  cuePoint,
  loopIn,
  loopOut,
  loopActive,
  hotCues,
  onPlay,
  onPause,
  onCueSet,
  onCueJump,
  onLoopIn,
  onLoopOut,
  onLoopToggle,
  onLoopClear,
  onTempoChange,
  onBPMTap,
  onBPMSet,
  onSync,
  onHotCueSet,
  onHotCueJump,
  onSeek,
}) {
  const handleTempoChange = (e) => {
    onTempoChange(parseFloat(e.target.value));
  };

  return (
    <div className={`deck-controls accent-${accentColor}`}>
      {/* Transport */}
      <div className="transport-row">
        <button
          className="transport-btn cue-btn"
          onClick={onCueJump}
          onContextMenu={(e) => { e.preventDefault(); onCueSet(); }}
          title="Click: go to cue | Right-click: set cue"
        >
          CUE
        </button>

        <button
          className={`transport-btn play-btn ${isPlaying ? 'active' : ''}`}
          onClick={isPlaying ? onPause : onPlay}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          className="transport-btn sync-btn"
          onClick={onSync}
          title="Sync BPM with other deck"
        >
          SYNC
        </button>
      </div>

      {/* Progress bar */}
      <div className="progress-row">
        <span className="time-display">{formatTime(currentTime)}</span>
        <input
          type="range"
          className="progress-slider"
          min="0"
          max={duration || 100}
          step="0.1"
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
        />
        <span className="time-display">{formatTime(duration)}</span>
      </div>

      {/* Loop Controls */}
      <div className="loop-row">
        <button
          className={`loop-btn ${loopIn !== null ? 'set' : ''}`}
          onClick={onLoopIn}
        >
          IN
        </button>
        <button
          className={`loop-btn ${loopOut !== null ? 'set' : ''}`}
          onClick={onLoopOut}
        >
          OUT
        </button>
        <button
          className={`loop-btn loop-toggle ${loopActive ? 'active' : ''}`}
          onClick={onLoopToggle}
          disabled={loopIn === null || loopOut === null}
        >
          🔁 {loopActive ? 'ON' : 'OFF'}
        </button>
        <button className="loop-btn loop-clear" onClick={onLoopClear}>
          ✕
        </button>
      </div>

      {/* Tempo / BPM */}
      <div className="tempo-row">
        <div className="tempo-control">
          <label className="control-label">SPEED</label>
          <input
            type="range"
            className="tempo-slider"
            min="0.25"
            max="2"
            step="0.05"
            value={playbackRate}
            onChange={handleTempoChange}
          />
          <span className="tempo-value">{playbackRate.toFixed(2)}x</span>
        </div>
        <div className="bpm-control">
          <label className="control-label">BPM</label>
          <div className="bpm-display">
            <input
              type="number"
              className="bpm-input"
              value={bpm || ''}
              onChange={(e) => onBPMSet(parseFloat(e.target.value) || null)}
              placeholder="---"
              min="40"
              max="300"
            />
            <button className="bpm-tap-btn" onClick={onBPMTap}>
              TAP
            </button>
          </div>
        </div>
      </div>

      {/* Hot Cues */}
      <div className="hotcue-row">
        <label className="control-label">HOT CUE</label>
        <div className="hotcue-buttons">
          {hotCues.map((cue, i) => (
            <button
              key={i}
              className={`hotcue-btn ${cue !== null ? 'set' : ''}`}
              onClick={() => cue !== null ? onHotCueJump(i) : onHotCueSet(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                onHotCueSet(i);
              }}
              title={cue !== null ? `${formatTime(cue)} | Right-click to overwrite` : 'Click to set hot cue'}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
