export function SearchIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className={className}>
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="m15.8 15.8 5.2 5.2" strokeLinecap="round" />
    </svg>
  );
}
