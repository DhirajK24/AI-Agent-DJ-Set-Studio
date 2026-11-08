'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Studio/Icon';
import { LocalMix } from '@/utils/localMix';
import { formatTime } from '@/utils/youtube';
import studio from '@/app/page.module.css';
import styles from './audioFileMix.module.css';

const maxTracks = 12;
const maxFileBytes = 32 * 1024 * 1024;
const maxDecodedBytes = 160 * 1024 * 1024;

export default function AudioFileMix() {
  const [tracks, setTracks] = useState([]);
  const [importing, setImporting] = useState(false);
  const [transportBusy, setTransportBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [playback, setPlayback] = useState(null);
  const engine = useRef(null);
  const busy = useRef(false);
  const editable = !playback || playback.finished;
  const current = playback?.current;
  const incoming = playback?.incoming;
  const next = incoming ?? playback?.next;
  const nextTrack = next?.track ?? (!playback ? tracks[1] : undefined);
  const playing = playback?.playing ?? false;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const mix = engine.current;
      if (mix?.entries.length) setPlayback(mix.snapshot());
    }, 100);
    return () => clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    return () => {
      void engine.current?.close();
      engine.current = null;
    };
  }, []);

  async function addFiles(event) {
    const files = Array.from(event.target.files);
    event.target.value = '';
    if (!files.length || busy.current || !editable) return;
    busy.current = true;
    setImporting(true);
    setNotice('');

    try {
      const mix = engine.current ??= new LocalMix();
      const added = [];
      const rejected = [];
      let decodedBytes = tracks.reduce((total, track) => total + track.bytes, 0);

      for (const file of files) {
        if (tracks.length + added.length >= maxTracks || file.size > maxFileBytes) {
          rejected.push(file.name);
          continue;
        }
        try {
          const buffer = await mix.decode(file);
          if (engine.current !== mix) return;
          const bytes = buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
          if (buffer.duration < 1 || decodedBytes + bytes > maxDecodedBytes) {
            rejected.push(file.name);
            continue;
          }
          decodedBytes += bytes;
          added.push({ id: crypto.randomUUID(), name: file.name, buffer, bytes });
        } catch {
          if (engine.current !== mix) return;
          rejected.push(file.name);
        }
      }

      mix.stop();
      setPlayback(null);
      setTracks((queue) => [...queue, ...added]);
      if (rejected.length) {
        setNotice(`${rejected.length} ${rejected.length === 1 ? 'file was' : 'files were'} skipped. Choose playable audio under 32 MB per file, up to 12 tracks within the mix memory limit.`);
      }
    } catch {
      setNotice('Audio files could not be opened in this browser.');
    } finally {
      busy.current = false;
      setImporting(false);
    }
  }

  async function togglePlayback() {
    const mix = engine.current;
    if (!mix || !tracks.length || busy.current) return;
    busy.current = true;
    setTransportBusy(true);
    try {
      if (mix.snapshot().playing) await mix.pause();
      else await mix.play(tracks);
      if (engine.current === mix) setPlayback(mix.snapshot());
    } catch {
      if (engine.current === mix) setNotice('Playback could not start. Try Play mix again.');
    } finally {
      busy.current = false;
      setTransportBusy(false);
    }
  }

  function stopMix() {
    if (busy.current) return;
    engine.current?.stop();
    setPlayback(null);
  }

  function moveUp(index) {
    setTracks((queue) => {
      const updated = [...queue];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated;
    });
  }

  return (
    <main className={`${studio.main} ${styles.main}`}>
      <h1>Auto DJ</h1>
      <p className={styles.intro}>Choose songs from your device. Each song is loaded before the set starts, so the next one can fade in while the current one is still playing.</p>

      <div className={styles.console}>
        <div className={styles.decks}>
          <section aria-labelledby="current-deck" className={styles.deck}>
            <h2 id="current-deck">{incoming ? 'Fading out' : 'Now playing'}</h2>
            <strong>{current?.track.name ?? (playback?.finished ? 'Mix finished' : 'Ready when you are')}</strong>
            <span>{current ? `${formatTime(playback.elapsed)} / ${formatTime(current.track.buffer.duration)}` : 'Choose audio files to begin'}</span>
          </section>
          <section aria-labelledby="next-deck" className={styles.deck}>
            <h2 id="next-deck">{incoming ? 'Fading in' : 'Up next'}</h2>
            <strong>{nextTrack?.name ?? 'No track queued'}</strong>
            <span>{incoming ? (playing ? 'Both tracks are playing' : 'Crossfade paused') : nextTrack ? 'Ready to mix' : 'Add more songs to keep the mix going'}</span>
          </section>
        </div>

        {incoming && <progress className={styles.progress} aria-label="Crossfade progress" value={playback.mixProgress} max="1" />}
        <div className={styles.controls}>
          <button type="button" className={studio.build} disabled={!tracks.length || importing || transportBusy} onClick={togglePlayback}>
            <Icon name={playing ? 'pause' : 'play'} size={18} />{playing ? 'Pause mix' : editable ? 'Play mix' : 'Resume mix'}
          </button>
          <button type="button" className={studio.manualLink} disabled={!playing || !current || !playback?.next || Boolean(incoming)} onClick={() => engine.current?.mixNext()}>
            <Icon name="next" size={17} /> Mix next
          </button>
          <button type="button" className={studio.manualLink} disabled={editable || transportBusy} onClick={stopMix}>End mix</button>
          <span className={styles.status} role="status">{incoming && playing ? 'Crossfading' : ''}</span>
        </div>
      </div>

      <section className={styles.queue} aria-labelledby="mix-queue">
        <div className={styles.queueHeading}>
          <h2 id="mix-queue">Track order</h2>
          <label className={styles.file}>
            {importing ? 'Preparing audio…' : 'Choose audio files'}
            <input aria-label="Choose audio files" type="file" accept="audio/*,.flac,.m4a,.opus" multiple disabled={!editable || importing || transportBusy || tracks.length >= maxTracks} onChange={addFiles} />
          </label>
        </div>
        <p className={styles.notice} role="status">{notice}</p>
        {tracks.length ? (
          <ol className={styles.tracks}>
            {tracks.map((track, index) => (
              <li key={track.id}>
                <span>{track.name}</span>
                <small>{formatTime(track.buffer.duration)}</small>
                <button type="button" className={studio.iconButton} aria-label={`Move ${track.name} up`} disabled={!editable || importing || transportBusy || index === 0} onClick={() => moveUp(index)}><Icon name="up" size={16} /></button>
                <button type="button" className={studio.iconButton} aria-label={`Remove ${track.name}`} disabled={!editable || importing || transportBusy} onClick={() => setTracks((queue) => queue.filter(({ id }) => id !== track.id))}><Icon name="close" size={16} /></button>
              </li>
            ))}
          </ol>
        ) : <p className={styles.empty}>Choose at least two songs to hear a crossfade. Your files stay on this device.</p>}
      </section>
    </main>
  );
}
