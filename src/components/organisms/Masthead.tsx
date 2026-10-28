import { useEffect, useRef, useState } from "react";
import { SECTIONS } from "../../lib/constants";
import { href } from "../../lib/route";
import { NavLink } from "../atoms/NavLink";
import { SearchIcon } from "../atoms/SearchIcon";

export function Masthead({
  active,
  isFront,
  isGlossary = false,
}: {
  active?: string;
  isFront: boolean;
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
  }, [active, isFront, isGlossary]);

  return (
    <header id="masthead" className="pt-4">
      <div className="relative">
        {/* 검색: 제호 오른쪽 */}
        <a
          href={href.search()}
          aria-label="Search"
          className="absolute top-1/2 right-0 -translate-y-1/2 p-1.5 text-ink hover:text-ink-soft sm:p-2"
        >
          <SearchIcon className="size-6 sm:size-8 lg:size-9" />
        </a>
        <a href={href.front} className="block py-3 text-center sm:py-5">
          <h1 className="font-masthead text-[clamp(2.6rem,9vw,5rem)] leading-none font-black tracking-tight">
            Today&rsquo;s News
          </h1>
        </a>
      </div>

      <nav className="relative border-y border-ink">
        <div ref={scroller} onScroll={updateFade} className="no-scrollbar overflow-x-auto">
        <ul className="mx-auto flex w-max gap-5 px-1 py-2.5 text-sm sm:gap-8">
          <NavLink href={href.front} current={isFront}>
            1면
          </NavLink>
          {SECTIONS.map((s) => (
            <NavLink key={s} href={href.section(s)} current={active === s}>
              {s}
            </NavLink>
          ))}
          {/* 섹션과 구분되게 얇은 세로선 뒤에 */}
          <li aria-hidden className="w-px shrink-0 self-stretch bg-rule" />
          <NavLink href={href.glossary()} current={isGlossary}>
            용어 사전
          </NavLink>
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
