export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo" aria-label="NEST">
      <svg className="logo-mark" viewBox="0 0 64 64" role="img" aria-hidden="true">
        <path d="M14 50V17l24 23V17" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 52c7 5 14 7 22 7s15-2 22-7" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <circle cx="48" cy="17" r="7" fill="#FFC24B" stroke="#073B2C" strokeWidth="3" />
      </svg>
      {!compact && <span className="logo-word">NEST</span>}
    </span>
  );
}
