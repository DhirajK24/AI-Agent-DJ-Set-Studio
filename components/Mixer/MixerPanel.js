'use client';

import EQKnob from './EQKnob';
import Crossfader from './Crossfader';
import VUMeter from './VUMeter';
import './MixerPanel.css';

/**
 * Central mixer panel
 * Contains EQ knobs for both decks, VU meters, crossfader, and volume faders
 */
export default function MixerPanel({
  deckA,
  deckB,
  crossfader,
  onCrossfaderChange,
  onEQChange,
  onVolumeChange,
}) {
  return (
    <div className="mixer-panel panel">
      <div className="mixer-header">
        <span className="mixer-title">MIXER</span>
      </div>

      <div className="mixer-body">
        {/* EQ Section */}
        <div className="eq-section">
          <div className="eq-column eq-a">
            <EQKnob
              label="HI"
              value={deckA.eq.hi}
              onChange={(v) => onEQChange('deckA', 'hi', v)}
              color="var(--neon-cyan)"
            />
            <EQKnob
              label="MID"
              value={deckA.eq.mid}
              onChange={(v) => onEQChange('deckA', 'mid', v)}
              color="var(--neon-cyan)"
            />
            <EQKnob
              label="LOW"
              value={deckA.eq.low}
              onChange={(v) => onEQChange('deckA', 'low', v)}
              color="var(--neon-cyan)"
            />
          </div>

          {/* VU Meters */}
          <div className="vu-section">
            <VUMeter
              isPlaying={deckA.isPlaying}
              volume={deckA.volume}
              color="#00f0ff"
              label="A"
            />
            <VUMeter
              isPlaying={deckB.isPlaying}
              volume={deckB.volume}
              color="#ff00e5"
              label="B"
            />
          </div>

          <div className="eq-column eq-b">
            <EQKnob
              label="HI"
              value={deckB.eq.hi}
              onChange={(v) => onEQChange('deckB', 'hi', v)}
              color="var(--neon-magenta)"
            />
            <EQKnob
              label="MID"
              value={deckB.eq.mid}
              onChange={(v) => onEQChange('deckB', 'mid', v)}
              color="var(--neon-magenta)"
            />
            <EQKnob
              label="LOW"
              value={deckB.eq.low}
              onChange={(v) => onEQChange('deckB', 'low', v)}
              color="var(--neon-magenta)"
            />
          </div>
        </div>

        {/* Volume Faders */}
        <div className="volume-faders">
          <div className="volume-fader fader-a">
            <label className="fader-label neon-text-cyan">A</label>
            <input
              type="range"
              className="vertical-fader"
              min="0"
              max="100"
              value={deckA.volume}
              onChange={(e) => onVolumeChange('deckA', parseInt(e.target.value))}
              orient="vertical"
            />
            <span className="fader-value">{deckA.volume}</span>
          </div>
          <div className="volume-fader fader-b">
            <label className="fader-label neon-text-magenta">B</label>
            <input
              type="range"
              className="vertical-fader"
              min="0"
              max="100"
              value={deckB.volume}
              onChange={(e) => onVolumeChange('deckB', parseInt(e.target.value))}
              orient="vertical"
            />
            <span className="fader-value">{deckB.volume}</span>
          </div>
        </div>

        {/* Crossfader */}
        <Crossfader
          value={crossfader}
          onChange={onCrossfaderChange}
        />
      </div>
    </div>
  );
}
