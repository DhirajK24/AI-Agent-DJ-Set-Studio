import { planSet } from './setPlanner';
import { isDanceBrief } from './danceCue';
import { songKey } from './songSelection';

export const languageStyles = {
  Hindi: ['Dance', 'Retro Dance', 'Romantic', 'Sufi', 'Desi Hip-Hop'],
  Punjabi: ['Bhangra', 'Party', 'Wedding', 'Sad', 'Workout'],
  English: ['Pop', 'Hip-Hop', 'R&B', 'House', 'Rock'],
  Tamil: ['Kuthu', 'Mass', 'Romantic'],
  Telugu: ['Dance', 'Mass', 'Melody'],
  Gujarati: ['Garba', 'Dandiya', 'Folk'],
};

export const energies = {
  warm: ['Warming Up', 'Ease the room in', 'upbeat warm up'],
  peak: ['Peak Party', 'Keep the dance floor moving', 'dance party hits'],
  cool: ['Winding Down', 'Give the room a breather', 'relaxed mellow'],
  bangers: ['Only Bangers', 'High energy throughout', 'high energy dance anthems'],
};

export const crowds = {
  small: ['Small group', '1–6 people', 'deeper cuts'],
  party: ['House party', '7–20 people', 'popular favorites'],
  floor: ['Dance floor', '21+ people', 'crowd favorites'],
};

export const defaultRadio = {
  languages: [], styles: {}, energy: 'peak', crowd: 'party', duration: 0,
  warmupMinutes: 0, windDown: false, anchors: '', originals: false, brief: '',
};

export function radioFromBrief(brief) {
  const duration = brief.match(/\bfor\s+(\d+|an?)\s*(hours?|hrs?|minutes?|mins?)\b/i);
  const minutes = duration ? (Number(duration[1]) || 1) * (/^h/i.test(duration[2]) ? 60 : 1) : 0;
  const clean = brief.replace(/\bfor\s+(\d+|an?)\s*(hours?|hrs?|minutes?|mins?)\b/i, '')
    .replace(/\b(?:originals? (?:only|versions?)|no (?:remixes|repeats))\b/gi, '').trim();
  const languages = Object.keys(languageStyles).filter((language) => new RegExp(`\\b${language}\\b`, 'i').test(brief));
  const arc = /\bthen\b/i.test(clean) ? planSet(clean) : null;
  return {
    ...defaultRadio, brief, languages, duration: Math.min(480, minutes),
    energy: /only bangers/i.test(brief) ? 'bangers' : isDanceBrief(brief) ? 'peak' : /chill|relax|wind down/i.test(brief) ? 'cool' : 'warm',
    originals: /originals? only|original versions|no remixes/i.test(brief),
    query: clean || brief, arc,
  };
}

export function radioEnergy(config, elapsed) {
  if (config.windDown && config.duration && elapsed >= Math.max(0, config.duration - 10)) return 'cool';
  if (config.energy === 'warm' && config.warmupMinutes && elapsed >= config.warmupMinutes) return 'peak';
  return config.energy;
}

export function radioPlan(config, batch, elapsed, anchorArtist) {
  const energy = radioEnergy(config, elapsed);
  const [label, , energyQuery] = energies[energy];
  const [, , crowdQuery] = crowds[config.crowd];
  const phase = config.arc?.[Math.min(2, Math.floor(elapsed / (config.duration ? config.duration / 3 : 20)))];
  const lanes = config.languages.flatMap((language) => {
    const styles = config.styles[language];
    return styles?.length ? styles.map((style) => `${language} ${style}`) : [language];
  });
  const sources = lanes.length ? lanes : [''];
  if (config.priority && lanes.length > 1) {
    sources.push(...lanes.filter((lane) => lane.startsWith(config.priority)));
  }
  const variants = [crowdQuery, 'individual songs', 'classics', 'lesser known tracks', 'essential songs', 'favorites'];
  const offset = batch * 2;
  return Array.from({ length: 2 }, (_, index) => {
    const lane = sources[(offset + index) % sources.length];
    const variant = variants[Math.floor((offset + index) / sources.length) % variants.length];
    const seed = batch === 0 || batch % 4 !== 2 || index !== 1 ? '' : anchorArtist;
    return {
      label: phase?.label ?? label,
      query: [phase?.query ?? config.query, lane, config.query && !config.steered ? '' : energyQuery, seed || variant]
        .filter(Boolean).join(' '),
    };
  });
}

export function anchorSearch(query, position) {
  const words = new Set(songKey(query).split(' '));
  return {
    query,
    label: `Must-play ${position + 1}`,
    accept: ({ title }) => songKey(title).split(' ').every((word) => words.has(word)),
  };
}

export function radioBrief(config) {
  return (!config.steered && config.brief) || [
    config.languages.map((language) => [language, ...(config.styles[language] ?? [])].join(' ')).join(' + '),
    !config.languages.length && config.query,
    energies[config.energy][0], crowds[config.crowd][0],
  ].filter(Boolean).join(' · ');
}
