import { BookSearch } from "lucide-react";

/** 용어 사전 아이콘: 책 위에 A (사전) */
export function BookIcon({ className = "size-5" }: { className?: string }) {
  return <BookSearch aria-hidden className={className} strokeWidth={2} />;
}
