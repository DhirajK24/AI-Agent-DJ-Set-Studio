'use client';

import { useEffect, useRef, useState } from 'react';
import { extractStartTime, extractVideoId, formatTime, getThumbnailUrl } from '@/utils/youtube';
import Icon from './Icon';
import styles from './addNextDialog.module.css';

export default function AddNextDialog({ onAdd, onClose, unavailable, lockedIds }) {
  const dialog = useRef(null);
  const input = useRef(null);
  const request = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    input.current.focus();
    return () => {
      request.current?.abort();
      element.close();
    };
  }, []);

  function add(track) {
    if (onAdd(track)) onClose();
    else setStatus('This song is unavailable or already playing. Choose another song.');
  }

  async function search(event) {
    event.preventDefault();
    const value = query.trim();
    if (!value || searching) return;
    const videoId = extractVideoId(value);
    if (videoId && /[./]/.test(value)) {
      add({ videoId, title: 'YouTube video', author: videoId, duration: 0, startTime: extractStartTime(value) });
      return;
    }
    if (/^https?:\/\//i.test(value)) {
      setStatus('Paste a link to an individual YouTube video.');
      return;
    }

    const controller = new AbortController();
    request.current = controller;
    setSearching(true);
    setResults([]);
    setStatus('Searching for playable songs…');
    try {
      const params = new URLSearchParams({ q: value, mode: 'songs' });
      const response = await fetch(`/api/search?${params}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(14000)]) });
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      if (controller.signal.aborted) return;
      const matches = data.results.filter((track) => !unavailable.has(track.videoId));
      setResults(matches);
      setStatus(matches.length ? `${matches.length} results` : 'No playable matches. Try the artist and song title, or paste a YouTube link.');
    } catch {
      if (!controller.signal.aborted) setStatus('Search is unavailable. Try again or paste a YouTube link.');
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }

  return (
    <dialog className={styles.dialog} ref={dialog} aria-labelledby="add-next-heading" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <header className={styles.header}>
        <h2 id="add-next-heading">Add next</h2>
        <button type="button" className={styles.close} aria-label="Close song search" onClick={onClose}><Icon name="close" size={20} /></button>
      </header>
      <form className={styles.search} onSubmit={search}>
        <input ref={input} type="search" aria-label="Song, artist, or YouTube link" placeholder="Song, artist, or YouTube link" maxLength={250} value={query} onChange={(event) => setQuery(event.target.value)} />
        <button type="submit" disabled={!query.trim() || searching}>Search</button>
      </form>
      <p className={styles.status} role="status">{status || 'Pick a song to play after the current track or mix.'}</p>
      {results.length > 0 && <ul className={styles.results}>
        {results.map((track) => (
          <li key={track.videoId}>
            <span className={styles.artwork} aria-hidden="true" style={{ backgroundImage: `url(${getThumbnailUrl(track.videoId)})` }} />
            <span className={styles.track}><strong>{track.title}</strong><small>{track.author}{track.duration ? ` · ${formatTime(track.duration)}` : ''}</small></span>
            <button type="button" aria-label={`Queue ${track.title} next`} disabled={lockedIds.includes(track.videoId) || unavailable.has(track.videoId)} onClick={() => add(track)}>Play next</button>
          </li>
        ))}
      </ul>}
    </dialog>
  );
}
