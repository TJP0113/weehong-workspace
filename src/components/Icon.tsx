const P: Record<string, string> = {
  home: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z',
  board: 'M3 4h5v16H3zM10 4h5v11h-5zM17 4h4v7h-4z',
  ws: 'M5 4h14v17H5zM9 4V3h6v1M9 10h6M9 14h6M9 18h3',
  insp: 'M5 5h14v16H5zM9 3h6v4H9zM9 14l2 2 4-4',
  rent: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M5 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  route: 'M4 19a2 2 0 1 0 4 0 2 2 0 1 0-4 0M16 5a2 2 0 1 0 4 0 2 2 0 1 0-4 0M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8',
  cal: 'M4 5h16v16H4zM4 10h16M9 3v4M15 3v4',
  parts: 'M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
  set: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 7a2 2 0 1 0 4 0 2 2 0 1 0-4 0M8 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  search: 'M5 11a6 6 0 1 0 12 0 6 6 0 1 0-12 0M20 20l-4.5-4.5',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  plus: 'M12 5v14M5 12h14',
  chev: 'M6 9l6 6 6-6',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM8.5 13a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0',
  print: 'M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v7H7z',
  clock: 'M4 12a8 8 0 1 0 16 0 8 8 0 1 0-16 0M12 8v4l3 2',
  sync: 'M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  edit: 'M4 20h4L19 9l-4-4L4 16z',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  mic: 'M9 3h6v11H9zM5 11a7 7 0 0 0 14 0M12 18v3',
  warn: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  wifi: 'M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01M3 3l18 18',
  user: 'M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0',
  lock: 'M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3',
  sound: 'M5 9v6h4l5 4V5L9 9zM17 9a4 4 0 0 1 0 6',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  flag: 'M5 21V4h11l-2 4 2 4H5',
  drag: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
};

export function Icon({ name, size = 16, stroke = 1.8, style }: { name: keyof typeof P | string; size?: number; stroke?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', ...style }}>
      <path d={P[name] || ''} />
    </svg>
  );
}
