'use client';

import './EffectsPanel.css';

const EFFECTS = [
  { id: 'echo', label: 'ECHO', icon: '🔊', description: 'Echo/delay effect' },
  { id: 'reverb', label: 'REVERB', icon: '🌊', description: 'Reverb/space effect' },
  { id: 'flanger', label: 'FLANGER', icon: '🌀', description: 'Flanger sweep effect' },
  { id: 'filter', label: 'FILTER', icon: '🎛️', description: 'Low/high pass filter' },
];

/**
 * Effects panel with toggle buttons
 * Visual-only since YouTube audio can't be processed
 */
export default function EffectsPanel({ deckAEffects, deckBEffects, onToggleEffect }) {
  return (
    <div className="effects-panel panel">
      <div className="effects-header">
        <span className="effects-title">EFFECTS RACK</span>
        <span className="effects-note">Visual Only</span>
      </div>

      <div className="effects-body">
        {/* Deck A Effects */}
        <div className="effects-deck effects-deck-a">
          <span className="effects-deck-label neon-text-cyan">DECK A</span>
          <div className="effects-buttons">
            {EFFECTS.map((fx) => (
              <button
                key={fx.id}
                className={`effect-btn effect-cyan ${deckAEffects[fx.id] ? 'active' : ''}`}
                onClick={() => onToggleEffect('deckA', fx.id)}
                title={fx.description}
              >
                <span className="effect-icon">{fx.icon}</span>
                <span className="effect-label">{fx.label}</span>
                {deckAEffects[fx.id] && <span className="effect-glow-ring" />}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="effects-divider" />

        {/* Deck B Effects */}
        <div className="effects-deck effects-deck-b">
          <span className="effects-deck-label neon-text-magenta">DECK B</span>
          <div className="effects-buttons">
            {EFFECTS.map((fx) => (
              <button
                key={fx.id}
                className={`effect-btn effect-magenta ${deckBEffects[fx.id] ? 'active' : ''}`}
                onClick={() => onToggleEffect('deckB', fx.id)}
                title={fx.description}
              >
                <span className="effect-icon">{fx.icon}</span>
                <span className="effect-label">{fx.label}</span>
                {deckBEffects[fx.id] && <span className="effect-glow-ring" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
