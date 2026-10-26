import type { ReactNode } from "react";

export function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: ReactNode;
}) {
  return (
    <li className="shrink-0">
      <a
        href={href}
        aria-current={current ? "page" : undefined}
        className={`pb-0.5 ${current ? "font-semibold border-b-2 border-ink" : "text-ink-soft hover:text-ink"}`}
      >
        {children}
      </a>
    </li>
  );
}
