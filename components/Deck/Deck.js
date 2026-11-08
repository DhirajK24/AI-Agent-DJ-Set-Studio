'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { useBPM } from '@/hooks/useBPM';
import { useMixer } from '@/context/MixerContext';
import { calculateSyncRate, equalPowerCrossfade, applyEQToVolume } from '@/utils/audio';
import { useAudioEffects } from '@/hooks/useAudioEffects';
import SearchBar from './SearchBar';
import WaveformViz from './WaveformViz';
import DeckControls from './DeckControls';
import './Deck.css';

/**
 * Full Deck component — combines player, search, waveform, and controls
 */
export default function Deck({ deckId, accentColor = 'cyan' }) {
  const { state, dispatch } = useMixer();
  const deck = state[deckId];
  const otherDeckId = deckId === 'deckA' ? 'deckB' : 'deckA';
  const otherDeck = state[otherDeckId];
  const playerId = `yt-player-${deckId}`;
  const loopCheckRef = useRef(null);

  const { bpm, tap: bpmTap, setManualBpm } = useBPM();

  const {
    isReady,
    playerState,
    currentTime,
    duration,
    loadVideo,
    play,
    pause,
    seekTo,
    setVolume,
    setPlaybackRate,
  } = useYouTubePlayer(playerId, {
    onStateChange: (state) => {
      // YT.PlayerState: -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
      dispatch({
        type: 'SET_PLAYING',
        payload: { deck: deckId, isPlaying: state === 1 },
      });
    },
  });

  // ─── VOLUME, CROSSFADER & EFFECTS ───
  // state.crossfader is 0.0 to 1.0
  const crossfadeVol = equalPowerCrossfade(state.crossfader);
  const deckCrossfadeVol = deckId === 'deckA' ? crossfadeVol.volA : crossfadeVol.volB;
  const eqVol = applyEQToVolume(deck.volume, deck.eq);
  const baseVolume = (eqVol * deckCrossfadeVol * state.masterVolume) / 10000;

  useAudioEffects({
    isPlaying: deck.isPlaying,
    effects: deck.effects,
    baseVolume,
    basePlaybackRate: deck.playbackRate,
    setVolume,
    setPlaybackRate,
    playerElementId: playerId,
  });

  // Sync current time to state
  useEffect(() => {
    dispatch({
      type: 'SET_TIME',
      payload: { deck: deckId, currentTime, duration },
    });
  }, [currentTime, duration, deckId, dispatch]);

  // Sync BPM from hook to state
  useEffect(() => {
    if (bpm !== null) {
      dispatch({ type: 'SET_BPM', payload: { deck: deckId, bpm } });
    }
  }, [bpm, deckId, dispatch]);

  // Loop checker
  useEffect(() => {
    if (deck.loopActive && deck.loopIn !== null && deck.loopOut !== null) {
      loopCheckRef.current = setInterval(() => {
        if (currentTime >= deck.loopOut) {
          seekTo(deck.loopIn);
        }
      }, 50);
    } else {
      if (loopCheckRef.current) {
        clearInterval(loopCheckRef.current);
        loopCheckRef.current = null;
      }
    }
    return () => {
      if (loopCheckRef.current) clearInterval(loopCheckRef.current);
    };
  }, [deck.loopActive, deck.loopIn, deck.loopOut, currentTime, seekTo]);

  // Sync video to player when it changes
  useEffect(() => {
    if (isReady && deck.videoId && typeof deck.videoId === 'string' && deck.videoId.length > 5) {
      loadVideo(deck.videoId);
    }
  }, [isReady, deck.videoId, loadVideo]);

  // Handle video selection from search
  const handleVideoSelect = useCallback((video) => {
    if (!video || !video.videoId) return;
    dispatch({
      type: 'SET_VIDEO',
      payload: { deck: deckId, videoId: video.videoId, title: video.title },
    });
  }, [deckId, dispatch]);

  // Add to playlist
  const handleAddToPlaylist = useCallback((video) => {
    dispatch({
      type: 'ADD_TO_PLAYLIST',
      payload: { deck: deckId, video },
    });
  }, [deckId, dispatch]);

  // Playback controls
  const handlePlay = useCallback(() => play(), [play]);
  const handlePause = useCallback(() => pause(), [pause]);

  const handleSeek = useCallback((time) => {
    seekTo(time);
  }, [seekTo]);

  // Cue
  const handleCueSet = useCallback(() => {
    dispatch({ type: 'SET_CUE', payload: { deck: deckId, cuePoint: currentTime } });
  }, [deckId, currentTime, dispatch]);

  const handleCueJump = useCallback(() => {
    seekTo(deck.cuePoint);
  }, [deck.cuePoint, seekTo]);

  // Loop
  const handleLoopIn = useCallback(() => {
    dispatch({ type: 'SET_LOOP', payload: { deck: deckId, loopIn: currentTime } });
  }, [deckId, currentTime, dispatch]);

  const handleLoopOut = useCallback(() => {
    dispatch({ type: 'SET_LOOP', payload: { deck: deckId, loopOut: currentTime } });
  }, [deckId, currentTime, dispatch]);

  const handleLoopToggle = useCallback(() => {
    dispatch({ type: 'SET_LOOP', payload: { deck: deckId, loopActive: !deck.loopActive } });
  }, [deckId, deck.loopActive, dispatch]);

  const handleLoopClear = useCallback(() => {
    dispatch({ type: 'SET_LOOP', payload: { deck: deckId, loopIn: null, loopOut: null, loopActive: false } });
  }, [deckId, dispatch]);

  // Tempo
  const handleTempoChange = useCallback((rate) => {
    setPlaybackRate(rate);
    dispatch({ type: 'SET_PLAYBACK_RATE', payload: { deck: deckId, playbackRate: rate } });
  }, [deckId, dispatch, setPlaybackRate]);

  // BPM
  const handleBPMTap = useCallback(() => {
    bpmTap();
  }, [bpmTap]);

  const handleBPMSet = useCallback((value) => {
    setManualBpm(value);
    dispatch({ type: 'SET_BPM', payload: { deck: deckId, bpm: value } });
  }, [deckId, dispatch, setManualBpm]);

  // Sync
  const handleSync = useCallback(() => {
    if (otherDeck.bpm && deck.bpm) {
      const syncRate = calculateSyncRate(deck.bpm, otherDeck.bpm);
      setPlaybackRate(syncRate);
      dispatch({ type: 'SET_PLAYBACK_RATE', payload: { deck: deckId, playbackRate: syncRate } });
    }
  }, [deck.bpm, otherDeck.bpm, deckId, dispatch, setPlaybackRate]);

  // Hot cues
  const handleHotCueSet = useCallback((index) => {
    dispatch({ type: 'SET_HOT_CUE', payload: { deck: deckId, index, time: currentTime } });
  }, [deckId, currentTime, dispatch]);

  const handleHotCueJump = useCallback((index) => {
    const time = deck.hotCues[index];
    if (time !== null) seekTo(time);
  }, [deck.hotCues, seekTo]);

  const neonColor = accentColor === 'cyan' ? '#00f0ff' : '#ff00e5';
  const dimColor = accentColor === 'cyan' ? '#007a82' : '#80007a';

  return (
    <div className={`deck panel deck-${accentColor === 'cyan' ? 'a' : 'b'}`}>
      {/* Deck Label */}
      <div className="deck-header">
        <span className={`deck-label neon-text-${accentColor}`}>
          {deckId === 'deckA' ? 'DECK A' : 'DECK B'}
        </span>
        <span className="deck-track-title">
          {deck.title || 'No track loaded'}
        </span>
      </div>

      {/* Search */}
      <SearchBar
        deckId={deckId}
        accentColor={accentColor}
        onVideoSelect={handleVideoSelect}
        onAddToPlaylist={handleAddToPlaylist}
      />

      {/* YouTube Player */}
      <div className="deck-player-wrapper">
        <div className={`deck-player-border accent-${accentColor}`}>
          <div id={playerId} className="deck-player" />
        </div>
        {!deck.videoId && (
          <div className="deck-player-placeholder">
            <span className="placeholder-icon">🎵</span>
            <span>Search or paste a YouTube URL to load a track</span>
          </div>
        )}
      </div>

      {/* Waveform */}
      <WaveformViz
        isPlaying={deck.isPlaying}
        currentTime={currentTime}
        duration={duration}
        color={neonColor}
        dimColor={dimColor}
        videoId={deck.videoId}
      />

      {/* Controls */}
      <DeckControls
        deckId={deckId}
        accentColor={accentColor}
        isPlaying={deck.isPlaying}
        currentTime={currentTime}
        duration={duration}
        playbackRate={deck.playbackRate}
        bpm={deck.bpm}
        cuePoint={deck.cuePoint}
        loopIn={deck.loopIn}
        loopOut={deck.loopOut}
        loopActive={deck.loopActive}
        hotCues={deck.hotCues}
        onPlay={handlePlay}
        onPause={handlePause}
        onCueSet={handleCueSet}
        onCueJump={handleCueJump}
        onLoopIn={handleLoopIn}
        onLoopOut={handleLoopOut}
        onLoopToggle={handleLoopToggle}
        onLoopClear={handleLoopClear}
        onTempoChange={handleTempoChange}
        onBPMTap={handleBPMTap}
        onBPMSet={handleBPMSet}
        onSync={handleSync}
        onHotCueSet={handleHotCueSet}
        onHotCueJump={handleHotCueJump}
        onSeek={handleSeek}
      />
    </div>
  );
}
