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
};

export type Concept = {
  date: string;
  term: string;
  definition: string;
  issues: string[];
  essayAngle: string;
  relatedIds: string[];
};
