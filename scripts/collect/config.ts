// 수집 설정 · 공통 타입 · 실행 기록

// 로컬에서는 .env 자동 로드 (Actions에는 파일이 없으니 그냥 넘어감)
try {
  process.loadEnvFile();
} catch {}

export type FeedSource = { category: string; keepDays?: number; label?: string } & (
  | { type: "rss"; url: string }
  | { type: "naver"; query: string }
  | { type: "board"; url: string; source: string } // RSS 없는 게시판 (금감원·금융위 보도자료)
);

export type NewsItem = {
  id: string; // URL용 짧은 ID (key의 해시)
  key: string; // 중복 판별용 (정규화한 제목)
  category: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  snippet: string;
  label?: string; // "보도자료"처럼 기사와 구분할 라벨
  keepDays?: number; // 뜸하게 올라오는 소스는 더 오래 보관
  image?: string; // 대표 사진 (og:image 또는 RSS 첨부 이미지)
  attachment?: string; // 보도자료 PDF 주소
  titleTried?: boolean; // 원문에서 제목·사진을 이미 읽었는지
  hidden?: boolean; // 어느 섹션에도 안 맞음 → 화면에서 숨김 (다시 수집·요약하지 않으려고 데이터엔 남겨둠)
  // LLM이 채우는 필드
  summary?: string;
  tags?: string[];
  titleKo?: string; // 영어 기사면 한국어 제목
  essayPoint?: string; // 경제·정치·보도자료: 논술 포인트
  spaceFact?: string; // 과학: 알고 보면 재밌는 과학 지식 (예전 이름 그대로 씀)
  keyPoints?: string[]; // 보도자료 주요 내용
};

export const PRESS_LABEL = "보도자료"; // 금감원·금융위 보도자료: 섹션 이름이자 라벨
export const NEWS_SECTIONS = ["경제", "정치", "IT", "과학", "문화"]; // LLM이 기사를 나눌 섹션
export const SECTIONS = [PRESS_LABEL, ...NEWS_SECTIONS]; // 화면·요약 카드 순서

// 섹션 개편 정리: 예전 섹션 이름 → 새 섹션, 없앤 섹션
// (main 데이터가 한 번 정리되고 3일 지나면 지워도 됨)
export const MIGRATE: Record<string, string> = { 국제: "경제", 우주: "과학", 예술: "문화", 책: "문화", 엔터: "문화" };
export const DROPPED = new Set(["사회"]);

// 공식 데이터(public/data)는 Actions 봇만 커밋하고, 로컬 결과는 git에 안 올라가는 public/data-local에 저장
export const DATA_DIR = process.env.CI ? "public/data" : "public/data-local";
export const SHARED_DIR = "public/data"; // 로컬 첫 실행 때 봇이 만든 결과를 재사용

export const KEEP_DAYS = 3;
export const MAX_PER_FEED = 7; // 키워드/피드당 최신 몇 건만
export const MAX_NEW_PER_BUCKET = 6; // 한 번 수집에 섹션(보도자료는 기관)당 새 글 최대 수
export const BATCH = 8; // Gemini 한 번에 넘길 기사 수
export const BODY_CHARS = 1200; // LLM에 넘길 본문 길이 (리드 몇 문단이면 요약엔 충분)
export const PRESS_CHARS = 6000; // 보도자료 PDF는 핵심이 본문이라 더 길게
export const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

// 실행 결과 (meta.json + GitHub Actions 요약 카드용)
export const report = {
  fetched: 0,
  newCount: 0, // 이번에 새로 실린 기사 수 (알림·커밋 메시지용)
  newByCategory: {} as Record<string, number>,
  summarizedNow: 0,
  bodyFound: 0,
  pdfRead: 0,
  hidden: 0,
  moved: [] as string[], // 섹션을 옮긴 기사 (예: "정치→경제")
  llmFailedBatches: 0,
  failedFeeds: [] as { category: string; source: string; error: string }[],
  concept: null as string | null,
  spacePhoto: null as string | null,
};
