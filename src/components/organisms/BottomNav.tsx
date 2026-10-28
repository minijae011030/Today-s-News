import { BookA, Newspaper, Search } from "lucide-react";
import type { ReactNode } from "react";
import { href } from "../../lib/route";

/**
 * 폰 전용 하단 탭바: 화면 아래 떠 있는 알약 모양
 * - 지금 탭: 검정 캡슐 안에 아이콘 + 이름 (흑백 화면에서도 확실히 구분)
 * - 나머지: 아이콘만, 가늘게
 */
export function BottomNav({ current }: { current: "front" | "search" | "glossary" | null }) {
  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-6 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:hidden"
    >
      <ul className="pointer-events-auto mx-auto flex max-w-72 items-center gap-1 rounded-full border border-ink/10 bg-paper/80 p-1.5 shadow-[0_10px_30px_-6px_rgb(0_0_0/0.25)] backdrop-blur-xl">
        <Tab href={href.front} label="1면" active={current === "front"} icon={<Newspaper />} />
        <Tab href={href.search()} label="검색" active={current === "search"} icon={<Search />} />
        <Tab href={href.glossary()} label="용어 사전" active={current === "glossary"} icon={<BookA />} />
      </ul>
    </nav>
  );
}

function Tab({ href, label, active, icon }: { href: string; label: string; active: boolean; icon: ReactNode }) {
  return (
    <li className={active ? "flex-[1.6]" : "flex-1"}>
      <a
        href={href}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={`flex h-11 items-center justify-center gap-1.5 rounded-full text-[0.8rem] font-semibold tracking-tight transition-colors duration-200 [&_svg]:size-[1.15rem] ${
          active ? "bg-ink text-paper [&_svg]:stroke-[2.2]" : "text-ink-soft active:bg-ink/5 [&_svg]:stroke-[1.6]"
        }`}
      >
        {icon}
        {active && <span className="whitespace-nowrap">{label}</span>}
      </a>
    </li>
  );
}
