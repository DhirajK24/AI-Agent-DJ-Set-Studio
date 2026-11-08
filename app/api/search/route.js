import { NextResponse } from 'next/server';
import { findEmbeddableSongs, searchMusicSongs } from './songs';

/**
 * YouTube search proxy — tries multiple free APIs (no key needed)
 * Search YouTube first and give mirror fallbacks a shared time budget.
 */

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://api.piped.projectsegfau.lt',
  'https://pipedapi.in.projectsegfau.lt',
  'https://pipedapi.leptons.xyz',
  'https://piped-api.privacy.com.de',
  'https://pipedapi.darkness.services',
];

const INVIDIOUS_INSTANCES = [
  'https://vid.puffyan.us',
  'https://invidious.lunar.icu',
  'https://yewtu.be',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.privacyredirect.com',
  'https://invidious.projectsegfau.lt',
];

/**
 * Try searching via Piped API
 */
async function searchPiped(query, signal) {
  for (const instance of PIPED_INSTANCES) {
    if (signal.aborted) break;
    try {
      const url = `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.any([signal, AbortSignal.timeout(2500)]),
      });

      if (!response.ok) continue;
      const data = await response.json();

      if (!data.items || data.items.length === 0) continue;

      return data.items
        .filter((item) => item.type === 'stream')
        .slice(0, 15)
        .map((item) => ({
          videoId: item.url?.replace('/watch?v=', '') || '',
          title: item.title || 'Untitled',
          author: item.uploaderName || item.uploader || '',
          duration: item.duration || 0,
          viewCount: item.views || 0,
          thumbnail: item.thumbnail || `https://img.youtube.com/vi/${item.url?.replace('/watch?v=', '')}/mqdefault.jpg`,
        }))
        .filter((item) => item.videoId);
    } catch (err) {
      console.warn(`Piped instance ${instance} failed:`, err.message);
      continue;
    }
  }
  return null;
}

/**
 * Try searching via Invidious API
 */
async function searchInvidious(query, signal) {
  for (const instance of INVIDIOUS_INSTANCES) {
    if (signal.aborted) break;
    try {
      const url = `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&sort_by=relevance`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.any([signal, AbortSignal.timeout(2500)]),
      });

      if (!response.ok) continue;
      const data = await response.json();

      if (!Array.isArray(data) || data.length === 0) continue;

      return data
        .filter((item) => item.type === 'video')
        .slice(0, 15)
        .map((item) => ({
          videoId: item.videoId,
          title: item.title,
          author: item.author,
          duration: item.lengthSeconds,
          viewCount: item.viewCount,
          thumbnail: item.videoThumbnails?.find((t) => t.quality === 'medium')?.url
            || `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`,
        }));
    } catch (err) {
      console.warn(`Invidious instance ${instance} failed:`, err.message);
      continue;
    }
  }
  return null;
}

/**
 * Fallback: YouTube InnerTube API (the same API YouTube's own website uses)
 * This is undocumented but works without an API key
 */
async function searchInnerTube(query, signal, limit = 15) {
  try {
    const response = await fetch('https://www.youtube.com/youtubei/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        query: query,
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240101.00.00',
            hl: 'en',
            gl: 'US',
          },
        },
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(6500)]),
    });

    if (!response.ok) return null;
    const data = await response.json();

    // Parse the nested InnerTube response structure
    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents;

    if (!contents) return null;

    const results = [];
    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents;
      if (!items) continue;

      for (const item of items) {
        const video = item?.videoRenderer;
        if (!video || !video.videoId) continue;

        // Parse duration text like "3:45" to seconds
        let durationSeconds = 0;
        const durationText = video.lengthText?.simpleText || '';
        if (durationText) {
          const parts = durationText.split(':').map(Number);
          if (parts.length === 3) durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
          else if (parts.length === 2) durationSeconds = parts[0] * 60 + parts[1];
        }

        // Parse view count
        let viewCount = 0;
        const viewText = video.viewCountText?.simpleText || '';
        const viewMatch = viewText.replace(/,/g, '').match(/(\d+)/);
        if (viewMatch) viewCount = parseInt(viewMatch[1]);

        results.push({
          videoId: video.videoId,
          title: video.title?.runs?.[0]?.text || 'Untitled',
          author: video.ownerText?.runs?.[0]?.text || '',
          duration: durationSeconds,
          viewCount: viewCount,
          thumbnail: `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`,
        });

        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    }

    return results.length > 0 ? results : null;
  } catch (err) {
    console.warn('InnerTube search failed:', err.message);
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query) {
    return NextResponse.json({ error: 'Missing search query' }, { status: 400 });
  }

  if (searchParams.get('mode') === 'songs') {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(11500)]);
    const format = /\b(house|techno|trance|garage)\b/i.test(query) ? 'original mix' : 'official music video';
    const [catalog, videos] = await Promise.all([
      searchMusicSongs(query, signal),
      searchInnerTube(`${query} ${format}`, signal, 28),
    ]);
    // Next.js can rewrite 127.0.0.1 to localhost, but YouTube checks the actual embedding host.
    const host = request.headers.get('host') ?? request.nextUrl.host;
    const origin = `${request.nextUrl.protocol}//${host}`;
    const results = await findEmbeddableSongs(catalog, videos ?? [], origin, signal);
    return NextResponse.json({ results });
  }

  const results = await searchInnerTube(query, request.signal);
  if (results?.length) {
    return NextResponse.json({ results, source: 'innertube' });
  }

  const fallback = new AbortController();
  const signal = AbortSignal.any([request.signal, fallback.signal, AbortSignal.timeout(5000)]);
  const mirrors = [['piped', searchPiped], ['invidious', searchInvidious]];
  try {
    const result = await Promise.any(mirrors.map(async ([source, search]) => {
      const matches = await search(query, signal);
      if (!matches?.length) throw new Error('No results');
      return { results: matches, source };
    }));
    return NextResponse.json(result);
  } catch {
    // Both mirror families returned no matches.
  } finally {
    fallback.abort();
  }

  return NextResponse.json(
    {
      error: 'Search temporarily unavailable. Please paste a YouTube URL instead.',
      results: [],
    },
    { status: 503 }
  );
}
