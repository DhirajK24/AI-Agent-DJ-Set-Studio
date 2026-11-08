import { NextResponse } from 'next/server';
import { findDanceChapter } from '@/utils/danceCue';

export async function GET(request) {
  const videoId = new URL(request.url).searchParams.get('v');
  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: 'Invalid YouTube video ID' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(3500)]),
    });
    if (!response.ok) throw new Error('YouTube metadata unavailable');
    const html = await response.text();
    const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{[^<]+?\})\s*;\s*<\/script>/);
    const details = match && JSON.parse(match[1]).videoDetails;
    if (details?.videoId !== videoId) throw new Error('YouTube metadata unavailable');

    const duration = Number(details.lengthSeconds) || 0;
    const cue = findDanceChapter(details.shortDescription || '', duration);
    return NextResponse.json({ duration, cue }, {
      headers: { 'Cache-Control': 'public, max-age=900' },
    });
  } catch {
    return NextResponse.json({ duration: 0, cue: null });
  }
}
