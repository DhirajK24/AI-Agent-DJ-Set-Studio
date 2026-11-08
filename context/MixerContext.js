'use client';

import { createContext, useContext, useReducer, useCallback } from 'react';

const MixerContext = createContext(null);

const initialDeckState = {
  videoId: null,
  title: '',
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 100,
  playbackRate: 1,
  bpm: null,
  cuePoint: 0,
  loopIn: null,
  loopOut: null,
  loopActive: false,
  hotCues: [null, null, null, null],
  eq: { hi: 0, mid: 0, low: 0 },
  playlist: [],
  effects: {
    echo: false,
    reverb: false,
    flanger: false,
    filter: false,
  },
};

const initialState = {
  deckA: { ...initialDeckState },
  deckB: { ...initialDeckState },
  crossfader: 0.5, // 0 = full A, 0.5 = center, 1 = full B
  masterVolume: 100,
};

function mixerReducer(state, action) {
  const { type, payload } = action;

  switch (type) {
    case 'SET_VIDEO': {
      const { deck, videoId, title } = payload;
      return {
        ...state,
        [deck]: {
          ...state[deck],
          videoId,
          title: title || '',
          currentTime: 0,
          cuePoint: 0,
          loopIn: null,
          loopOut: null,
          loopActive: false,
          hotCues: [null, null, null, null],
        },
      };
    }
    case 'SET_PLAYING': {
      const { deck, isPlaying } = payload;
      return {
        ...state,
        [deck]: { ...state[deck], isPlaying },
      };
    }
    case 'SET_TIME': {
      const { deck, currentTime, duration } = payload;
      return {
        ...state,
        [deck]: {
          ...state[deck],
          currentTime: currentTime ?? state[deck].currentTime,
          duration: duration ?? state[deck].duration,
        },
      };
    }
    case 'SET_VOLUME': {
      const { deck, volume } = payload;
      return {
        ...state,
        [deck]: { ...state[deck], volume },
      };
    }
    case 'SET_PLAYBACK_RATE': {
      const { deck, playbackRate } = payload;
      return {
        ...state,
        [deck]: { ...state[deck], playbackRate },
      };
    }
    case 'SET_BPM': {
      const { deck, bpm } = payload;
      return {
        ...state,
        [deck]: { ...state[deck], bpm },
      };
    }
    case 'SET_CUE': {
      const { deck, cuePoint } = payload;
      return {
        ...state,
        [deck]: { ...state[deck], cuePoint },
      };
    }
    case 'SET_LOOP': {
      const { deck, loopIn, loopOut, loopActive } = payload;
      return {
        ...state,
        [deck]: {
          ...state[deck],
          loopIn: loopIn !== undefined ? loopIn : state[deck].loopIn,
          loopOut: loopOut !== undefined ? loopOut : state[deck].loopOut,
          loopActive: loopActive !== undefined ? loopActive : state[deck].loopActive,
        },
      };
    }
    case 'SET_HOT_CUE': {
      const { deck, index, time } = payload;
      const newHotCues = [...state[deck].hotCues];
      newHotCues[index] = time;
      return {
        ...state,
        [deck]: { ...state[deck], hotCues: newHotCues },
      };
    }
    case 'SET_EQ': {
      const { deck, band, value } = payload;
      return {
        ...state,
        [deck]: {
          ...state[deck],
          eq: { ...state[deck].eq, [band]: value },
        },
      };
    }
    case 'SET_EFFECT': {
      const { deck, effect, active } = payload;
      return {
        ...state,
        [deck]: {
          ...state[deck],
          effects: { ...state[deck].effects, [effect]: active },
        },
      };
    }
    case 'SET_CROSSFADER': {
      return { ...state, crossfader: payload };
    }
    case 'SET_MASTER_VOLUME': {
      return { ...state, masterVolume: payload };
    }
    case 'ADD_TO_PLAYLIST': {
      const { deck, video } = payload;
      return {
        ...state,
        [deck]: {
          ...state[deck],
          playlist: [...state[deck].playlist, video],
        },
      };
    }
    case 'REMOVE_FROM_PLAYLIST': {
      const { deck, index } = payload;
      const newPlaylist = [...state[deck].playlist];
      newPlaylist.splice(index, 1);
      return {
        ...state,
        [deck]: { ...state[deck], playlist: newPlaylist },
      };
    }
    case 'LOAD_FROM_PLAYLIST': {
      const { deck, index } = payload;
      const video = state[deck].playlist[index];
      if (!video) return state;
      return {
        ...state,
        [deck]: {
          ...state[deck],
          videoId: video.videoId,
          title: video.title,
          currentTime: 0,
          cuePoint: 0,
          loopIn: null,
          loopOut: null,
          loopActive: false,
        },
      };
    }
    default:
      return state;
  }
}

export function MixerProvider({ children }) {
  const [state, dispatch] = useReducer(mixerReducer, initialState);

  return (
    <MixerContext.Provider value={{ state, dispatch }}>
      {children}
    </MixerContext.Provider>
  );
}

export function useMixer() {
  const context = useContext(MixerContext);
  if (!context) {
    throw new Error('useMixer must be used within a MixerProvider');
  }
  return context;
}

export default MixerContext;
