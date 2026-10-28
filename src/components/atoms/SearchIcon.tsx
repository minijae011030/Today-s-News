import { Search } from "lucide-react";

export function SearchIcon({ className = "size-5" }: { className?: string }) {
  return <Search aria-hidden className={className} strokeWidth={2} absoluteStrokeWidth={false} />;
}
