'use client';

/**
 * Crossfader slider component
 * Distributes volume between Deck A and Deck B
 */
export default function Crossfader({ value = 0.5, onChange }) {
  return (
    <div className="crossfader-container">
      <div className="crossfader-labels">
        <span className="crossfader-label neon-text-cyan">A</span>
        <span className="crossfader-label-center">CROSSFADER</span>
        <span className="crossfader-label neon-text-magenta">B</span>
      </div>
      <div className="crossfader-track">
        <input
          type="range"
          className="crossfader-input"
          min="0"
          max="1"
          step="0.005"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
        {/* Visual indicator lines */}
        <div className="crossfader-markers">
          <div className="marker" />
          <div className="marker center" />
          <div className="marker" />
        </div>
      </div>
    </div>
  );
}
