import { useState } from "react";
import type { NewsItem } from "../../types/news";

/**
 * 기사 공유: 공유용 주소(/a/<id>/)를 씀 → 카톡 등에서 기사 제목·요약·사진이 미리보기로 뜸
 * 폰은 기본 공유 시트, 안 되면 주소 복사
 */
export function ShareButton({ item, title, className = "" }: { item: NewsItem; title: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${location.origin}${import.meta.env.BASE_URL}a/${item.id}/`;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // 사용자가 닫음
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button type="button" onClick={share} className={className}>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
