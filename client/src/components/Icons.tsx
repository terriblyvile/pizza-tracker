/** Inline icons, sized in em so they scale with the text-size setting. */

const base = {
  width: '1.05em',
  height: '1.05em',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function GlobeIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
    </svg>
  );
}

export function PhoneIcon() {
  return (
    <svg {...base}>
      <path d="M6.6 3h-2A1.6 1.6 0 0 0 3 4.7C3 13.1 10.9 21 19.3 21a1.6 1.6 0 0 0 1.7-1.6v-2a1.6 1.6 0 0 0-1.3-1.6l-2.6-.5a1.6 1.6 0 0 0-1.6.7l-.7 1a13 13 0 0 1-5.3-5.3l1-.7a1.6 1.6 0 0 0 .7-1.6l-.5-2.6A1.6 1.6 0 0 0 6.6 3Z" />
    </svg>
  );
}

export function MapPinIcon() {
  return (
    <svg {...base}>
      <path d="M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="2.8" />
    </svg>
  );
}
