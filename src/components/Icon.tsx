export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    arrow: (
      <>
        <path d="M7 17 17 7M7 7h10v10" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    check: <path d="m5 12 4 4L19 6" />,
    edit: (
      <>
        <path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7" />
      </>
    ),
    full: <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" />,
    settings: (
      <>
        <path d="M4 7h16M4 17h16M8 4v6M16 14v6" />
      </>
    ),
    spotify: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M6 9q6-3 12 0M7 12q5-2 10 0M8 15q4-2 8 0" />
      </>
    ),
    cameras: (
      <>
        <rect x="3" y="6" width="13" height="12" rx="1" />
        <path d="m16 10 5-3v10l-5-3" />
      </>
    ),
    'local-ai': (
      <>
        <path d="m4 6 6 6-6 6M13 18h7" />
      </>
    ),
    maps: (
      <>
        <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16" />
      </>
    ),
    back: <path d="m11 5-7 7 7 7M4 12h16" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      {paths[name] ?? paths.arrow}
    </svg>
  );
}
