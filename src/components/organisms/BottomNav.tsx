import { BookSearch, House, Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { href } from "../../lib/route";

type Tab = "front" | "search" | "glossary";
const TABS: { key: Tab; href: string; label: string; icon: ReactNode }[] = [
  { key: "front", href: href.front, label: "1면", icon: <House /> },
  { key: "search", href: href.search(), label: "검색", icon: <Search /> },
  { key: "glossary", href: href.glossary(), label: "용어 사전", icon: <BookSearch /> },
];

/**
 * 폰에서 홈 화면 앱(PWA)으로 열었을 때만 보이는 하단 탭바 (NYT 앱 스타일)
 * - 사파리 같은 브라우저에서는 브라우저 툴바와 겹쳐 어색해서 안 보임 (대신 제호 위 한 줄 링크)
 * - 흰 바 + 옅은 윗선, 아이콘 아래 작은 이름
 * - 지금 탭은 검정·굵게, 위에 짧은 검정 막대가 탭 사이를 미끄러지듯 이동
 *   (탭바는 페이지가 바뀌어도 그대로 있어서 애니메이션이 이어짐)
 */
export function BottomNav({ current }: { current: Tab }) {
  const index = TABS.findIndex((t) => t.key === current);
  const hidden = useHideWhileScrollingDown();
  return (
    <nav
      aria-label="Main"
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper pb-[max(calc(env(safe-area-inset-bottom)-1.25rem),0.25rem)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hidden max-sm:standalone:block ${
        hidden ? "translate-y-full" : "translate-y-0"
      }`}
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
                className={`flex flex-col items-center gap-px pt-[7px] pb-[6px] text-[0.63rem] tracking-tight transition-colors duration-200 [&_svg]:size-[1.4rem] ${
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

/**
 * 아래로 스크롤하는 동안엔 숨기고, 멈추거나(0.4초) 위로 올리면 다시 보여줌
 * 맨 위·맨 아래 근처에서는 항상 보여줌
 */
function useHideWhileScrollingDown(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let idle: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      const y = window.scrollY;
      const nearEdge = y < 80 || window.innerHeight + y > document.documentElement.scrollHeight - 80;
      if (nearEdge || y < last - 4) setHidden(false); // 위로 올리면 바로
      else if (y > last + 4) setHidden(true); // 아래로 내리는 중
      last = y;
      clearTimeout(idle);
      idle = setTimeout(() => setHidden(false), 400); // 멈추면 다시
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(idle);
    };
  }, []);
  return hidden;
}
