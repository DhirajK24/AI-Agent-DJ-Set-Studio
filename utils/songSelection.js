const compilation = /\b(?:playlists?|jukebox|compilations?|mega[ -]?mix|mash[ -]?ups?|non[ -]?stop|medleys?|live sets?|dj sets?|dj mixes|dj mix(?!\))|full album|best of|greatest hits|top \d+|mix (?:vol\.?\s*)?\d+|\d+\s*(?:hours?|minutes?|songs|tracks)|ultimate\s+.*\bmix)\b/i;
const performance = /\b(?:choreography|(?:dance|bhangra) (?:challenge|class|cover|moves|performance|practice|routine|tutorial|workshop)|reaction video)\b/i;

export function isSingleTrack(track) {
  return /^[\w-]{11}$/.test(track.videoId)
    && track.duration >= 60
    && track.duration <= 660
    && track.title.length <= 140
    && !compilation.test(track.title)
    && !performance.test(track.title);
}

export function songKey(title) {
  return title.normalize('NFKC').toLowerCase()
    .replace(/\s*[[(](?:official|lyric|music video|video|audio|visuali[sz]er|remaster|from |feat\.? ).*?[\])]/gi, '')
    .split(/\s+\|\s+/)[0]
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}
