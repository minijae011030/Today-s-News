import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TermInfo } from "../../lib/glossary";
import { href } from "../../lib/route";

const WIDE = "(min-width: 640px)";

/**
 * 용어 풀이 팝업
 * - PC: 누른 단어 바로 위에 작은 팝오버 (위에 자리가 없으면 아래)
 * - 폰: 아래에서 올라오는 시트 (가장자리에서 잘리거나 손가락에 가리지 않게)
 */
export function TermPopup({
  info,
  anchor,
  relatedCount,
  onClose,
}: {
  info: TermInfo;
  anchor: HTMLElement;
  relatedCount: number;
  onClose: () => void;
}) {
  const [wide] = useState(() => window.matchMedia(WIDE).matches);
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // PC: 단어 위치에 맞춰 자리 잡기
  useLayoutEffect(() => {
    if (!wide || !box.current) return;
    const r = anchor.getBoundingClientRect();
    const { width, height } = box.current.getBoundingClientRect();
    const left = Math.min(Math.max(16, r.left + r.width / 2 - width / 2), window.innerWidth - width - 16);
    const top = r.top - height - 10 >= 12 ? r.top - height - 10 : r.bottom + 10;
    setPos({ top, left });
  }, [wide, anchor, info]);

  // 닫기: Esc, 바깥 누르기, (PC) 스크롤
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !anchor.contains(t)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    if (wide) window.addEventListener("scroll", onClose, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onClose);
    };
  }, [anchor, onClose, wide]);

  const body = (
    <>
      <p className="text-[0.7rem] font-semibold tracking-wider text-muted uppercase">용어 풀이</p>
      <h3 id="term-title" className="mt-1 font-serif text-xl font-bold">
        {info.term}
      </h3>
      {info.aliases && info.aliases.length > 0 && (
        <p className="mt-0.5 text-sm text-muted">{info.aliases.join(" · ")}</p>
      )}
      <p className="mt-2 font-serif leading-[1.75] text-ink-soft">{info.definition}</p>
      {info.concept && info.concept.issues.length > 0 && (
        <div className="mt-3 border-t border-rule pt-3">
          <p className="text-xs font-semibold text-ink">쟁점</p>
          <ul className="mt-1 space-y-1 font-serif text-[0.95rem] leading-relaxed text-ink-soft">
            {info.concept.issues.map((x) => (
              <li key={x} className="flex gap-2">
                <span aria-hidden className="mt-[0.75em] h-px w-2.5 shrink-0 bg-ink" />
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 flex items-center justify-between gap-4 border-t border-ink pt-3 text-sm font-semibold">
        <a href={href.search(info.term)} className="hover:underline">
          관련 기사 {relatedCount} &rarr;
        </a>
        <a href={href.glossary(info.term)} className="text-ink-soft hover:text-ink hover:underline">
          용어 사전 &rarr;
        </a>
      </div>
    </>
  );

  if (wide) {
    return (
      <div
        ref={box}
        role="dialog"
        aria-labelledby="term-title"
        style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
        className="fixed z-50 w-[22rem] border border-ink bg-paper p-5 shadow-[0_12px_32px_rgb(0_0_0/0.12)]"
      >
        {body}
      </div>
    );
  }

  return (
    <>
      <div aria-hidden className="fixed inset-0 z-40 bg-ink/20" />
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="term-title"
        className="app-prompt fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto border-t-4 border-double border-ink bg-paper pb-[env(safe-area-inset-bottom)]"
      >
        <div className="relative mx-auto max-w-170 px-5 pt-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 px-2 py-1 text-sm text-ink-soft hover:text-ink"
          >
            Close
          </button>
          {body}
        </div>
      </div>
    </>
  );
}
