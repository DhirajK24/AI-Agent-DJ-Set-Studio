'use client';

import { useEffect, useEffectEvent, useRef, useState, useCallback } from 'react';

let apiRequest;

/**
 * Load the YouTube IFrame API script globally (once)
 */
function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve();
  apiRequest ??= new Promise((resolve, reject) => {
    const tag = document.createElement('script');
    const timeout = setTimeout(fail, 12000);
    function fail() {
      clearTimeout(timeout);
      tag.remove();
      apiRequest = undefined;
      reject(new Error('The YouTube player could not connect.'));
    }
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      resolve();
    };
    tag.onerror = fail;
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return apiRequest;
}

/**
 * Custom hook to manage a YouTube IFrame Player instance
 * 
 * @param {string} containerId - DOM element ID for the player
 * @param {object} options - Configuration options
 * @returns {object} - Player state and controls
 */
export function useYouTubePlayer(containerId, options = {}) {
  const playerRef = useRef(null);
  const intervalRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [playerState, setPlayerState] = useState(-1); // YT.PlayerState
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(100);

  const { enabled = true, controls = false } = options;
  const reportReady = useEffectEvent((event) => options.onReady?.(event));
  const reportState = useEffectEvent((state, player) => options.onStateChange?.(state, player));
  const reportProgress = useEffectEvent((time, player) => options.onProgress?.(time, player));
  const reportError = useEffectEvent((error) => options.onError?.(error));
  const reportBlocked = useEffectEvent(() => options.onAutoplayBlocked?.());

  // Initialize player
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    const init = async () => {
      try {
        await loadYouTubeAPI();
      } catch (error) {
        if (mounted) reportError(error);
        return;
      }
      if (!mounted) return;

      const container = document.getElementById(containerId);
      if (!container) return;
      const mount = document.createElement('div');
      container.appendChild(mount);

      playerRef.current = new window.YT.Player(mount, {
        height: '100%',
        width: '100%',
        playerVars: {
          enablejsapi: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          controls: Number(controls),
          disablekb: Number(!controls),
          fs: Number(controls),
          iv_load_policy: 3,
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (mounted) {
              setIsReady(true);
              reportReady(event);
            }
          },
          onStateChange: (event) => {
            if (mounted) {
              setPlayerState(event.data);
              reportState(event.data, event.target);
            }
          },
          onError: (event) => {
            if (mounted) reportError(event.data);
          },
          onAutoplayBlocked: () => {
            if (mounted) reportBlocked();
          },
        },
      });
    };

    init();

    return () => {
      mounted = false;
      playerRef.current?.destroy?.();
      playerRef.current = null;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [containerId, controls, enabled]);

  // Poll current time while playing
  useEffect(() => {
    if (playerState === 1) {
      // YT.PlayerState.PLAYING
      intervalRef.current = setInterval(() => {
        const player = playerRef.current;
        if (player?.getPlayerState?.() === 1) {
          const time = player.getCurrentTime();
          setCurrentTime(time);
          setDuration(player.getDuration() || 0);
          reportProgress(time, player);
        }
      }, 100); // 10fps update
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playerState]);

  // Player controls
  const loadVideo = useCallback((videoId, { startSeconds = 0, endSeconds } = {}) => {
    if (playerRef.current?.loadVideoById) {
      setPlayerState(-1);
      setCurrentTime(startSeconds);
      setDuration(0);
      playerRef.current.loadVideoById({ videoId, startSeconds, endSeconds });
    }
  }, []);

  const cueVideo = useCallback((videoId) => {
    if (playerRef.current?.cueVideoById) {
      playerRef.current.cueVideoById(videoId);
    }
  }, []);

  const play = useCallback(() => {
    playerRef.current?.playVideo?.();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo?.();
  }, []);

  const stop = useCallback(() => {
    playerRef.current?.stopVideo?.();
  }, []);

  const seekTo = useCallback((seconds, allowSeekAhead = true) => {
    playerRef.current?.seekTo?.(seconds, allowSeekAhead);
    setCurrentTime(seconds);
  }, []);

  const setVolume = useCallback((vol) => {
    const clamped = Math.max(0, Math.min(100, Math.round(vol)));
    playerRef.current?.setVolume?.(clamped);
    setVolumeState(clamped);
  }, []);

  const setPlaybackRate = useCallback((rate) => {
    playerRef.current?.setPlaybackRate?.(rate);
  }, []);

  const getPlaybackRate = useCallback(() => {
    return playerRef.current?.getPlaybackRate?.() || 1;
  }, []);

  const mute = useCallback(() => {
    playerRef.current?.mute?.();
  }, []);

  const unmute = useCallback(() => {
    playerRef.current?.unMute?.();
  }, []);

  return {
    isReady,
    playerState,
    currentTime,
    duration,
    volume,
    loadVideo,
    cueVideo,
    play,
    pause,
    stop,
    seekTo,
    setVolume,
    setPlaybackRate,
    getPlaybackRate,
    mute,
    unmute,
  };
}
