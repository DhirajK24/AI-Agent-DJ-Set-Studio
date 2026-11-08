import { songKey } from './songSelection';

const phases = [
  { label: 'Warm-up', suffix: 'warm up groove' },
  { label: 'Build', suffix: 'driving groove' },
  { label: 'Peak', suffix: 'high energy' },
];

export const presets = [
  { label: 'Late-night house', icon: 'moon', prompt: 'Start with deep house, then build into melodic house, then finish with peak-time techno' },
  { label: 'Hip-hop & R&B', icon: 'note', prompt: 'Start with smooth R&B, then build into old-school hip-hop, then finish with upbeat hip-hop' },
  { label: 'Bollywood party', icon: 'bolt', prompt: 'Start with groovy Bollywood dance remixes, then build into Bollywood party hits, then finish with high-energy Punjabi dance' },
];

export function planSet(prompt) {
  const clean = prompt.trim()
    .replace(/^(?:please\s+)?(?:(?:make|build|create|give me)\s+(?:me\s+)?(?:a\s+)?(?:dj\s+)?(?:set|mix|playlist)\s*(?:of|with|for)?\s*)/i, '')
    .replace(/^start\s+with\s+/i, '')
    .replace(/[.!?]+$/, '');
  const parts = clean.split(/,?\s+then\s+(?:(?:build|go|move|switch)\s+(?:into|to)\s+|(?:end|finish)\s+with\s+)?/i)
    .map((part) => part.trim()).filter(Boolean).slice(0, 3);
  const subject = parts[0] || prompt.trim();

  return phases.map((phase, index) => ({
    ...phase,
    query: parts[index] || (index === 0 ? subject : `${parts.at(-1) || subject} ${phase.suffix}`),
  }));
}

export async function findSetTracks(plan, signal, accept = () => true) {
  const groups = await Promise.all(plan.map(async (phase) => {
    try {
      const params = new URLSearchParams({ mode: 'songs', q: phase.query });
      const response = await fetch(`/api/search?${params}`, { signal });
      if (!response.ok) return [];
      const { results } = await response.json();
      return Array.isArray(results) ? results.filter((track) => accept(track) && (phase.accept?.(track) ?? true)) : [];
    } catch (error) {
      if (signal.aborted) throw error;
      return [];
    }
  }));
  const usedIds = new Set();
  const usedTitles = new Set();
  const usedArtists = new Set();
  const selected = groups.map(() => []);
  // Give each phase a pick before filling the second slot.
  for (let round = 0; round < 2; round++) {
    for (const [index, candidates] of groups.entries()) {
      const matches = candidates.filter(({ videoId, title }) => !usedIds.has(videoId) && !usedTitles.has(songKey(title)));
      const track = matches.find(({ author }) => author && !usedArtists.has(author.toLowerCase())) ?? matches[0];
      if (!track) continue;
      usedIds.add(track.videoId);
      usedTitles.add(songKey(track.title));
      if (track.author) usedArtists.add(track.author.toLowerCase());
      selected[index].push({ ...track, phase: plan[index].label });
    }
  }
  return selected.flat();
}
