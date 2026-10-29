// 같은 소식 묶기: 제목이 비슷하면 같은 기사로 봄. 두 가지 중 하나라도 맞으면 같은 소식
//  1) 글자 2개씩 묶은 조각이 많이 겹침
//     "삼전닉스가 끌어올린 코스피…10거래일 만에 6000선 회복" ≈ "[포토]'삼전닉스'가 끌어올린 코스피, 6000선 회복"
//  2) 단어가 많이 겹침 (순서만 바뀐 경우: "구글·애플 인앱결제 과징금" ≈ "애플·구글 인앱결제 과징금 637억원")
//     뉴스 검색으로 들어온 기사끼리만 (블로그·RSS는 "Show GN: …"처럼 앞머리가 같은 다른 글이 많아서)
import type { NewsItem } from "./config.ts";

const SIMILAR = 0.5; // 0~1. 실제 데이터로 맞춘 값 (0.5 아래로는 다른 소식이 섞이기 시작함)
const WINDOW = 48 * 3600_000; // 이틀 안에 나온 기사끼리만 비교

const WORD_HITS = 4; // 겹치는 단어 최소 개수
const WORD_RATIO = 0.6; // 짧은 쪽 제목 단어 중 겹치는 비율 (실제 데이터로 맞춘 값: 0.5면 "3분기 실적" 같은 다른 기사가 섞임)

const strip = (t: string) => t.replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/[^\p{L}\p{N}]/gu, "");
function bigrams(t: string): Set<string> {
  const s = strip(t);
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}
// 단어 목록 (2글자 이상). "과징금"과 "과징금을"처럼 조사만 다르면 같은 단어로 봄
const words = (t: string) => [
  ...new Set(t.replace(/\[[^\]]*\]|\([^)]*\)/g, " ").split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2)),
];
const sameWord = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a);
function wordMatch(a: string[], b: string[]): boolean {
  const hits = a.filter((w) => b.some((x) => sameWord(w, x))).length;
  return hits >= WORD_HITS && hits / Math.min(a.length, b.length) >= WORD_RATIO;
}

function dice(a: Set<string>, b: Set<string>): number {
  let same = 0;
  for (const g of a) if (b.has(g)) same++;
  return (2 * same) / (a.size + b.size || 1);
}

// [포토]·[사진]·[영상]처럼 사진만 있는 기사
export const isPhotoOnly = (title: string) => /^\s*\[(포토|사진|영상|화보|포토뉴스)\]/.test(title);

/** 이미 실린 기사들 + 새로 들어오는 기사를 비교하는 도우미 */
export class StoryIndex {
  private list: { n: NewsItem; g: Set<string>; w: string[]; t: number }[] = [];
  constructor(items: Iterable<NewsItem>) {
    for (const n of items) if (!n.hidden) this.add(n);
  }
  add(n: NewsItem): void {
    this.list.push({ n, g: bigrams(n.title), w: words(n.title), t: Date.parse(n.publishedAt) });
  }
  /** 같은 소식을 다룬 기사 (보도자료는 보도자료끼리, 기사는 기사끼리만 비교) */
  findSame(n: NewsItem): NewsItem | undefined {
    const g = bigrams(n.title);
    const w = words(n.title);
    const t = Date.parse(n.publishedAt);
    return this.list.find(
      (x) =>
        x.n !== n &&
        !!x.n.label === !!n.label &&
        Math.abs(x.t - t) < WINDOW &&
        (dice(x.g, g) >= SIMILAR || (!!x.n.via && !!n.via && wordMatch(x.w, w))),
    )?.n;
  }
}

/** 이미 저장된 기사 중 같은 소식이 여러 건이면, 먼저 실린 것만 남기고 나머지는 숨김 */
export function hideDuplicates(items: NewsItem[]): number {
  const index = new StoryIndex([]);
  let hidden = 0;
  // 먼저 실린 기사를 남기되, [포토] 기사는 맨 뒤로 (글 있는 기사를 남기려고)
  const order = [...items].sort(
    (a, b) => Number(isPhotoOnly(a.title)) - Number(isPhotoOnly(b.title)) || a.publishedAt.localeCompare(b.publishedAt),
  );
  for (const n of order) {
    if (n.hidden) continue;
    if (isPhotoOnly(n.title)) {
      n.hidden = true;
      hidden++;
      continue;
    }
    const same = index.findSame(n);
    if (same) {
      n.hidden = true;
      n.duplicate = true;
      same.coverage = (same.coverage ?? 1) + (n.coverage ?? 1); // 숨기는 쪽이 이미 모은 매체 수도 합침
      hidden++;
    } else index.add(n);
  }
  return hidden;
}
