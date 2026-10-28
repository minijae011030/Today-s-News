import type { ReactNode } from "react";

export function NavLink({
  href,
  current,
  children,
  className = "",
  after,
}: {
  href: string;
  current: boolean;
  children: ReactNode;
  className?: string;
  after?: ReactNode; // 링크 뒤에 붙일 장식 (예: 흐림 그라데이션)
}) {
  return (
    <li className={`shrink-0 ${className}`}>
      <a
        href={href}
        aria-current={current ? "page" : undefined}
        className={`pb-0.5 ${current ? "font-semibold border-b-2 border-ink" : "text-ink-soft hover:text-ink"}`}
      >
        {children}
      </a>
      {after}
    </li>
  );
}
