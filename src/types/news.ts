export type NewsItem = {
  id: string;
  category: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  snippet: string;
  summary?: string;
  tags?: string[];
  essayPoint?: string;
  spaceFact?: string;
  titleKo?: string;
  hidden?: boolean;
  label?: string; // "보도자료" 등
  attachment?: string; // 보도자료 PDF
  keyPoints?: string[]; // 보도자료 주요 내용
  terms?: string[]; // 용어 풀이 링크를 걸 용어
  image?: string;
};

export type GlossaryEntry = {
  term: string;
  aliases?: string[];
  definition: string;
  addedAt: string;
};

export type Concept = {
  date: string;
  term: string;
  definition: string;
  issues: string[];
  essayAngle: string;
  relatedIds: string[];
};

export type SpacePhoto = {
  date: string;
  title: string;
  titleKo: string;
  story: string;
  image: string;
  hdImage?: string;
  credit: string;
  link: string;
};
