'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { extractVideoId, formatTime } from '@/utils/youtube';
import './SearchBar.css';

export default function SearchBar({ deckId, accentColor, onVideoSelect, onAddToPlaylist }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState('');
  const searchTimeout = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    // Check if it's a URL first
    const videoId = extractVideoId(searchQuery);
    if (videoId) {
      onVideoSelect({ videoId, title: `Video: ${videoId}` });
      setQuery('');
      setShowResults(false);
      return;
    }

    // Search via API
    setIsSearching(true);
    setError('');
    setResults([]);
    setShowResults(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        setResults(data.results);
        setShowResults(true);
      } else {
        setResults([]);
        setError(data.error || 'No results found. Try a different query or paste a YouTube URL.');
        setShowResults(true);
      }
    } catch (err) {
      setError('Search failed. Check your internet connection or paste a YouTube URL.');
      setShowResults(true);
    } finally {
      setIsSearching(false);
    }
  }, [onVideoSelect]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    // Debounce search
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      if (value.trim().length >= 2) {
        handleSearch(value);
      }
    }, 600);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      handleSearch(query);
    }
  };

  const handleSelectVideo = (video) => {
    onVideoSelect(video);
    setQuery('');
    setShowResults(false);
  };

  const handleAddToPlaylist = (e, video) => {
    e.stopPropagation();
    onAddToPlaylist?.(video);
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    return formatTime(seconds);
  };

  const formatViews = (count) => {
    if (!count) return '';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M views`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K views`;
    return `${count} views`;
  };

  return (
    <div className={`search-bar ${accentColor}`} ref={containerRef}>
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          placeholder="Search YouTube or paste URL..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setShowResults(true)}
        />
        {isSearching && <span className="search-spinner">⏳</span>}
      </div>

      {showResults && (
        <div className="search-results">
          {isSearching && (
            <div className="search-loading">
              <span className="search-loading-spinner">🔍</span>
              <span>Searching for &quot;{query}&quot;...</span>
            </div>
          )}
          {error && !isSearching && (
            <div className="search-error">
              <span>{error}</span>
              <button
                className="search-retry-btn"
                onClick={() => handleSearch(query)}
              >
                Retry
              </button>
            </div>
          )}
          {results.map((video) => (
            <div
              key={video.videoId}
              className="search-result-item"
              onClick={() => handleSelectVideo(video)}
            >
              <div className="result-thumbnail">
                <img
                  src={video.thumbnail || `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
                  alt={video.title}
                  loading="lazy"
                />
                <span className="result-duration">{formatDuration(video.duration)}</span>
              </div>
              <div className="result-info">
                <div className="result-title">{video.title}</div>
                <div className="result-meta">
                  <span className="result-author">{video.author}</span>
                  {video.viewCount > 0 && <span className="result-views">{formatViews(video.viewCount)}</span>}
                </div>
              </div>
              <button
                className="result-add-btn"
                onClick={(e) => handleAddToPlaylist(e, video)}
                title="Add to playlist"
              >
                +
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
