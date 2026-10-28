import { BookSearch, House, Search } from "lucide-react";
import type { ReactNode } from "react";
import { href } from "../../lib/route";

type Tab = "front" | "search" | "glossary";
const TABS: { key: Tab; href: string; label: string; icon: ReactNode }[] = [
  { key: "front", href: href.front, label: "1면", icon: <House /> },
  { key: "search", href: href.search(), label: "검색", icon: <Search /> },
  { key: "glossary", href: href.glossary(), label: "용어 사전", icon: <BookSearch /> },
];

/**
 * 폰 전용 하단 탭바: 화면 아래 떠 있는 알약 모양
 * - 검정 캡슐 하나가 지금 탭으로 미끄러지듯 이동 (탭바는 페이지가 바뀌어도 그대로 있어서 애니메이션이 이어짐)
 * - 아이콘·이름은 제자리에 두고 색만 바뀜 (움직이는 건 캡슐 하나)
 */
export function BottomNav({ current }: { current: Tab }) {
  const index = TABS.findIndex((t) => t.key === current);
  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-6 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:hidden"
    >
      <ul className="pointer-events-auto relative mx-auto grid max-w-80 grid-cols-3 rounded-full border border-ink/10 bg-paper/80 p-1.5 shadow-[0_10px_30px_-6px_rgb(0_0_0/0.25)] backdrop-blur-xl">
        {/* 미끄러지는 캡슐 */}
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-1.5 w-[calc((100%-0.75rem)/3)] rounded-full bg-ink transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(${index * 100}%)` }}
        />
        {TABS.map((t) => {
          const active = t.key === current;
          return (
            <li key={t.key} className="relative">
              <a
                href={t.href}
                aria-label={t.label}
                aria-current={active ? "page" : undefined}
                className={`flex h-11 items-center justify-center gap-1.5 rounded-full text-[0.78rem] font-semibold tracking-tight transition-colors duration-300 [&_svg]:size-[1.15rem] [&_svg]:transition-[stroke-width] ${
                  active ? "text-paper [&_svg]:stroke-[2.2]" : "text-ink-soft [&_svg]:stroke-[1.6]"
                }`}
              >
                {t.icon}
                <span className="whitespace-nowrap">{t.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
