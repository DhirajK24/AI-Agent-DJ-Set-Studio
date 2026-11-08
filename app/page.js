'use client';

import Link from 'next/link';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import AddNextDialog from '@/components/Studio/AddNextDialog';
import AudioFileMix from '@/components/Studio/AudioFileMix';
import Icon from '@/components/Studio/Icon';
import LiveStage from '@/components/Studio/LiveStage';
import VibeSetup from '@/components/Studio/VibeSetup';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { estimateDanceCue, isDanceBrief, makeDanceCue } from '@/utils/danceCue';
import { cancelVolumeFade, fadePlayerVolume } from '@/utils/playerVolume';
import { findSetTracks, planSet, presets } from '@/utils/setPlanner';
import { songKey } from '@/utils/songSelection';
import { anchorSearch, defaultRadio, energies, radioBrief, radioFromBrief, radioPlan } from '@/utils/vibeRadio';
import { extractStartTime, extractVideoId, formatTime, getThumbnailUrl } from '@/utils/youtube';
import styles from './page.module.css';

function TrackArtwork({ track }) {
  return (
    <span className={styles.trackArtwork} style={track ? { backgroundImage: `url(${getThumbnailUrl(track.videoId)})` } : undefined}>
      {!track && <Icon name="note" size={19} />}
    </span>
  );
}

function lookupDanceMetadata(cache, videoId) {
  if (!cache.has(videoId)) {
    const lookup = fetch(`/api/dance-cue?v=${videoId}`, { signal: AbortSignal.timeout(4500) })
      .then((response) => response.ok ? response.json() : null)
      .catch(() => null)
      .then((metadata) => {
        if (!metadata?.duration && !metadata?.cue) cache.delete(videoId);
        return metadata;
      });
    cache.set(videoId, lookup);
  }
  return cache.get(videoId);
}

function savedCueTime(videoId) {
  try {
    const saved = localStorage.getItem(`studio:cue:${videoId}`);
    return saved === null ? null : Number(saved);
  } catch {
    return null;
  }
}

const cueLabels = { chapter: 'YouTube chapter', estimate: 'Estimated cue', link: 'Link timestamp', saved: 'Your cue' };
const skipFadeMs = 70;
const fadeInMs = 100;
const autoFadeInMs = 240;
const mixFadeMs = 3000;
const autoMixFadeMs = 5000;
const autoMixLeadSeconds = 10;
const mixCueLeadSeconds = 6;
const previewVolumeRatio = 0.12;
const mixTimeoutMs = 12000;
const autoStartTimeoutMs = 6000;

function playbackPlan(track, danceMode, { cue = null } = {}) {
  const saved = danceMode ? savedCueTime(track.videoId) : null;
  let knownCue = cue;
  if (!knownCue && danceMode) {
    if (saved !== null) knownCue = makeDanceCue(saved, track.duration, 'saved');
    if (!knownCue && track.startTime != null) knownCue = makeDanceCue(track.startTime, track.duration, 'link');
  }
  return {
    track,
    cue: knownCue,
    startSeconds: knownCue?.start ?? track.startTime ?? 0,
    pending: danceMode && !knownCue,
  };
}

function resolveCue(plan, metadata) {
  const cue = metadata?.cue ?? estimateDanceCue(metadata?.duration || plan.track.duration);
  return { ...plan, cue, startSeconds: cue?.start ?? 0, pending: false };
}

async function resolvePlayback(plan, cache) {
  if (!plan.pending) return plan;
  return resolveCue(plan, await lookupDanceMetadata(cache, plan.track.videoId));
}

function videoOptions(selection) {
  // The app enforces the cue end so it can be removed without reloading the video.
  return {
    videoId: selection.track.videoId,
    startSeconds: selection.startSeconds,
  };
}

function djUpdate({ mixing, next, standbyDeckName, playerNotice, radio, radioStatus, autoAdvance, showMixCue }) {
  if (mixing?.blending) return `Bringing in “${mixing.track.title}” now.`;
  if (mixing?.previewing) {
    return `${standbyDeckName} is playing quietly. I’ll bring it up in the last ${mixing.automatic ? 'five' : 'three'} seconds.`;
  }
  if (mixing) return `Loading “${mixing.track.title}” on ${standbyDeckName}. The current track keeps playing.`;
  if (playerNotice) return playerNotice;
  if (showMixCue) return 'Tap Mix next now to give the next song time to load.';
  if (!next) return radio ? radioStatus || 'Finding another song for this vibe.' : 'Add another track to keep the set going.';
  if (next.phase === 'Must-play') return `“${next.title}” is one of your requests. I’ve queued it next.`;
  if (next.phase && next.phase !== 'Added by you') {
    return `I picked “${next.title}” for ${next.phase.toLowerCase()}. ${autoAdvance ? 'I’ll mix it in near the end.' : 'It’s queued for your next mix.'}`;
  }
  return `“${next.title}” is queued on ${standbyDeckName}.`;
}

function getAgentMode({ mixing, playing, autoAdvance, next, remaining, radio }) {
  if (mixing?.blending) return 'mixing';
  if (mixing && !mixing.previewing) return 'cueing';
  if (!playing) return 'idle';
  const approachingMix = autoAdvance && next && remaining > autoMixFadeMs / 1000 && remaining <= autoMixLeadSeconds;
  return approachingMix || mixing?.previewing || (!next && radio) ? 'cueing' : 'live';
}

export default function HomePage() {
  const [source, setSource] = useState('youtube');
  const [fullscreenMode, setFullscreenMode] = useState(null);
  const studio = useRef(null);

  useEffect(() => {
    function syncFullscreen() {
      const isNative = document.fullscreenElement === studio.current;
      setFullscreenMode((mode) => isNative ? 'browser' : mode === 'browser' ? null : mode);
    }
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  useEffect(() => {
    if (fullscreenMode !== 'app') return;
    function exitOnEscape(event) {
      if (event.key === 'Escape' && !event.defaultPrevented && !studio.current?.querySelector('dialog[open]')) setFullscreenMode(null);
    }
    document.addEventListener('keydown', exitOnEscape);
    return () => document.removeEventListener('keydown', exitOnEscape);
  }, [fullscreenMode]);

  async function toggleFullscreen() {
    if (fullscreenMode === 'app') {
      setFullscreenMode(null);
      return;
    }
    if (document.fullscreenElement === studio.current) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    const shell = studio.current;
    if (shell?.requestFullscreen && document.fullscreenEnabled) {
      try {
        await shell.requestFullscreen();
        return;
      } catch {
        // An embedded browser may reject native fullscreen. Fill its viewport instead.
      }
    }
    setFullscreenMode('app');
  }

  return (
    <div className={`${styles.studio} ${styles.onAirShell}`} ref={studio} data-fullscreen={fullscreenMode || undefined}>
      <header className={`${styles.header} ${styles.sourceHeader}`}>
        <div className={styles.brand}>
          <span className={styles.brandMark}><Icon name="wave" size={23} /></span>
          <span>Set Studio <small>AI DJ</small></span>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.sourcePicker} role="group" aria-label="Music source">
            <button type="button" aria-pressed={source === 'youtube'} onClick={() => setSource('youtube')}>YouTube</button>
            <button type="button" aria-pressed={source === 'files'} onClick={() => setSource('files')}>Audio files</button>
          </div>
          <Link href="/manual" className={styles.manualLink}><Icon name="sliders" size={17} /> Manual Mixer <Icon name="diagonal" size={13} /></Link>
        </div>
      </header>
      {source === 'files' ? <AudioFileMix /> : <YouTubeSet fullscreen={Boolean(fullscreenMode)} onToggleFullscreen={toggleFullscreen} />}
    </div>
  );
}

function YouTubeSet({ fullscreen, onToggleFullscreen }) {
  const [showStudio, setShowStudio] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [brief, setBrief] = useState('');
  const [plan, setPlan] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [unavailable, setUnavailable] = useState(() => new Set());
  const [selection, setSelection] = useState(null);
  const [mixing, setMixing] = useState(null);
  const [building, setBuilding] = useState(false);
  const [notice, setNotice] = useState('');
  const [playerNotice, setPlayerNotice] = useState('');
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [danceOverride, setDanceOverride] = useState(null);
  const [volume, setVolume] = useState(80);
  const [radio, setRadio] = useState(null);
  const [vibeSetup, setVibeSetup] = useState(null);
  const [addingNext, setAddingNext] = useState(false);
  const [radioStatus, setRadioStatus] = useState('');
  const radioSession = useRef(null);
  const volumeTarget = useRef(80);
  const request = useRef(null);
  const composer = useRef(null);
  const main = useRef(null);
  const selectedTrack = useRef(null);
  const loadedSelection = useRef(null);
  const finishedSelection = useRef(null);
  const fadedSelection = useRef(null);
  const danceMetadata = useRef(new Map());
  const players = useRef([]);
  const readLevels = useCallback(() => [0, 1].map((deck) => {
    const player = players.current[deck];
    return player?.getPlayerState() === 1 && !player.isMuted?.() ? Math.round(player.getVolume()) : 0;
  }), []);
  const prepared = useRef(null);
  const handoff = useRef(null);
  const autoStartTimer = useRef(null);
  const activeMix = useRef(null);
  const autoMixAttempt = useRef(null);
  const danceMode = danceOverride ?? (radio ? ['peak', 'bangers'].includes(radio.energy) : isDanceBrief(brief));
  const current = selection?.track;
  const playerOnly = Boolean(current && !showStudio);
  const activeId = current?.videoId;
  const activeCue = selection?.cue;
  const index = tracks.findIndex((track) => track.videoId === activeId);
  const incomingId = mixing?.track.videoId;
  const reorderBoundary = Math.max(index, tracks.findIndex((track) => track.videoId === incomingId));
  const next = tracks.slice(index + 1).find((track) => !unavailable.has(track.videoId));
  const radioUpcoming = tracks.slice(index + 1).filter((track) => !unavailable.has(track.videoId)).length;
  const previous = index > 0 ? tracks.slice(0, index).findLast((track) => !unavailable.has(track.videoId)) : undefined;
  const activeDeck = selection?.deck ?? 0;
  const standbyDeck = 1 - activeDeck;
  const playerEnabled = Boolean(current || tracks.length);

  useEffect(() => {
    if (!playerOnly) return;
    main.current.scrollTop = 0;
    main.current.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [playerOnly]);

  function cancelMix(message) {
    const mix = activeMix.current;
    if (!mix) return;
    activeMix.current = null;
    clearTimeout(mix.timeout);
    cancelVolumeFade(mix.outgoingPlayer);
    cancelVolumeFade(mix.incomingPlayer);
    mix.incomingPlayer.setVolume(0);
    mix.incomingPlayer.pauseVideo();
    mix.outgoingPlayer.setVolume(volumeTarget.current);
    setMixing(null);
    if (message) setPlayerNotice(message);
  }

  const playSelection = useCallback((player, incoming, load) => {
    const staged = prepared.current;
    const canPlayCue = staged?.deck === incoming.deck && staged.track === incoming.track
      && staged.plan.startSeconds === incoming.startSeconds
      && player.getPlayerState() === 5 && extractVideoId(player.getVideoUrl()) === incoming.track.videoId;
    if (staged?.deck === incoming.deck) prepared.current = null;
    player.setVolume(0);
    if (canPlayCue) player.playVideo();
    else if (load) load(incoming.track.videoId, videoOptions(incoming));
    else player.loadVideoById(videoOptions(incoming));
  }, []);

  function startMix(track, outgoingPlayer, incomingPlayer, automatic = false) {
    cancelMix();
    cancelVolumeFade(outgoingPlayer);
    outgoingPlayer.setVolume(volumeTarget.current);
    const staged = prepared.current;
    const plan = staged?.deck === standbyDeck && staged.track === track && staged.danceMode === danceMode
      ? staged.plan : playbackPlan(track, danceMode);
    const incoming = { ...(plan.pending ? resolveCue(plan) : plan), deck: standbyDeck };
    const end = Math.min(activeCue?.end ?? Infinity, outgoingPlayer.getDuration() || Infinity);
    const remaining = end - outgoingPlayer.getCurrentTime();
    const waitForEnd = automatic || (remaining > 0 && remaining <= mixCueLeadSeconds);
    const mix = { incoming, incomingPlayer, outgoingPlayer, end, automatic, waitForEnd, lastTime: null, fade: null };
    activeMix.current = mix;
    watchMixBuffering(mix);
    const showMix = () => {
      setPlayerNotice('');
      setMixing({ track, deck: standbyDeck, automatic, waitForEnd, blending: false });
    };
    if (automatic) showMix();
    else {
      flushSync(showMix);
    }
    playSelection(incomingPlayer, incoming);
  }

  function failMix(message, skipIncoming = false) {
    const mix = activeMix.current;
    cancelMix(message);
    if (!mix?.automatic || finishedSelection.current !== selection) return;
    advanceAfterEnd(skipIncoming ? mix.incoming.track.videoId : null);
  }

  function watchMixBuffering(mix) {
    mix.timeout = setTimeout(() => {
      if (activeMix.current === mix) failMix('The next song took too long to start.');
    }, mixTimeoutMs);
  }

  function completeMix(mix) {
    activeMix.current = null;
    clearTimeout(mix.timeout);
    if (mix.waitForEnd) mix.outgoingPlayer.setVolume(0);
    else mix.outgoingPlayer.pauseVideo();
    mix.incomingPlayer.setVolume(volumeTarget.current);
    loadedSelection.current = mix.incoming;
    fadedSelection.current = mix.incoming;
    selectedTrack.current = mix.incoming.track;
    setSelection(mix.incoming);
    setMixing(null);
  }

  function mixProgress(mix, time) {
    if (mix.fade || extractVideoId(mix.incomingPlayer.getVideoUrl()) !== mix.incoming.track.videoId) return;
    const advancing = mix.lastTime !== null && time > mix.lastTime;
    mix.lastTime = time;
    if (!advancing) return;

    const outgoing = mix.outgoingPlayer;
    const outgoingFinished = finishedSelection.current === selection;
    const availableMs = outgoingFinished ? 0 : (mix.end - outgoing.getCurrentTime()) * 1000;
    clearTimeout(mix.timeout);
    if (mix.waitForEnd && !mix.previewing) {
      mix.previewing = true;
      mix.incomingPlayer.setVolume(Math.round(volumeTarget.current * previewVolumeRatio));
      setMixing((state) => ({ ...state, previewing: true }));
    }
    const outgoingPlaying = outgoing.getPlayerState() === 1;
    const fadeMs = mix.automatic ? autoMixFadeMs : mixFadeMs;
    if (mix.waitForEnd && !outgoingFinished && (!outgoingPlaying || availableMs > fadeMs)) return;

    const fade = { done: false };
    mix.fade = fade;
    setMixing((state) => ({ ...state, blending: true }));
    const duration = outgoingPlaying && availableMs > 0
      ? Math.min(fadeMs, availableMs) : fadeInMs;
    void Promise.all([
      mix.waitForEnd && !mix.automatic ? null : fadePlayerVolume(outgoing, 0, duration),
      fadePlayerVolume(mix.incomingPlayer, volumeTarget.current, duration),
    ]).then(() => {
      if (activeMix.current !== mix || mix.fade !== fade) return;
      fade.done = true;
      if (!mix.waitForEnd || finishedSelection.current === selection) completeMix(mix);
    });
  }

  async function startPlayback(track, options) {
    if (!track) return;
    cancelMix();
    setPlayerNotice(options?.atEnd ? 'Loading the next song…' : '');
    const outgoing = loadedSelection.current;
    const otherDeck = outgoing ? 1 - outgoing.deck : 1;
    const deck = outgoing && outgoing.track.videoId !== track.videoId && players.current[otherDeck]
      ? otherDeck : outgoing?.deck ?? 0;
    const staged = !options?.cue && prepared.current?.deck === deck
      && prepared.current.track === track && prepared.current.danceMode === danceMode ? prepared.current : null;
    if (staged) prepared.current = { ...staged };
    const requested = { ...(staged?.plan ?? playbackPlan(track, danceMode, options)), deck, automatic: Boolean(options?.atEnd) };
    const token = { track };
    handoff.current = token;

    if (!outgoing) {
      selectedTrack.current = track;
      setSelection(requested);
    }
    // Advance without waiting on a metadata request after the outgoing audio has stopped.
    let incoming = requested;
    if (requested.pending) {
      incoming = options?.atEnd ? resolveCue(requested) : await resolvePlayback(requested, danceMetadata.current);
    }
    if (handoff.current !== token) return;

    const player = outgoing && players.current[outgoing.deck];
    if (!options?.atEnd && player?.getPlayerState() === 1) {
      await fadePlayerVolume(player, 0, skipFadeMs);
      if (handoff.current !== token) return;
    }
    if (player) {
      cancelVolumeFade(player);
      player.setVolume(0);
      player.pauseVideo();
    }
    if (outgoing) finishedSelection.current = outgoing;
    selectedTrack.current = track;
    handoff.current = null;
    setSelection(incoming);
  }

  function finishTrack(player, pauseAtEnd = false) {
    if (handoff.current || !selection || loadedSelection.current !== selection || finishedSelection.current === selection) return;
    finishedSelection.current = selection;
    if (pauseAtEnd) player.pauseVideo();
    const mix = activeMix.current;
    if (mix) {
      if (mix.waitForEnd && mix.fade?.done) completeMix(mix);
      return;
    }
    advanceAfterEnd();
  }

  function advanceAfterEnd(skipVideoId = null) {
    if (!autoAdvance) return;
    const queued = skipVideoId
      ? tracks.slice(index + 1).find((track) => track.videoId !== skipVideoId && !unavailable.has(track.videoId))
      : next;
    if (queued) startPlayback(queued, { atEnd: true });
    else if (radioSession.current) radioSession.current.continueWhenReady = true;
  }

  function registerDeck(deck, player) {
    players.current[deck] = player;
    player.setVolume(0);
  }

  function handleDeckState(deck, value, player) {
    const mix = activeMix.current;
    if (mix?.incoming.deck === deck) {
      if (value === 3 && (mix.fade || mix.previewing)) {
        mix.fade = null;
        mix.previewing = false;
        mix.lastTime = null;
        watchMixBuffering(mix);
        cancelVolumeFade(mix.incomingPlayer);
        cancelVolumeFade(mix.outgoingPlayer);
        mix.incomingPlayer.setVolume(0);
        mix.outgoingPlayer.setVolume(volumeTarget.current);
        setMixing((state) => ({ ...state, blending: false, previewing: false }));
      }
      if (value === 0 && (mix.fade || mix.previewing)) failMix('The next song ended during the mix.', true);
      return;
    }
    if (deck !== activeDeck || !selection || loadedSelection.current !== selection) return;
    if (value === 2 && mix && finishedSelection.current !== selection) {
      if (mix.automatic) autoMixAttempt.current = null;
      cancelMix();
    }
    if (value === 1) {
      if (radioSession.current && !radioSession.current.startedAt) radioSession.current.startedAt = Date.now();
      clearTimeout(autoStartTimer.current);
      setPlayerNotice('');
      if (fadedSelection.current !== selection && !handoff.current) {
        fadedSelection.current = selection;
        void fadePlayerVolume(player, volumeTarget.current, selection.automatic ? autoFadeInMs : fadeInMs);
      }
    }
    if (value === 0) finishTrack(player);
  }

  function handleDeckProgress(deck, time, player) {
    const mix = activeMix.current;
    if (mix?.incoming.deck === deck) {
      mixProgress(mix, time);
      return;
    }
    if (deck !== activeDeck || loadedSelection.current !== selection || handoff.current) return;
    const duration = player.getDuration();
    const end = Math.min(activeCue?.end ?? Infinity, duration || Infinity);
    const remaining = end - time;
    if (activeCue && remaining <= 0) {
      finishTrack(player, true);
      return;
    }
    const standby = players.current[standbyDeck];
    if (!mix && autoAdvance && next && standby && finishedSelection.current !== selection
      && remaining > 0 && remaining <= autoMixLeadSeconds && autoMixAttempt.current !== selection) {
      autoMixAttempt.current = selection;
      startMix(next, player, standby, true);
    }
  }

  function handleDeckError(deck, code) {
    const mix = activeMix.current;
    if (mix?.incoming.deck === deck) {
      const unavailableHere = [5, 100, 101, 150].includes(code);
      if (unavailableHere) {
        setUnavailable((ids) => new Set(ids).add(mix.incoming.track.videoId));
      }
      failMix('The selected song couldn’t play here.', unavailableHere);
      return;
    }
    if (deck !== activeDeck) return;
    clearTimeout(autoStartTimer.current);
    if ([5, 100, 101, 150].includes(code) && selection && loadedSelection.current === selection) {
      setUnavailable((ids) => new Set(ids).add(activeId));
      if (autoAdvance && (next || radioSession.current)) {
        setNotice(`Skipped “${current.title}” because it couldn’t play here.`);
        finishTrack();
        return;
      }
    }
    setPlayerNotice('This video couldn’t play here. Try another track or open it on YouTube.');
  }

  function handleAutoplayBlocked(deck) {
    if (activeMix.current?.incoming.deck === deck) {
      const message = activeMix.current.automatic
        ? 'YouTube blocked the early start. The current song will keep playing.'
        : 'YouTube blocked the selected song from starting. Select it again to retry.';
      failMix(message);
    } else if (activeDeck === deck) {
      clearTimeout(autoStartTimer.current);
      setPlayerNotice('Press Play to start this track.');
    }
  }

  const deckA = useYouTubePlayer('studio-video-a', {
    enabled: playerEnabled,
    controls: true,
    onReady: ({ target }) => registerDeck(0, target),
    onStateChange: (value, player) => handleDeckState(0, value, player),
    onProgress: (time, player) => handleDeckProgress(0, time, player),
    onError: (code) => handleDeckError(0, code),
    onAutoplayBlocked: () => handleAutoplayBlocked(0),
  });
  const deckB = useYouTubePlayer('studio-video-b', {
    enabled: playerEnabled,
    controls: true,
    onReady: ({ target }) => registerDeck(1, target),
    onStateChange: (value, player) => handleDeckState(1, value, player),
    onProgress: (time, player) => handleDeckProgress(1, time, player),
    onError: (code) => handleDeckError(1, code),
    onAutoplayBlocked: () => handleAutoplayBlocked(1),
  });
  const { isReady, playerState, currentTime, duration, loadVideo, play, pause, seekTo } = activeDeck === 0 ? deckA : deckB;
  const standbyReady = standbyDeck === 0 ? deckA.isReady : deckB.isReady;
  const playing = playerState === 1;
  const remainingSeconds = Math.min(activeCue?.end ?? Infinity, duration || Infinity) - currentTime;
  const showMixCue = playing && standbyReady && next && !mixing
    && remainingSeconds > 0 && remainingSeconds <= mixCueLeadSeconds;
  const standbyDeckName = standbyDeck === 0 ? 'Deck A' : 'Deck B';
  const activeDeckStatus = mixing?.blending && (mixing.automatic || !mixing.waitForEnd)
    ? 'Fading out' : playing ? 'Now playing' : 'Current song';
  const standbyDeckStatus = mixing
    ? (mixing.blending ? 'Fading in' : mixing.previewing ? 'Quiet preview' : 'Loading')
    : next ? 'Up next' : 'Standby';

  const prepareNext = useEffectEvent(async (track, deck, signal) => {
    const requested = playbackPlan(track, danceMode);
    const metadata = requested.pending ? lookupDanceMetadata(danceMetadata.current, track.videoId) : null;
    const player = players.current[deck];
    if (signal.aborted || handoff.current || activeMix.current || !player || loadedSelection.current?.deck === deck) return;
    const plan = requested.pending ? resolveCue(requested) : requested;
    const stage = { deck, track, plan, danceMode };
    prepared.current = stage;
    player.cueVideoById(videoOptions(plan));
    if (!metadata) return;

    const resolved = resolveCue(requested, await metadata);
    if (signal.aborted || prepared.current !== stage || handoff.current
      || activeMix.current || loadedSelection.current?.deck === deck) return;
    prepared.current = { ...stage, plan: resolved };
    if (resolved.startSeconds !== plan.startSeconds) {
      player.cueVideoById(videoOptions(resolved));
    }
  });

  useEffect(() => {
    if (!current || !next) return;
    const controller = new AbortController();
    void prepareNext(next, standbyDeck, controller.signal);
    return () => controller.abort();
  }, [current, next, standbyDeck, standbyReady, danceMode]);

  useEffect(() => {
    const deckPlayers = players.current;
    return () => {
      request.current?.abort();
      radioSession.current?.request?.abort();
      radioSession.current = null;
      handoff.current = null;
      clearTimeout(activeMix.current?.timeout);
      activeMix.current = null;
      deckPlayers.forEach(cancelVolumeFade);
    };
  }, []);

  function endRadio(stopAudio = false, message = 'Radio ended.') {
    radioSession.current?.request?.abort();
    radioSession.current = null;
    setRadio(null);
    setRadioStatus('');
    if (!stopAudio) return;
    cancelMix();
    handoff.current = null;
    clearTimeout(autoStartTimer.current);
    const player = players.current[activeDeck];
    if (player) {
      cancelVolumeFade(player);
      player.pauseVideo();
      player.setVolume(volumeTarget.current);
    }
    setAutoAdvance(false);
    setNotice(message);
  }

  function activateRadio(config, editing = false) {
    const previousSession = editing ? radioSession.current : null;
    radioSession.current?.request?.abort();
    request.current?.abort();
    setBuilding(false);
    cancelMix();
    const active = selectedTrack.current;
    const queuedAnchors = previousSession
      ? tracks.slice(index + 1).filter((track) => track.anchor && !unavailable.has(track.videoId))
      : [];
    const seenIds = previousSession?.seenIds ?? new Set();
    const seenTitles = previousSession?.seenTitles ?? new Set();
    if (active) {
      seenIds.add(active.videoId);
      seenTitles.add(songKey(active.title));
    }
    radioSession.current = {
      request: null, seenIds, seenTitles, batch: 0, retryAt: 0, misses: 0,
      startedAt: previousSession?.startedAt ?? null,
      anchorQueries: previousSession?.anchorQueries ?? config.anchors.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 3),
      anchorArtist: previousSession?.anchorArtist ?? '',
      continueWhenReady: previousSession?.continueWhenReady
        ?? (!active || Boolean(loadedSelection.current && finishedSelection.current === loadedSelection.current)),
      phase: null,
    };
    setTracks([active, ...queuedAnchors].filter(Boolean));
    setRadio(config);
    setBrief(radioBrief(config));
    setPlan([]);
    setAutoAdvance(true);
    setRadioStatus('Finding songs for your vibe…');
    setNotice('');
    setVibeSetup(null);
  }

  const maintainRadio = useEffectEvent(async () => {
    const session = radioSession.current;
    if (!radio || !session) return;
    if (!session.startedAt && players.current[activeDeck]?.getPlayerState() === 1) session.startedAt = Date.now();
    const elapsed = session.startedAt ? (Date.now() - session.startedAt) / 60000 : 0;
    if (radio.duration && elapsed >= radio.duration) {
      endRadio(true, 'Your timed radio session has ended.');
      return;
    }

    const searchPlan = radioPlan(radio, session.batch, elapsed, session.anchorArtist);
    const phase = searchPlan[0].label;
    if (session.phase && session.phase !== phase && !activeMix.current) {
      session.request?.abort();
      session.request = null;
      session.retryAt = 0;
      session.phase = phase;
      setTracks((queue) => queue.filter((track, position) => position <= index || track.anchor));
      setRadioStatus(`Finding songs for ${phase.toLowerCase()}…`);
      return;
    }
    session.phase ??= phase;
    if (session.request || Date.now() < session.retryAt || (radioUpcoming >= 3 && !session.anchorQueries.length)) return;

    const controller = new AbortController();
    session.request = controller;
    session.batch += 1;
    setRadioStatus('Finding more songs…');
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    const accept = (track) => !unavailable.has(track.videoId) && !tracks.some((queued) => queued.videoId === track.videoId)
      && !session.seenIds.has(track.videoId)
      && !session.seenTitles.has(songKey(track.title))
      && (!radio.originals || !/\b(?:remix(?:ed)?|cover|mashup|sped up|slowed|karaoke)\b/i.test(track.title));
    try {
      const anchors = session.anchorQueries;
      const found = anchors.length
        ? await findSetTracks(anchors.map(anchorSearch), signal, accept)
        : await findSetTracks(searchPlan, signal, accept);
      if (controller.signal.aborted || radioSession.current !== session) return;
      if (anchors.length) session.anchorQueries = [];
      const additions = anchors.length
        ? found.filter((track, position) => found.findIndex((candidate) => candidate.phase === track.phase) === position)
        : found;
      for (const track of additions) {
        session.seenIds.add(track.videoId);
        session.seenTitles.add(songKey(track.title));
      }
      if (anchors.length && additions[0]?.author) session.anchorArtist = additions[0].author;
      if (additions.length) {
        const songs = anchors.length ? additions.map((track) => ({ ...track, anchor: true, phase: 'Must-play' })) : additions;
        session.misses = 0;
        session.retryAt = 0;
        setTracks((queue) => {
          const position = queue.findIndex((track) => track.videoId === selectedTrack.current?.videoId);
          const queued = new Set(queue.map((track) => track.videoId));
          return [...queue.slice(Math.max(0, position - 8)), ...songs.filter((track) => !queued.has(track.videoId))];
        });
        if (session.continueWhenReady) {
          session.continueWhenReady = false;
          void startPlayback(songs[0], { atEnd: true });
        }
        setRadioStatus(anchors.length > additions.length
          ? `Added ${additions.length} of ${anchors.length} must-play songs. Radio will fill the rest of the queue.`
          : 'Radio is keeping the queue stocked.');
      } else {
        session.misses += 1;
        session.retryAt = Date.now() + Math.min(60000, 5000 * 2 ** session.misses);
        setRadioStatus(anchors.length ? 'No playable matches for those must-play songs. Searching your vibe next.'
          : 'No new matches yet. Radio will try another search.');
      }
    } catch {
      if (!controller.signal.aborted && radioSession.current === session) {
        session.retryAt = Date.now() + 10000;
        setRadioStatus('YouTube search is slow. Radio will try again.');
      }
    } finally {
      if (session.request === controller) session.request = null;
    }
  });

  useEffect(() => {
    if (!radio) return;
    const initial = setTimeout(maintainRadio, 0);
    const timer = setInterval(maintainRadio, 4000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [radio, radioUpcoming, activeId]);

  async function submitPrompt(event) {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || building) return;

    const videoId = extractVideoId(value);
    if (videoId) {
      if (tracks.some((track) => track.videoId === videoId)) {
        setNotice('That video is already in your queue.');
        return;
      }
      const startTime = extractStartTime(value);
      setTracks((queue) => [...queue, { videoId, title: 'YouTube video', author: videoId, duration: 0, phase: 'Added by you', startTime }]);
      setPrompt('');
      setNotice('Video added to your queue.');
      return;
    }

    if (/^https?:\/\//i.test(value)) {
      setNotice('Paste a link to an individual YouTube video, or describe the set you want.');
      return;
    }

    endRadio();
    const controller = new AbortController();
    request.current = controller;
    const draft = planSet(value);
    setBuilding(true);
    setNotice('Finding individual songs and checking playback…');

    try {
      const results = await findSetTracks(draft, AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      if (controller.signal.aborted) return;
      if (!results.length) {
        setNotice('No playable songs found for this brief. Try adding a genre, language, or artist.');
        return;
      }
      setBrief(value);
      setPlan(draft);
      // Keep the current track in place when a new set is prepared mid-playback.
      const active = selectedTrack.current;
      const incoming = activeMix.current?.incoming.track;
      const available = results.filter((track) => !unavailable.has(track.videoId)
        && track.videoId !== active?.videoId && track.videoId !== incoming?.videoId);
      setTracks([active, incoming, ...available].filter(Boolean));
      setPrompt('');
      setNotice(available.length
        ? `${available.length} ${available.length === 1 ? 'song' : 'songs'} added to your set.`
        : 'No new playable songs found. Try adding a genre, language, or artist.');
    } catch {
      if (!controller.signal.aborted) setNotice('YouTube search timed out. Try again or paste a video link.');
    } finally {
      if (!controller.signal.aborted) setBuilding(false);
    }
  }

  function selectTrack(track) {
    if (!track) return;
    if (activeMix.current?.incoming.track.videoId === track.videoId) return;
    if (track.videoId === activeId) {
      cancelMix();
      if (!selection.pending) resumePlayback();
      return;
    }
    const outgoing = players.current[activeDeck];
    const incoming = players.current[standbyDeck];
    if (!handoff.current && outgoing?.getPlayerState() === 1) {
      if (incoming) startMix(track, outgoing, incoming);
      else setPlayerNotice('The second player is still loading. Select the song again in a moment.');
      return;
    }
    void startPlayback(track);
  }

  const recoverStalledRadio = useEffectEvent((stalled) => {
    if (!radioSession.current || !autoAdvance || loadedSelection.current !== stalled) return false;
    setUnavailable((ids) => new Set(ids).add(stalled.track.videoId));
    setNotice(`Skipped “${stalled.track.title}” after waiting for YouTube.`);
    finishTrack();
    return true;
  });

  useEffect(() => {
    if (!isReady || !selection || selection.pending || loadedSelection.current === selection) return;
    loadedSelection.current = selection;
    const player = players.current[selection.deck];
    cancelVolumeFade(player);
    playSelection(player, selection, loadVideo);
    if (!selection.automatic) return;

    autoStartTimer.current = setTimeout(() => {
      if (loadedSelection.current !== selection || activeMix.current || handoff.current || player.getPlayerState() === 1) return;
      if (player.getPlayerState() === 3 && player.getVideoLoadedFraction() > 0) {
        setPlayerNotice('YouTube is still buffering the next song.');
      } else {
        setPlayerNotice('Retrying the next song…');
        loadVideo(selection.track.videoId, videoOptions(selection));
      }
      autoStartTimer.current = setTimeout(() => {
        if (loadedSelection.current === selection && !activeMix.current && !handoff.current && player.getPlayerState() !== 1) {
          if (!recoverStalledRadio(selection)) setPlayerNotice('Still waiting for YouTube. Use Next to skip this song.');
        }
      }, autoStartTimeoutMs);
    }, autoStartTimeoutMs);
    return () => clearTimeout(autoStartTimer.current);
  }, [isReady, selection, playSelection, loadVideo]);

  function resumePlayback() {
    if (finishedSelection.current === selection) setSelection({ ...selection, automatic: false });
    else play();
  }

  function playFullSong() {
    if (!activeCue || loadedSelection.current !== selection) return;
    const resumeAfterCue = finishedSelection.current === selection && playerState === 2;
    const continued = { ...selection, cue: null, startSeconds: 0, automatic: false };
    handoff.current = null;
    cancelMix();
    if (radioSession.current) radioSession.current.continueWhenReady = false;
    if (fadedSelection.current === selection) fadedSelection.current = continued;
    finishedSelection.current = null;
    loadedSelection.current = continued;
    setSelection(continued);
    setPlayerNotice('');
    if (resumeAfterCue) play();
  }

  function saveCueHere() {
    const start = Math.min(Math.floor(currentTime), Math.max(0, Math.ceil(duration) - 1));
    const cue = makeDanceCue(start, duration, 'saved');
    if (!cue) return;
    try {
      localStorage.setItem(`studio:cue:${activeId}`, String(start));
    } catch {
      // The cue can still play when browser storage is unavailable.
    }
    startPlayback(current, { cue });
  }

  function togglePlayback() {
    if (radioSession.current) radioSession.current.continueWhenReady = false;
    if (activeMix.current) {
      if (activeMix.current.automatic) autoMixAttempt.current = null;
      cancelMix();
      if (!playing) return;
    }
    if (!current) selectTrack(next);
    else if (playing) {
      handoff.current = null;
      const player = players.current[activeDeck];
      cancelVolumeFade(player);
      player.setVolume(volumeTarget.current);
      pause();
    }
    else resumePlayback();
  }

  const onPlaybackKey = useEffectEvent((event) => {
    if (event.code !== 'Space' && event.key !== ' ') return;
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, button, a, [contenteditable], [role="button"], [role="slider"]')) return;
    if (document.querySelector('dialog[open]')) return;
    if (current ? !isReady || selection.pending || unavailable.has(activeId) : !next) return;
    event.preventDefault();
    if (!event.repeat) togglePlayback();
  });

  useEffect(() => {
    const handleKeyDown = (event) => onPlaybackKey(event);
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  function toggleAutoAdvance() {
    if (autoAdvance && activeMix.current?.automatic) cancelMix();
    if (!autoAdvance) autoMixAttempt.current = null;
    setAutoAdvance(!autoAdvance);
  }

  function changeVolume(value) {
    volumeTarget.current = value;
    setVolume(value);
    const player = players.current[activeDeck];
    const mix = activeMix.current;
    if (player && !handoff.current && (!mix?.fade || (mix.waitForEnd && !mix.automatic))) {
      cancelVolumeFade(player);
      player.setVolume(value);
    }
    if (mix?.previewing && !mix.fade) mix.incomingPlayer.setVolume(Math.round(value * previewVolumeRatio));
  }

  function addNextTrack(track) {
    const playingId = selectedTrack.current?.videoId;
    const pendingId = activeMix.current?.incoming.track.videoId ?? handoff.current?.track.videoId;
    if (unavailable.has(track.videoId) || track.videoId === playingId || track.videoId === pendingId) return false;

    const requested = {
      ...(tracks.find((item) => item.videoId === track.videoId) ?? track),
      phase: 'Added by you',
      anchor: true,
    };
    if (track.startTime != null) requested.startTime = track.startTime;
    setTracks((queue) => {
      const rest = queue.filter((item) => item.videoId !== requested.videoId);
      const insertAt = rest.findLastIndex((item) => item.videoId === playingId || item.videoId === pendingId) + 1;
      return [...rest.slice(0, insertAt), requested, ...rest.slice(insertAt)];
    });
    const session = radioSession.current;
    if (session?.continueWhenReady && autoAdvance && !pendingId) {
      session.continueWhenReady = false;
      void startPlayback(requested, { atEnd: true });
    }
    return true;
  }

  function moveTrack(videoId, offset) {
    const playingId = selectedTrack.current?.videoId;
    const pendingId = activeMix.current?.incoming.track.videoId ?? handoff.current?.track.videoId;
    setTracks((queue) => {
      const position = queue.findIndex((track) => track.videoId === videoId);
      const target = position + offset;
      const boundary = queue.findLastIndex((track) => track.videoId === playingId || track.videoId === pendingId);
      if (position <= boundary || target <= boundary || target >= queue.length) return queue;
      const reordered = [...queue];
      [reordered[target], reordered[position]] = [reordered[position], reordered[target]];
      return reordered;
    });
  }

  function steerRadio(direction) {
    if (!radio) return;
    const update = direction === 'Punjabi'
      ? { languages: [...new Set(['Punjabi', ...radio.languages])], priority: 'Punjabi', query: undefined }
      : { energy: direction };
    activateRadio({ ...radio, ...update, steered: true, arc: null }, true);
  }

  return (
    <>
      <main ref={main} className={`${styles.main} ${styles.youtubeMain}`} data-on-air={current ? true : undefined} data-player-only={playerOnly || undefined}>
        {!current && (
          <section className={styles.hero} aria-labelledby="studio-heading">
            <div className={styles.heroCopy}>
              <span className={styles.heroTag}>Set Studio / Session setup</span>
              <h1 id="studio-heading">Set the <em>vibe.</em></h1>
              <p>Pick a sound for the room. Your DJ finds the tracks, cues the next one, and keeps the set moving.</p>
              <button type="button" className={`${styles.build} ${styles.radioLaunch}`} aria-haspopup="dialog" onClick={() => setVibeSetup('start')}>Set up Vibe Radio <Icon name="arrow" size={20} /></button>
            </div>
            <div className={styles.readyPanel}>
              <span className={styles.readyTag}><Icon name="spark" size={16} /> AI DJ</span>
              <div role="status">
                <strong>{building || radio ? 'Finding tracks' : tracks.length ? 'Set ready' : 'Ready to cue'}</strong>
                <p>{radio ? radioStatus : building ? 'I’m checking songs for your brief.' : tracks.length ? 'Pick a track from the queue to go on air.' : 'Give me a mood, a genre, or a YouTube link to get started.'}</p>
              </div>
              <div className={styles.readySignal} aria-hidden="true" />
            </div>
          </section>
        )}

        {vibeSetup && (
          <VibeSetup key={vibeSetup} editing={vibeSetup === 'edit'}
            initial={vibeSetup === 'edit' ? radio ?? radioFromBrief(brief) : defaultRadio}
            onApply={(config) => activateRadio(vibeSetup === 'edit' ? { ...config, steered: true, arc: null } : config, vibeSetup === 'edit')}
            onClose={() => setVibeSetup(null)} />
        )}

        {addingNext && <AddNextDialog onAdd={addNextTrack} onClose={() => setAddingNext(false)} unavailable={unavailable} lockedIds={[activeId, incomingId]} />}

        <LiveStage
          live={{ track: current, deck: activeDeck, status: activeDeckStatus, position: currentTime, duration, cue: activeCue, playing }}
          upcoming={{ track: mixing?.track ?? next, status: standbyDeckStatus, empty: radio ? 'Finding another song' : 'End of queue', mixing: Boolean(mixing) }}
          vibe={radio ? [...radio.languages, energies[radio.energy][0]].join(' · ') : 'YouTube set'}
          agent={djUpdate({ mixing, next, standbyDeckName, playerNotice, radio, radioStatus, autoAdvance, showMixCue })}
          agentMode={getAgentMode({ mixing, playing, autoAdvance, next, remaining: remainingSeconds, radio })}
          readLevels={readLevels}
          fullscreen={fullscreen}
          playerOnly={playerOnly}
          onToggleStudio={() => setShowStudio((visible) => !visible)}
          volume={volume}
          onToggleFullscreen={onToggleFullscreen}
          controls={{
            canPlay: Boolean(current && isReady && !selection?.pending && !unavailable.has(activeId)),
            canGoBack: Boolean(previous),
            canMix: Boolean(next && !mixing && (!playing || standbyReady)),
            showMixCue: Boolean(showMixCue),
            canPlayFull: Boolean(activeCue && !unavailable.has(activeId) && (playing || playerState === 2)),
            canRemove: Boolean(next && mixing?.track.videoId !== next.videoId),
          }}
          onChangeVibe={() => setVibeSetup('edit')}
          onTogglePlayback={togglePlayback}
          onPrevious={() => selectTrack(previous)}
          onSeek={seekTo}
          onVolumeChange={changeVolume}
          onMixNext={() => selectTrack(next)}
          onAddNext={() => setAddingNext(true)}
          onPlayFull={playFullSong}
          onRemoveNext={() => setTracks((queue) => queue.filter((track) => track.videoId !== next.videoId))}
          onSteer={radio ? steerRadio : null}
        />

        <div className={styles.videoSection} hidden={!current || playerOnly}>
          <div className={styles.videoHeading}>
            <h2>Track details</h2>
            {current && <a href={`https://www.youtube.com/watch?v=${current.videoId}`} target="_blank" rel="noreferrer">Open on YouTube <Icon name="diagonal" size={13} /></a>}
          </div>
          {selection && (
            <div className={styles.cueBar}>
              <span className={styles.cueInfo} role="status">
                {selection.pending ? 'Finding a dance cue…'
                  : activeCue ? <><Icon name="bolt" size={15} /><strong>{formatTime(activeCue.start)}–{formatTime(activeCue.end)}</strong> {activeCue.label || cueLabels[activeCue.source]}{activeCue.label ? ' · YouTube chapter' : ''}</>
                    : selection.startSeconds > 0 ? `Starts at ${formatTime(selection.startSeconds)}` : 'Full track'}
              </span>
              <div className={styles.cueActions}>
                {danceMode && duration > 0 && !selection.pending && <button type="button" onClick={saveCueHere}>Set Cue Here</button>}
              </div>
            </div>
          )}
        </div>

        <div id="studio-tools" className={styles.workspace} hidden={playerOnly}>
          <section className={styles.brief} aria-labelledby="brief-heading">
            <div className={styles.sectionHeading}>
              <span className={styles.sectionIcon}><Icon name="spark" size={19} /></span>
              <div><h2 id="brief-heading">Give your DJ a brief</h2><p>Start with a mood, a genre, or a YouTube link.</p></div>
            </div>
            <form className={styles.composer} onSubmit={submitPrompt}>
              <textarea
                ref={composer}
                aria-label="DJ set brief"
                placeholder="Start with deep house, then build into peak-time techno…"
                value={prompt}
                maxLength={300}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') event.currentTarget.form.requestSubmit();
                }}
              />
              <div className={styles.composerFoot}>
                <span><Icon name="youtube" size={17} /> YouTube source</span>
                <button className={styles.build} type="submit" disabled={building || !prompt.trim()}>
                  {building ? 'Finding tracks…' : 'Build my set'} <Icon name="arrow" size={16} />
                </button>
              </div>
            </form>
            <div className={styles.presets} aria-label="Example set briefs">
              {presets.map((preset) => (
                <button type="button" key={preset.label} onClick={() => { setPrompt(preset.prompt); composer.current?.focus(); }}>
                  <Icon name={preset.icon} size={15} /> {preset.label}
                </button>
              ))}
              <button type="button" disabled={building || !prompt.trim() || Boolean(extractVideoId(prompt.trim()))}
                onClick={() => activateRadio(radioFromBrief(prompt.trim()))}>Use brief for Radio</button>
            </div>
            <p className={styles.notice} role="status">{notice}</p>

            {plan.length > 0 && (
              <section className={styles.plan} aria-labelledby="plan-heading">
                <h2 id="plan-heading">Set direction</h2>
                <p>{brief}</p>
                <ol>
                  {plan.map((phase) => <li key={phase.label}><strong>{phase.label}</strong><span>{phase.query}</span></li>)}
                </ol>
              </section>
            )}
          </section>

          <aside className={styles.queue} aria-labelledby="queue-heading">
            <div className={styles.queueHeader}>
              <div className={styles.queueTitle}><Icon name="list" size={20} /><h2 id="queue-heading">Set queue</h2></div>
              <div className={styles.queueActions}>
                <span className={styles.count}>{tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}</span>
                <button type="button" className={`${styles.build} ${styles.queueAddNext}`} onClick={() => setAddingNext(true)}>Add next <Icon name="plus" size={15} /></button>
                {!current && next && <button type="button" className={styles.build} onClick={togglePlayback}><Icon name="play" size={16} /> Play set</button>}
              </div>
            </div>
            {radio && (
              <div className={styles.radioPanel}>
                <p><strong>Vibe Radio</strong><span>{radioUpcoming} up next</span></p>
                <p>{radioBrief(radio)}</p>
                <p role="status">{radioStatus}</p>
                <div className={styles.liveActions}>
                  {!current && <>
                    <button type="button" className={styles.manualLink} aria-haspopup="dialog" onClick={() => setVibeSetup('edit')}>Edit vibe</button>
                    <button type="button" className={styles.manualLink} onClick={() => steerRadio('bangers')}>More energy</button>
                    <button type="button" className={styles.manualLink} onClick={() => steerRadio('cool')}>Wind down</button>
                  </>}
                  <button type="button" className={styles.manualLink} onClick={() => endRadio(true)}>End Radio</button>
                </div>
              </div>
            )}
            {tracks.length ? (
              <ol className={styles.trackList}>
                {tracks.map((track, position) => (
                  <li key={track.videoId} className={track.videoId === activeId ? styles.activeTrack : undefined}>
                    <button type="button" className={styles.trackButton} disabled={unavailable.has(track.videoId)} onClick={() => selectTrack(track)} aria-label={`Play ${track.title}`}>
                      <TrackArtwork track={track} />
                      <span><strong>{track.title}</strong><small>{unavailable.has(track.videoId) ? 'Unavailable here' : track.videoId === activeId ? 'Current' : track.videoId === incomingId ? 'Mixing in' : track.videoId === next?.videoId && !incomingId ? 'Next' : track.phase}{track.duration ? ` · ${formatTime(track.duration)}` : ''}</small></span>
                    </button>
                    {position > reorderBoundary && <>
                      <button type="button" className={styles.iconButton} aria-label={`Move ${track.title} up`} title="Move up" disabled={position <= reorderBoundary + 1} onClick={() => moveTrack(track.videoId, -1)}><Icon name="up" size={17} /></button>
                      <button type="button" className={styles.iconButton} aria-label={`Move ${track.title} down`} title="Move down" disabled={position === tracks.length - 1} onClick={() => moveTrack(track.videoId, 1)}><Icon name="down" size={17} /></button>
                    </>}
                    <button type="button" className={styles.iconButton} aria-label={`Remove ${track.title}`} disabled={track.videoId === activeId || track.videoId === incomingId} onClick={() => setTracks((queue) => queue.filter((item) => item.videoId !== track.videoId))}><Icon name="close" size={15} /></button>
                  </li>
                ))}
              </ol>
            ) : (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}><Icon name="note" size={23} /></span>
                <h3>Your set starts here</h3>
                <p>Build a set and the tracks will appear in playback order.</p>
              </div>
            )}
            <div className={styles.queueFooter}>
              <div><strong>Dance highlights</strong><small>Start new tracks near a hook or drop</small></div>
              <button type="button" className={styles.switch} role="switch" aria-label="Dance highlights" aria-checked={danceMode} onClick={() => setDanceOverride(!danceMode)}><span /></button>
            </div>
            <div className={styles.queueFooter}>
              <div><strong>Auto-advance</strong><small>Crossfade into the next song over the final five seconds</small></div>
              <button type="button" className={styles.switch} role="switch" aria-label="Auto-advance" aria-checked={autoAdvance} onClick={toggleAutoAdvance}><span /></button>
            </div>
          </aside>
        </div>
      </main>

    </>
  );
}
