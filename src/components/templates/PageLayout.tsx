import type { ReactNode } from "react";
import type { NewsItem } from "../../types/news";
import { href } from "../../lib/route";
import { AppPrompt } from "../organisms/AppPrompt";
import { CompactHeader } from "../organisms/CompactHeader";
import { Footer } from "../organisms/Footer";
import { Masthead } from "../organisms/Masthead";
import { PullToRefresh } from "../organisms/PullToRefresh";

/** 모든 페이지 공통 틀: 당겨서 새로고침 + 제호 + 본문 + 푸터 + 하단 안내 시트 */
export function PageLayout({
  activeSection,
  isFront,
  isGlossary = false,
  items,
  version,
  onRefresh,
  children,
}: {
  activeSection?: string;
  isFront: boolean;
  isGlossary?: boolean;
  items: NewsItem[] | null;
  version: number;
  onRefresh: () => Promise<number | null>;
  children: ReactNode;
}) {
  return (
    <>
    <PullToRefresh onRefresh={onRefresh}>
      <div className="mx-auto max-w-300 px-4 pb-24 sm:px-6">
        <Masthead active={activeSection} isFront={isFront} isGlossary={isGlossary} />
        {children}
        <Footer items={items} version={version} />
      </div>
    </PullToRefresh>
    {/* 당겨서 새로고침이 움직이는 영역 밖에 둬야 화면에 고정됨 */}
    <CompactHeader
      label={isGlossary ? "용어 사전" : isFront ? undefined : activeSection}
      labelHref={isGlossary ? href.glossary() : activeSection ? href.section(activeSection) : undefined}
    />
    <AppPrompt />
    </>
  );
}
