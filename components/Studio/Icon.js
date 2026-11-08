const icons = {
  wave: <><path d="M3 12h2l2-5 3 10 4-14 3 14 2-5h2"/></>,
  sliders: <><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.5" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="2.5" fill="currentColor" stroke="none"/></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
  diagonal: <path d="M6 18 18 6M8 6h10v10"/>,
  expand: <path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4"/>,
  collapse: <path d="M4 8h4V4m12 4h-4V4M8 20v-4H4m12 4v-4h4"/>,
  spark: <><path d="M12 2.5 14.5 9.5 21.5 12l-7 2.5-2.5 7-2.5-7-7-2.5 7-2.5Z"/><path d="M20 2v4m-2-2h4"/></>,
  list: <><path d="M9 6h12M9 12h12M9 18h8M3 6h1m-1 6h1m-1 6h1"/></>,
  note: <><path d="M10 17V5l10-2v12M10 9l10-2"/><ellipse cx="7" cy="17.5" rx="3" ry="2.5"/><ellipse cx="17" cy="15.5" rx="3" ry="2.5"/></>,
  moon: <path d="M20.5 14a8.6 8.6 0 0 1-10.5-10.5A8.7 8.7 0 1 0 20.5 14Z"/>,
  bolt: <path d="m13 2-9 12h7l-1 8 10-12h-8l1-8Z"/>,
  play: <path d="M8 5.5 19 12 8 18.5Z" fill="currentColor" stroke="none"/>,
  pause: <path d="M9 5v14m6-14v14" strokeWidth="3"/>,
  next: <><path d="M5 5.5 16 12 5 18.5Z" fill="currentColor" stroke="none"/><path d="M19 5.5v13"/></>,
  back: <><path d="M19 5.5 8 12l11 6.5Z" fill="currentColor" stroke="none"/><path d="M5 5.5v13"/></>,
  up: <path d="m6 14 6-6 6 6"/>,
  down: <path d="m6 10 6 6 6-6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  volume: <><path d="M4 9v6h4l4 4V5L8 9H4Z"/><path d="M15 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"/></>,
  youtube: <><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="m10 9 5 3-5 3Z" fill="currentColor" stroke="none"/></>,
};

export default function StudioIcon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}
