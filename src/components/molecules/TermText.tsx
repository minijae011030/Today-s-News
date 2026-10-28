import type { ReactNode } from "react";
import type { TermInfo } from "../../lib/glossary";

export type OpenTerm = (info: TermInfo, anchor: HTMLElement) => void;

/**
 * 기사 한 편 안에서 용어마다 "처음 나온 곳"에만 링크를 거는 함수를 만듦
 * (요약 → 주요 내용 → 논점 순서로 부르면, 앞에서 건 용어는 뒤에서 안 걸림)
 */
export function makeTermLinker(terms: { text: string; info: TermInfo }[], onOpen: OpenTerm) {
  const used = new Set<string>();
  return (text: string): ReactNode => {
    const out: ReactNode[] = [];
    let rest = text;
    let key = 0;
    for (;;) {
      // 남은 글에서 가장 먼저 나오는, 아직 안 쓴 용어
      let hit: { at: number; t: (typeof terms)[number] } | null = null;
      for (const t of terms) {
        if (used.has(t.info.term)) continue;
        const at = rest.indexOf(t.text);
        if (at >= 0 && (!hit || at < hit.at)) hit = { at, t };
      }
      if (!hit) break;
      used.add(hit.t.info.term);
      const { at, t } = hit;
      out.push(rest.slice(0, at));
      out.push(
        <button
          key={key++}
          type="button"
          onClick={(e) => onOpen(t.info, e.currentTarget)}
          className="term-link"
          aria-haspopup="dialog"
        >
          {t.text}
        </button>,
      );
      rest = rest.slice(at + t.text.length);
    }
    out.push(rest);
    return out;
  };
}
