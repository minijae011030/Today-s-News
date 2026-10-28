import { useEffect, useRef, useState } from "react";
import { SECTIONS } from "../../lib/constants";
import { href } from "../../lib/route";
import { BookIcon } from "../atoms/BookIcon";
import { NavLink } from "../atoms/NavLink";
import { SearchIcon } from "../atoms/SearchIcon";

export function Masthead({
  active,
  isGlossary = false,
}: {
  active?: string;
  isGlossary?: boolean;
}) {
  // 폰에서 메뉴가 넘치면 가로 스크롤: 현재 탭이 보이게 맞추고, 더 있으면 가장자리를 흐리게
  const scroller = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ left: false, right: false });
  const updateFade = () => {
    const el = scroller.current;
    if (!el) return;
    setFade({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    const el = scroller.current;
    const cur = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (el && cur) {
      const c = cur.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      el.scrollTo({ left: el.scrollLeft + c.left - box.left - (el.clientWidth - c.width) / 2 });
    }
    updateFade();
    window.addEventListener("resize", updateFade);
    return () => window.removeEventListener("resize", updateFade);
  }, [active, isGlossary]);

  // 제호의 대문자 가운데에 맞추려고 살짝 아래로 (Playfair는 글자가 줄 가운데보다 약간 아래에 앉음)
  const icon = "inline-flex translate-y-[0.05em] p-1.5 text-ink hover:text-ink-soft sm:p-2";
  const iconSize = "size-6 sm:size-8 lg:size-9";

  return (
    <header id="masthead" className="pt-4">
      {/* 용어 사전 | 제호 | 검색. 아이콘 칸도 제호와 같은 글자 크기로 둬서 em 단위로 높이를 맞춤 */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center py-3 text-[clamp(2.6rem,9vw,5rem)] sm:py-5">
        <a
          href={href.glossary()}
          aria-label="용어 사전"
          aria-current={isGlossary ? "page" : undefined}
          className={`${icon} justify-self-start`}
        >
          <BookIcon className={iconSize} />
        </a>
        <a href={href.front} aria-label="Today’s News 1면" className="text-center">
          <h1 className="font-masthead leading-none font-black tracking-tight">Today&rsquo;s News</h1>
        </a>
        <a href={href.search()} aria-label="Search" className={`${icon} justify-self-end`}>
          <SearchIcon className={iconSize} />
        </a>
      </div>

      <nav className="relative border-y border-ink">
        <div ref={scroller} onScroll={updateFade} className="no-scrollbar overflow-x-auto overscroll-x-none">
        <ul className="mx-auto flex w-max gap-4 px-1 py-2.5 text-sm sm:gap-8">
          {SECTIONS.map((s) => (
            <NavLink key={s} href={href.section(s)} current={active === s}>
              {s}
            </NavLink>
          ))}
        </ul>
        </div>
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-paper transition-opacity ${fade.left ? "opacity-100" : "opacity-0"}`}
        />
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-paper transition-opacity ${fade.right ? "opacity-100" : "opacity-0"}`}
        />
      </nav>
      <div className="mt-0.75 border-t border-ink" />
    </header>
  );
}
