import type { NewsItem } from "../types/news";

/**
 * 제목 정리: 말머리와 부제를 떼서 본 제목만
 * - 기사: "[단독] …", "… [핫이슈]" 같은 말머리 → series (작은 태그로 따로 보여줌)
 * - 보도자료: "…하겠습니다. -「…회의 개최」" 처럼 " -" 뒤는 부제 → subtitle
 *   게시판 꼬리표("금일 등록된 게시글")도 정리 (예전 데이터용)
 */
export function titleParts(n: NewsItem): { title: string; series?: string; subtitle?: string } {
  let title = (n.titleKo ?? n.title).replace(/\s+/g, " ").trim();
  if (n.label === "보도자료") {
    title = title.replace(/\.?\s*금일 등록된 게시글\s*$/, "").replace(/\s*-\s*$/, "");
    // 단어 사이 하이픈(농진청-인천대)은 그대로 두고, 앞에 띄어쓰기가 있는 " -" 에서만 나눔
    const m = title.match(/^(.{10,}?)\s+-\s*(.+)$/);
    if (m) return { title: m[1].trim(), subtitle: m[2].replace(/\.\s*$/, "").trim() };
    return { title };
  }
  let series: string | undefined;
  const head = title.match(/^[[【]\s*([^\]】]{1,20}?)\s*[\]】]\s*(.+)$/);
  if (head) [, series, title] = head;
  const tail = title.match(/^(.+?)\s*[[【]\s*([^\]】]{1,15}?)\s*[\]】]$/);
  if (tail && tail[1].length >= 8) {
    title = tail[1];
    series ??= tail[2];
  }
  return { title: title.trim(), series };
}

export const titleOf = (n: NewsItem) => titleParts(n).title;

export function timeAgo(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.round(h / 24)}일 전`;
}

export const fullDate = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export const stamp = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatPublished = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
