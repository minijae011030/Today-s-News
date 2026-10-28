import { useEffect, useRef, useState } from "react";
import { SECTIONS } from "../../lib/constants";
import { href } from "../../lib/route";
import { NavLink } from "../atoms/NavLink";

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

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const util = "hover:text-ink hover:underline underline-offset-4";

  return (
    <header id="masthead" className="pt-4">
      {/* PC: 신문 상단 한 줄 (날짜 | 용어 사전 · 검색). 폰은 하단 탭바로 */}
      <div className="hidden items-center justify-between text-xs text-ink-soft sm:flex">
        <span>{today}</span>
        <span className="flex gap-5">
          <a href={href.glossary()} aria-current={isGlossary ? "page" : undefined} className={`${util} ${isGlossary ? "font-semibold text-ink" : ""}`}>
            용어 사전
          </a>
          <a href={href.search()} className={util}>
            Search
          </a>
        </span>
      </div>

      <a href={href.front} aria-label="Today’s News 1면" className="block py-3 text-center sm:py-5">
        <h1 className="font-masthead text-[clamp(2.6rem,9vw,5rem)] leading-none font-black tracking-tight">
          Today&rsquo;s News
        </h1>
      </a>

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
