/**
 * YouTube utility functions
 * Handles URL parsing, video ID extraction, and thumbnail URLs
 */

/**
 * Extract YouTube video ID from various URL formats
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/embed/, etc.
 */
export function extractVideoId(input) {
  if (!input) return null;

  // Already a plain video ID (11 chars, alphanumeric + dash/underscore)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) {
    return input.trim();
  }

  const patterns = [
    // youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
    // youtu.be/VIDEO_ID
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // youtube.com/embed/VIDEO_ID
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    // youtube.com/v/VIDEO_ID
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    // youtube.com/shorts/VIDEO_ID
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    // music.youtube.com/watch?v=VIDEO_ID
    /(?:music\.youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match) return match[1];
  }

  return null;
}

export function extractStartTime(input) {
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    const time = url.searchParams.get('t') ?? url.searchParams.get('start')
      ?? new URLSearchParams(url.hash.slice(1)).get('t');
    if (!time) return null;
    if (/^\d+$/.test(time)) return Number.isSafeInteger(Number(time)) ? Number(time) : null;
    const parts = time.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
    if (!parts) return null;
    const [, hours = 0, minutes = 0, seconds = 0] = parts;
    const start = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
    return Number.isSafeInteger(start) ? start : null;
  } catch {
    return null;
  }
}

/**
 * Get YouTube thumbnail URL for a video
 */
export function getThumbnailUrl(videoId, quality = 'mqdefault') {
  // quality options: default, mqdefault, hqdefault, sddefault, maxresdefault
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Build YouTube embed URL with parameters
 */
export function buildEmbedUrl(videoId, params = {}) {
  const defaults = {
    enablejsapi: 1,
    origin: typeof window !== 'undefined' ? window.location.origin : '',
    rel: 0,
    modestbranding: 1,
    playsinline: 1,
  };
  
  const merged = { ...defaults, ...params };
  const queryString = Object.entries(merged)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  
  return `https://www.youtube.com/embed/${videoId}?${queryString}`;
}
