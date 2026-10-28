import { useEffect, useState } from "react";
import { href } from "../../lib/route";

/**
 * 스크롤로 큰 제호가 지나가면 위에 붙는 간략 헤더: 작은 제호 (PC는 오른쪽에 용어 사전·검색)
 * (큰 헤더 #masthead가 화면에서 사라졌는지 IntersectionObserver로 봄)
 */
export function CompactHeader() {
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
      className={`fixed inset-x-0 top-0 z-30 border-b border-ink/[0.06] bg-paper/90 shadow-[0_4px_20px_-8px_rgb(0_0_0/0.12)] pt-[env(safe-area-inset-top)] backdrop-blur transition-transform duration-200 ${
        shown ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div className="mx-auto grid h-12 max-w-300 grid-cols-[1fr_auto_1fr] items-center px-4 sm:h-14 sm:px-6">
        <span aria-hidden />
        <a
          href={href.front}
          className="font-masthead text-2xl leading-none font-black tracking-tight sm:text-[1.7rem]"
        >
          Today&rsquo;s News
        </a>
        {/* PC만 (폰은 하단 탭바) */}
        <span className="hidden gap-5 justify-self-end text-sm sm:flex">
          <a href={href.glossary()} className="hover:underline">
            용어 사전
          </a>
          <a href={href.search()} className="hover:underline">
            Search
          </a>
        </span>
      </div>
    </div>
  );
}
