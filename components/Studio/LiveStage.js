'use client';

import { useEffect, useState } from 'react';
import { formatTime, getThumbnailUrl } from '@/utils/youtube';
import DJPuppet from './DJPuppet';
import Icon from './Icon';
import styles from './liveStage.module.css';

const silent = [0, 0];

function useDeckLevels(running, readLevels) {
  const [levels, setLevels] = useState(silent);

  useEffect(() => {
    if (!running) return;
    const sample = () => {
      const [a, b] = readLevels();
      setLevels((previous) => previous[0] === a && previous[1] === b ? previous : [a, b]);
    };
    sample();
    const timer = setInterval(sample, 100);
    return () => clearInterval(timer);
  }, [running, readLevels]);

  return running ? levels : silent;
}

function DeckLevels({ liveDeck, levels }) {
  return (
    <div className={styles.levels} aria-label="Deck volumes">
      {['A', 'B'].map((deck, index) => {
        const volume = levels[index];
        return (
          <div className={styles.level} data-live={liveDeck === index} key={deck}>
            <span>Deck {deck}</span>
            <div className={styles.levelRail} role="meter" aria-label={`Deck ${deck} volume`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={volume}>
              <span style={{ transform: `scaleX(${volume / 100})` }} />
            </div>
            <span aria-hidden="true">{volume}%</span>
          </div>
        );
      })}
    </div>
  );
}

export default function LiveStage({
  live, upcoming, vibe, agent, agentMode, controls, readLevels, fullscreen, playerOnly, volume, onToggleFullscreen, onToggleStudio,
  onChangeVibe, onTogglePlayback, onPrevious, onSeek, onVolumeChange, onMixNext, onAddNext, onPlayFull, onRemoveNext, onSteer,
}) {
  const [showPlayers, setShowPlayers] = useState(false);
  const { track, deck, status, position, duration, cue, playing } = live;
  const running = playing || upcoming.mixing;
  const levels = useDeckLevels(running, readLevels);
  const end = duration || 1;
  const progress = Math.min(position, end);
  return (
    <section className={styles.stage} hidden={!track} data-expanded={fullscreen} data-player-only={playerOnly || undefined} aria-label="Live set">
      <div className={styles.broadcast}>
        <div className={styles.identity}>
          <span className={styles.broadcastMark}><Icon name="wave" size={24} /></span>
          <div><strong>Set Studio</strong><span>On Air</span></div>
        </div>
        <div className={styles.session}>
          <span className={styles.vibe}>{vibe}</span>
          <button type="button" aria-haspopup="dialog" onClick={onChangeVibe}>Change vibe <Icon name="diagonal" size={13} /></button>
          <button type="button" onClick={() => setShowPlayers(!showPlayers)}>{showPlayers ? 'Hide players' : 'Show players'}</button>
          <button type="button" aria-controls="studio-tools" aria-expanded={!playerOnly} onClick={onToggleStudio}><Icon name="list" size={15} /> Studio tools</button>
        </div>
        <div className={styles.broadcastControls}>
          <button className={styles.previous} type="button" onClick={onPrevious} disabled={!controls.canGoBack} aria-label="Previous track" title="Previous track">
            <Icon name="back" size={18} />
          </button>
          <button className={styles.clock} type="button" onClick={onTogglePlayback} disabled={!controls.canPlay} aria-label={playing ? 'Pause live set' : 'Resume live set'} aria-keyshortcuts="Space" title={playing ? 'Pause (Space)' : 'Play (Space)'}>
            <Icon name={playing ? 'pause' : 'play'} size={20} />
            <span>{formatTime(position)} <small>/ {formatTime(duration)}</small></span>
          </button>
          <button className={styles.fullscreen} type="button" onClick={onToggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} title={fullscreen ? 'Exit full screen' : 'Full screen'}>
            <Icon name={fullscreen ? 'collapse' : 'expand'} size={20} />
          </button>
        </div>
      </div>

      <div className={styles.headlines} data-video-view={showPlayers ? 'players' : 'hidden'}>
        {track && !showPlayers && (
          <div key={track.videoId} className={styles.ambience} aria-hidden="true" style={{ backgroundImage: `url(${getThumbnailUrl(track.videoId)})` }} />
        )}
        <div className={styles.current}>
          <p className={styles.deckState}><span data-playing={playing} /> Deck {deck === 0 ? 'A' : 'B'} · {status}</p>
          <h1 key={track?.videoId} title={track?.title}>{track?.title}</h1>
          <p className={styles.artist} title={track?.author}>{track?.author}</p>
          <button className={styles.discDeck} type="button" data-spinning={playing} disabled={!controls.canPlay} onClick={onTogglePlayback} aria-label={playing ? 'Pause from DJ disc' : 'Play from DJ disc'} title={playing ? 'Pause' : 'Play'}>
            <span className={styles.discRotor} aria-hidden="true">
              <span className={styles.discLabel} style={track ? { backgroundImage: `url(${getThumbnailUrl(track.videoId)})` } : undefined} />
              <span className={styles.discHub} />
            </span>
            <span className={styles.toneArm} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.next}>
          <p className={styles.deckState}>Deck {deck === 0 ? 'B' : 'A'} · {upcoming.status}</p>
          <h2 title={upcoming.track?.title}>{upcoming.track?.title ?? upcoming.empty}</h2>
          <p className={styles.artist} title={upcoming.track?.author}>{upcoming.track?.author}</p>
        </div>
        {['a', 'b'].map((key, index) => (
          <div key={key} className={styles.deckVideo} data-live={deck === index} inert={!showPlayers}>
            {showPlayers && <p className={styles.deckState}>Deck {key.toUpperCase()} · {deck === index ? status : upcoming.status}</p>}
            <div id={`studio-video-${key}`} className={styles.videoFrame} />
          </div>
        ))}
      </div>

      <div className={styles.signal}>
        <div className={styles.timeline}>
          <div className={styles.signalLabel}><span>{cue ? 'Highlight' : 'Track position'}</span><span>{cue ? `In ${formatTime(cue.start)}  /  Out ${formatTime(cue.end)}` : `${formatTime(position)} / ${formatTime(duration)}`}</span></div>
          <div className={styles.trackRail}>
            <progress aria-hidden="true" value={progress} max={end} />
            {cue && duration > 0 && <span className={styles.cue} aria-hidden="true" style={{ left: `${Math.min(cue.start, end) / end * 100}%`, right: `${100 - Math.min(cue.end, end) / end * 100}%` }} />}
            <input className={styles.seek} type="range" aria-label="Seek" aria-valuetext={`${formatTime(progress)} of ${formatTime(duration)}`} min={0} max={end} step={0.1} value={progress} disabled={!duration} onChange={(event) => onSeek(Number(event.target.value))} />
          </div>
        </div>
        <div className={styles.mixLevels}>
          <DeckLevels liveDeck={deck} levels={levels} />
          <label className={styles.masterVolume}>
            <span>Volume</span>
            <input type="range" min={0} max={100} value={volume} onChange={(event) => onVolumeChange(Number(event.target.value))} />
            <span aria-hidden="true">{volume}%</span>
          </label>
        </div>
      </div>

      {onSteer && (
        <div className={styles.steer} aria-label="Steer the DJ">
          <span>Steer the DJ</span>
          <button type="button" onClick={() => onSteer('Punjabi')}>More Punjabi</button>
          <button type="button" onClick={() => onSteer('bangers')}>Raise the energy</button>
          <button type="button" onClick={() => onSteer('cool')}>Wind down</button>
        </div>
      )}
      <div className={styles.dock}>
        <div className={styles.agent}>
          <div className={styles.agentIdentity}>
            {track && <DJPuppet playing={running} levels={levels} />}
            <span className={styles.agentBadge}><Icon name="spark" size={16} /> AI DJ
              <span className={styles.agentSignal} data-mode={agentMode} aria-hidden="true"><i /><i /><i /></span>
            </span>
          </div>
          <p role="status" title={agent}>{agent}</p>
          <button type="button" className={styles.addNext} onClick={onAddNext}>Add next <Icon name="plus" size={18} /></button>
        </div>
        <div className={styles.actions} role="group" aria-label="Mix controls">
          <button type="button" className={styles.primary} data-mix-cue={controls.showMixCue} disabled={!controls.canMix} onClick={onMixNext}>
            {playing ? 'Mix next' : 'Play next'} <Icon name="next" size={24} />
          </button>
          <button type="button" className={styles.secondary} disabled={!controls.canPlayFull} onClick={onPlayFull}>Play full <Icon name="play" size={21} /></button>
          <button type="button" className={styles.remove} disabled={!controls.canRemove} onClick={onRemoveNext}>Remove next</button>
        </div>
      </div>
    </section>
  );
}
