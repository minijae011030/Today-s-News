import { useEffect, useState } from "react";
import { href } from "../../lib/route";
import { BookIcon } from "../atoms/BookIcon";
import { SearchIcon } from "../atoms/SearchIcon";

/**
 * 스크롤로 큰 제호가 지나가면 위에 붙는 간략 헤더: 현재 섹션 | 작은 제호 | 용어 사전·검색
 * (큰 헤더 #masthead가 화면에서 사라졌는지 IntersectionObserver로 봄)
 */
export function CompactHeader({ label, labelHref }: { label?: string; labelHref?: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const target = document.getElementById("masthead");
    if (!target) return;
    const io = new IntersectionObserver(([e]) => setShown(!e.isIntersecting));
    io.observe(target);
    return () => io.disconnect();
  }, []);

  return (
    <div
      aria-hidden={!shown}
      inert={!shown}
      className={`fixed inset-x-0 top-0 z-30 border-b border-ink bg-paper/95 pt-[env(safe-area-inset-top)] backdrop-blur transition-transform duration-200 ${
        shown ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto grid h-12 max-w-300 grid-cols-[1fr_auto_1fr] items-center px-4 sm:h-14 sm:px-6">
        <span className="min-w-0 truncate text-sm font-semibold">
          {label && labelHref && (
            <a href={labelHref} className="hover:underline">
              {label}
            </a>
          )}
        </span>
        <a
          href={href.front}
          className="font-masthead text-2xl leading-none font-black tracking-tight sm:text-[1.7rem]"
        >
          Today&rsquo;s News
        </a>
        <span className="flex justify-self-end">
          <a href={href.glossary()} aria-label="용어 사전" className="p-1.5 text-ink hover:text-ink-soft">
            <BookIcon className="size-6" />
          </a>
          <a href={href.search()} aria-label="Search" className="p-1.5 text-ink hover:text-ink-soft">
            <SearchIcon className="size-6" />
          </a>
        </span>
      </div>
    </div>
  );
}
