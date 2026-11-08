import { getThumbnailUrl } from '@/utils/youtube';
import { isSingleTrack } from '@/utils/songSelection';

const musicOrigin = 'https://music.youtube.com';
// The Songs tab filter used by the public YouTube Music web client.
const songFilter = 'EgWKAQIIAWoMEA4QChADEAQQCRAF';

function getRuns(column) {
  return column?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];
}

export async function searchMusicSongs(query, signal) {
  try {
    const response = await fetch(`${musicOrigin}/youtubei/v1/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: musicOrigin },
      body: JSON.stringify({
        query,
        params: songFilter,
        context: { client: {
          clientName: 'WEB_REMIX',
          clientVersion: '1.20261031.01.00',
          hl: 'en',
        } },
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(4500)]),
    });
    if (!response.ok) return [];
    const { contents } = await response.json();
    const page = contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content ?? contents;
    const shelves = page?.sectionListRenderer?.contents ?? [];

    return shelves.flatMap(({ musicShelfRenderer: shelf }) => shelf?.contents ?? [])
      .flatMap(({ musicResponsiveListItemRenderer: row }) => {
        if (!row || row.musicItemRendererDisplayPolicy === 'MUSIC_ITEM_RENDERER_DISPLAY_POLICY_GREY_OUT') return [];
        const videoId = row.playlistItemData?.videoId;
        const [titleColumn, ...details] = row.flexColumns ?? [];
        const title = getRuns(titleColumn).map(({ text }) => text).join('');
        const info = details.flatMap(getRuns);
        const durationText = info.find(({ text }) => /^\d+:\d{2}$/.test(text))?.text;
        if (!videoId || !title || !durationText) return [];
        const [minutes, seconds] = durationText.split(':').map(Number);
        const author = info.find(({ navigationEndpoint }) => navigationEndpoint?.browseEndpoint?.browseId?.startsWith('UC'))?.text
          ?? info.find(({ text }) => /\p{L}/u.test(text) && text !== 'Song')?.text ?? '';
        return [{ videoId, title, author, duration: minutes * 60 + seconds, thumbnail: getThumbnailUrl(videoId) }];
      })
      .filter(isSingleTrack)
      .slice(0, 14);
  } catch {
    return [];
  }
}

async function canEmbed(videoId, origin, signal) {
  try {
    const response = await fetch(`https://www.youtube.com/embed/${videoId}`, {
      headers: { Referer: `${origin}/` },
      next: { revalidate: 900 },
      signal: AbortSignal.any([signal, AbortSignal.timeout(3000)]),
    });
    if (!response.ok) return false;
    const html = await response.text();
    const embedded = html.match(/"embedded_player_response"\s*:\s*("(?:[^"\\]|\\.)*")/)?.[1];
    if (!embedded) return false;
    const data = JSON.parse(JSON.parse(embedded));
    return data.previewPlayabilityStatus?.status === 'OK';
  } catch {
    return false;
  }
}

export async function findEmbeddableSongs(catalog, videos, origin, signal) {
  const candidates = new Map();
  // Alternate sources so official videos get a chance when catalogue audio is restricted.
  for (let index = 0; index < Math.max(catalog.length, videos.length); index++) {
    for (const track of [catalog[index], videos[index]]) {
      if (track && isSingleTrack(track) && !candidates.has(track.videoId)) {
        candidates.set(track.videoId, track);
      }
    }
  }

  const results = [];
  const ranked = [...candidates.values()].slice(0, 22);
  for (let index = 0; index < ranked.length && results.length < 5 && !signal.aborted; index += 8) {
    const batch = ranked.slice(index, index + 8);
    const playable = await Promise.all(batch.map(({ videoId }) => canEmbed(videoId, origin, signal)));
    results.push(...batch.filter((_, position) => playable[position]));
  }
  return results;
}
