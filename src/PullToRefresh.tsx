import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 당겨서 새로고침 (터치 기기 전용)
 * 신문 제호 아래 이중 괘선이 당기는 만큼 그려지고,
 * 놓으면 "새 판을 찍는 중" 동안 괘선 위로 잉크가 지나가요.
 */

const THRESHOLD = 72; // 이만큼 당기면 새로고침
const MAX = 110; // 최대로 늘어나는 높이
const HOLD = 64; // 새로고침 중 유지하는 높이
const RULE_W = 140; // 괘선 최대 길이

type Phase = "idle" | "pulling" | "refreshing" | "done";

export function PullToRefresh({
  onRefresh,
  children,
}: {
  /** 새로 들어온 기사 수를 돌려줘요. 실패하면 null */
  onRefresh: () => Promise<number | null>;
  children: ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState("");
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  const set = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const setPullBoth = (v: number) => {
    pullRef.current = v;
    setPull(v);
  };

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (phaseRef.current !== "idle" || window.scrollY > 0 || e.touches.length > 1) return;
      startY.current = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        startY.current = null;
        if (pullRef.current) setPullBoth(0);
        if (phaseRef.current === "pulling") set("idle");
        return;
      }
      e.preventDefault(); // 브라우저 기본 바운스 대신 우리 표시만
      if (phaseRef.current === "idle") set("pulling");
      setPullBoth(Math.min(MAX, dy * 0.45)); // 고무줄처럼 덜 따라오게
    };

    const onEnd = async () => {
      if (startY.current === null) return;
      startY.current = null;
      if (pullRef.current < THRESHOLD) {
        setPullBoth(0);
        set("idle");
        return;
      }
      set("refreshing");
      setPullBoth(HOLD);
      const started = Date.now();
      const added = await refreshRef.current().catch(() => null);
      // 너무 빨리 끝나면 애니메이션이 깜빡이니까 최소 0.7초는 보여줌
      await new Promise((r) => setTimeout(r, Math.max(0, 700 - (Date.now() - started))));
      setMessage(
        added === null
          ? "Couldn't refresh"
          : added > 0
            ? `${added} new ${added === 1 ? "story" : "stories"}`
            : "You're up to date",
      );
      set("done");
      setTimeout(() => {
        setPullBoth(0);
        setTimeout(() => set("idle"), 250);
      }, 1100);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const dragging = phase === "pulling";
  const progress = Math.min(1, pull / THRESHOLD);
  const ready = phase === "pulling" && pull >= THRESHOLD;
  const label =
    phase === "refreshing"
      ? "Printing the latest edition"
      : phase === "done"
        ? message
        : ready
          ? "Release to refresh"
          : "Pull for the latest";
  const ruleWidth = phase === "pulling" ? RULE_W * progress : RULE_W;
  const ease = dragging ? "none" : "transform 250ms ease, height 250ms ease";

  return (
    <>
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center justify-end overflow-hidden bg-paper pb-3"
        style={{ height: pull, transition: dragging ? "none" : "height 250ms ease" }}
      >
        {phase !== "idle" && (
          <>
            <span
              className="font-serif text-sm text-ink-soft"
              style={{ opacity: phase === "pulling" ? Math.min(1, progress * 1.4) : 1 }}
            >
              {label}
            </span>
            <div className="relative mt-2" style={{ width: RULE_W }}>
              {/* 제호 아래와 같은 이중 괘선 */}
              <div className="mx-auto" style={{ width: ruleWidth }}>
                <div className="h-[2px] bg-ink" />
                <div className="mt-[2px] h-px bg-ink" />
              </div>
              {phase === "refreshing" && <span className="ptr-ink" aria-hidden />}
            </div>
          </>
        )}
      </div>

      <div style={{ transform: pull ? `translateY(${pull}px)` : undefined, transition: ease }}>
        {children}
      </div>
    </>
  );
}
