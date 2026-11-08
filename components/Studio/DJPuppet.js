'use client';

import { useEffect, useRef } from 'react';
import styles from './liveStage.module.css';

export default function DJPuppet({ playing, levels }) {
  const wrapper = useRef(null);
  const canvas = useRef(null);
  const playback = useRef({ playing, levels });
  const wake = useRef(null);

  useEffect(() => {
    playback.current = { playing, levels };
    wake.current?.();
  }, [playing, levels]);

  useEffect(() => {
    const element = wrapper.current;
    const surface = canvas.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let scene;
    let frame = 0;
    let visible = false;
    let stopped = false;

    function draw(time) {
      frame = 0;
      if (!scene || !visible || document.hidden) return;
      scene.render(time, playback.current, motion.matches);
      element.dataset.renderer = 'webgl';
      if (playback.current.playing && !motion.matches) schedule();
    }

    function schedule() {
      if (!frame && scene && visible && !document.hidden) frame = requestAnimationFrame(draw);
    }

    function resize() {
      const { clientWidth, clientHeight } = element;
      if (scene && clientWidth && clientHeight) scene.resize(clientWidth, clientHeight);
      schedule();
    }

    function showFallback() {
      cancelAnimationFrame(frame);
      frame = 0;
      scene?.dispose();
      scene = undefined;
      delete element.dataset.renderer;
    }

    wake.current = schedule;
    const size = new ResizeObserver(resize);
    size.observe(element);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    });
    intersection.observe(element);
    motion.addEventListener('change', schedule);
    document.addEventListener('visibilitychange', schedule);
    surface.addEventListener('webglcontextlost', showFallback);

    import('./puppetScene').then(({ createPuppetScene }) => {
      if (stopped) return;
      scene = createPuppetScene(surface);
      resize();
    }).catch(showFallback);

    return () => {
      stopped = true;
      wake.current = null;
      size.disconnect();
      intersection.disconnect();
      motion.removeEventListener('change', schedule);
      document.removeEventListener('visibilitychange', schedule);
      surface.removeEventListener('webglcontextlost', showFallback);
      showFallback();
    };
  }, []);

  return (
    <div className={styles.puppet} ref={wrapper} data-grooving={playing && levels.some(Boolean)} role="img" aria-label="AI DJ mascot">
      <canvas ref={canvas} aria-hidden="true" />
      <svg className={styles.puppetFallback} viewBox="0 0 160 132" aria-hidden="true">
        <ellipse cx="80" cy="121" rx="58" ry="8" fill="#100d0c" />
        <g className={styles.puppetPose}>
          <path d="M57 91 46 66 34 58M111 92 119 103" fill="none" stroke="#ea632e" strokeWidth="12" strokeLinecap="round" />
          <path d="M34 59 29 52M34 58 34 49" stroke="#ffb784" strokeWidth="4" strokeLinecap="round" />
          <rect x="54" y="74" width="58" height="35" rx="14" fill="#ea632e" />
          <ellipse cx="83" cy="55" rx="32" ry="29" fill="#ffb784" />
          <path d="M50 57V44a33 33 0 0 1 66 0v13" fill="none" stroke="#e6d9d4" strokeWidth="6" />
          <rect x="45" y="45" width="13" height="27" rx="6" fill="#bab0ba" />
          <rect x="109" y="45" width="13" height="27" rx="6" fill="#e6d9d4" />
          <path d="M54 44a29 26 0 0 1 58 0Z" fill="#ff7738" />
          <path d="M54 43q24-6 58 1l-4 6q-35-6-54-1Z" fill="#ff9e54" />
          <rect x="56" y="49" width="55" height="24" rx="11" fill="#b5f974" />
          <rect x="60" y="53" width="47" height="16" rx="8" fill="#211d29" />
          <path d="M70 60v3m7-5v7m7-9v11m7-9v7m7-5v3" stroke="#b5f974" strokeWidth="2" strokeLinecap="round" />
        </g>
        <path d="M25 103h110l-9 17H34Z" fill="#302a38" />
        <rect x="22" y="93" width="116" height="15" rx="7" fill="#625a69" />
        <ellipse cx="51" cy="99" rx="15" ry="5" fill="#bf83f9" />
        <ellipse cx="109" cy="99" rx="15" ry="5" fill="#b5f974" />
        <path d="M74 99h12m-9 14h6" stroke="#ff9062" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}
