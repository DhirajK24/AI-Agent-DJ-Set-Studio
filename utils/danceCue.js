const danceKeywords = /\b(dance(?:floor|\s+party)?|party|club(?:bing)?|bangers?|edm|garba|baraat|disco)\b/i;
const nonDanceKeywords = /\b(?:no|not|without)\s+(?:any\s+)?(?:dance|party|club|bangers?|edm|disco)\b|\b(?:slow|first) dance\b/gi;

export function isDanceBrief(brief) {
  return danceKeywords.test(brief.replace(nonDanceKeywords, ''));
}

const highlightSeconds = 45;

export function makeDanceCue(start, duration, source, label = '', end = start + highlightSeconds) {
  if (!Number.isFinite(start) || start < 0 || (duration > 0 && start >= duration)) return null;
  return { start, end: Math.min(end, duration || Infinity), source, label };
}

export function estimateDanceCue(duration) {
  if (!Number.isFinite(duration) || duration < 45) return null;
  const start = Math.min(55, Math.round(duration * 0.24));
  return makeDanceCue(start, duration, 'estimate');
}

const timestampLine = /^\s*(?:[-*•]\s*)?\[?(?:(\d+):)?(\d+):([0-5]\d)\]?\s*[-–—|:]?\s*(\S.*)$/;
const danceLabels = [
  /\b(?:dance break|beat drop|bass drop|drop)\b/i,
  /\b(?:chorus|hook|refrain|mukhda)\b/i,
  /\b(?:dance section|dance part|main groove)\b/i,
];

export function findDanceChapter(description, duration) {
  const chapters = [];
  for (const line of description.split(/\r?\n/)) {
    const match = line.match(timestampLine);
    if (!match) continue;
    const [, hours = 0, minutes, seconds, label] = match;
    const start = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
    if (duration > 0 && start >= duration) continue;
    chapters.push({ start, label: label.trim() });
  }
  chapters.sort((first, second) => first.start - second.start);

  for (const pattern of danceLabels) {
    for (const chapter of chapters) {
      if (!pattern.test(chapter.label) || /\b(?:pre[- ]?(?:chorus|drop|hook)|build[- ]?up)\b/i.test(chapter.label)) continue;
      const next = chapters.find((item) => item.start > chapter.start);
      const end = Math.min(chapter.start + highlightSeconds, next?.start ?? Infinity, duration || Infinity);
      if (end - chapter.start >= 8) return makeDanceCue(chapter.start, duration, 'chapter', chapter.label.slice(0, 80), end);
    }
  }
  return null;
}
