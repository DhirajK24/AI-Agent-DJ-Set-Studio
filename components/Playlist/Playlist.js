'use client';

import { formatTime } from '@/utils/youtube';
import './Playlist.css';

/**
 * Playlist/Queue component for each deck
 */
export default function Playlist({
  deckId,
  accentColor = 'cyan',
  items = [],
  currentVideoId,
  onLoad,
  onRemove,
}) {
  if (items.length === 0) {
    return (
      <div className={`playlist panel accent-${accentColor}`}>
        <div className="playlist-header">
          <span className="playlist-title">
            {deckId === 'deckA' ? 'PLAYLIST A' : 'PLAYLIST B'}
          </span>
          <span className="playlist-count">0 tracks</span>
        </div>
        <div className="playlist-empty">
          <span className="playlist-empty-icon">🎵</span>
          <span>Search and add tracks</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`playlist panel accent-${accentColor}`}>
      <div className="playlist-header">
        <span className="playlist-title">
          {deckId === 'deckA' ? 'PLAYLIST A' : 'PLAYLIST B'}
        </span>
        <span className="playlist-count">{items.length} tracks</span>
      </div>
      <div className="playlist-items">
        {items.map((item, index) => (
          <div
            key={`${item.videoId}-${index}`}
            className={`playlist-item ${item.videoId === currentVideoId ? 'active' : ''}`}
          >
            <span className="playlist-item-num">{index + 1}</span>
            <div className="playlist-item-info">
              <span className="playlist-item-title">{item.title}</span>
              {item.author && <span className="playlist-item-author">{item.author}</span>}
            </div>
            {item.duration && (
              <span className="playlist-item-duration">{formatTime(item.duration)}</span>
            )}
            <div className="playlist-item-actions">
              <button
                className="playlist-load-btn"
                onClick={() => onLoad(index)}
                title="Load to deck"
              >
                ▶
              </button>
              <button
                className="playlist-remove-btn"
                onClick={() => onRemove(index)}
                title="Remove from playlist"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
