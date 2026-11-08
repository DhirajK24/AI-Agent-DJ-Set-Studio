'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { MixerProvider, useMixer } from '@/context/MixerContext';
import Deck from '@/components/Deck/Deck';
import MixerPanel from '@/components/Mixer/MixerPanel';
import EffectsPanel from '@/components/Effects/EffectsPanel';
import Playlist from '@/components/Playlist/Playlist';

function DJMixerApp() {
  const { state, dispatch } = useMixer();

  // Crossfader
  const handleCrossfaderChange = useCallback((value) => {
    dispatch({ type: 'SET_CROSSFADER', payload: value });
    // Volume changes are applied via the deck's YouTube player
    // We'll let each deck handle its own volume based on crossfader position
  }, [dispatch]);

  // EQ
  const handleEQChange = useCallback((deck, band, value) => {
    dispatch({ type: 'SET_EQ', payload: { deck, band, value } });
  }, [dispatch]);

  // Volume
  const handleVolumeChange = useCallback((deck, volume) => {
    dispatch({ type: 'SET_VOLUME', payload: { deck, volume } });
  }, [dispatch]);

  // Master Volume
  const handleMasterVolumeChange = useCallback((e) => {
    dispatch({ type: 'SET_MASTER_VOLUME', payload: parseInt(e.target.value) });
  }, [dispatch]);

  // Effects
  const handleToggleEffect = useCallback((deck, effect) => {
    const currentActive = state[deck].effects[effect];
    dispatch({
      type: 'SET_EFFECT',
      payload: { deck, effect, active: !currentActive },
    });
  }, [state, dispatch]);

  // Playlist actions
  const handlePlaylistLoad = useCallback((deckId, index) => {
    dispatch({ type: 'LOAD_FROM_PLAYLIST', payload: { deck: deckId, index } });
  }, [dispatch]);

  const handlePlaylistRemove = useCallback((deckId, index) => {
    dispatch({ type: 'REMOVE_FROM_PLAYLIST', payload: { deck: deckId, index } });
  }, [dispatch]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <span className="app-logo-icon">💿</span>
          <h1>YOUTUBE DJ</h1>
        </div>
        <div className="header-controls"><Link href="/">Set Studio</Link>
          <div className="master-volume">
            <span className="master-volume-label">Master</span>
            <input
              type="range"
              min="0"
              max="100"
              value={state.masterVolume}
              onChange={handleMasterVolumeChange}
            />
            <span>{state.masterVolume}%</span>
          </div>
        </div>
      </header>

      {/* Main Decks + Mixer */}
      <div className="decks-container">
        <Deck deckId="deckA" accentColor="cyan" />
        
        <MixerPanel
          deckA={state.deckA}
          deckB={state.deckB}
          crossfader={state.crossfader}
          onCrossfaderChange={handleCrossfaderChange}
          onEQChange={handleEQChange}
          onVolumeChange={handleVolumeChange}
        />
        
        <Deck deckId="deckB" accentColor="magenta" />
      </div>

      {/* Effects */}
      <EffectsPanel
        deckAEffects={state.deckA.effects}
        deckBEffects={state.deckB.effects}
        onToggleEffect={handleToggleEffect}
      />

      {/* Playlists */}
      <div className="bottom-section">
        <Playlist
          deckId="deckA"
          accentColor="cyan"
          items={state.deckA.playlist}
          currentVideoId={state.deckA.videoId}
          onLoad={(index) => handlePlaylistLoad('deckA', index)}
          onRemove={(index) => handlePlaylistRemove('deckA', index)}
        />
        <Playlist
          deckId="deckB"
          accentColor="magenta"
          items={state.deckB.playlist}
          currentVideoId={state.deckB.videoId}
          onLoad={(index) => handlePlaylistLoad('deckB', index)}
          onRemove={(index) => handlePlaylistRemove('deckB', index)}
        />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <MixerProvider>
      <DJMixerApp />
    </MixerProvider>
  );
}

