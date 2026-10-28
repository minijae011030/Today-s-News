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
 * 폰 전용 하단 탭바 (NYT 앱 스타일)
 * - 흰 바 + 옅은 윗선, 아이콘 아래 작은 이름
 * - 지금 탭은 검정·굵게, 위에 짧은 검정 막대가 탭 사이를 미끄러지듯 이동
 *   (탭바는 페이지가 바뀌어도 그대로 있어서 애니메이션이 이어짐)
 */
export function BottomNav({ current }: { current: Tab }) {
  const index = TABS.findIndex((t) => t.key === current);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:hidden"
    >
      <ul className="relative grid grid-cols-3">
        {/* 미끄러지는 막대: 탭 한 칸 너비의 상자 가운데에 짧은 선 */}
        <span
          aria-hidden
          className="absolute -top-px left-0 flex w-1/3 justify-center transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(${index * 100}%)` }}
        >
          <span className="h-[2.5px] w-8 bg-ink" />
        </span>
        {TABS.map((t) => {
          const active = t.key === current;
          return (
            <li key={t.key}>
              <a
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[0.66rem] tracking-tight transition-colors duration-200 [&_svg]:size-[1.4rem] ${
                  active ? "font-bold text-ink [&_svg]:stroke-2" : "text-muted [&_svg]:stroke-[1.5]"
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
