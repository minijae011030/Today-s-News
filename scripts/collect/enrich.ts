// Gemini로 요약 · 섹션 확인 · 논술 포인트
import { BATCH, BODY_CHARS, PRESS_CHARS, PRESS_LABEL, SECTIONS, report, type NewsItem } from "./config.ts";
import { readArticle } from "./article.ts";
import { callGemini, geminiKey } from "./gemini.ts";
import { chunk, parseJson, runPool, sleep } from "./util.ts";

const PROMPT = `다음 뉴스 목록 각각에 대해 JSON 배열로만 답해.
각 원소: {
  "idx": number,
  "fit": "이 기사가 실제로 속하는 섹션 하나 (경제, 정치, IT, 과학, 문화 중). 국제 뉴스는 내용에 따라 경제(금리·환율·무역)·정치(외교·정상회담)로, 사건·사고·사회 이슈는 null. 문화에는 전시·공연·책·영화·드라마가 들어감. 정치는 법안·정책 내용이 있는 기사만, 정당끼리 비난만 오가는 기사는 null. 검색 키워드가 비유로만 쓰였거나(예: '의료의 블랙홀', '우주 최강') 어느 섹션에도 안 맞으면 null",
  "titleKo": "제목이 한국어가 아니면 자연스러운 한국어 제목, 한국어면 null",
  "summary": "한국어 요약. body가 있으면 핵심 사실(누가, 무엇을, 왜, 수치)을 담아 3~4문장. body가 null이면 snippet 기준으로 1~2문장",
  "tags": ["키워드", 최대 3개],
  "essayPoint": "경제·정치만: 금융감독원 논술 관점에서 이 기사의 쟁점과 연결되는 개념을 2문장으로 (경제: 금융소비자보호, 건전성 규제, 자본시장 공정성, 통화정책 파급, 환율과 금융안정 등 / 정치: 법안·정책이 금융시장과 소비자에 미치는 영향. 의견이 갈리는 사안은 양쪽 입장을 함께 쓰고 어느 편도 들지 마. 다른 섹션은 null",
  "spaceFact": "과학만: 이 기사와 연결된, 일반인이 '오 신기하다' 할 만한 과학 지식을 2~3문장으로 쉽게 설명 (기사에 나온 현상·천체·원리가 무엇이고 왜 흥미로운지). 다른 섹션은 null"
}
category는 검색 키워드로 붙은 임시 섹션이라 틀릴 수 있어. essayPoint와 spaceFact는 category가 아니라 fit 기준으로 판단해.
summary와 essayPoint는 제공된 title, snippet, body에 있는 내용만 근거로 쓰고 지어내지 마. 정치 기사는 사실만 쓰고 평가나 판단을 붙이지 마. 문체는 '~습니다/~입니다'.
label이 "보도자료"면 금융당국이 직접 낸 자료(body는 첨부 PDF 전문일 수 있음)이니, summary에 무엇을 발표·시행하는지와 시행 시기·대상을 꼭 담고,
"keyPoints"에 주요 내용을 3~5개 (각 한 문장, 수치·시행일·대상 포함) 배열로 넣어. 보도자료가 아니면 keyPoints는 null. spaceFact는 널리 확립된 과학 지식만 써.`;

type LlmResult = {
  idx: number;
  fit: string | null;
  summary: string;
  tags: string[] | null;
  essayPoint: string | null;
  spaceFact: string | null;
  titleKo: string | null;
  keyPoints: string[] | null;
};

function apply(n: NewsItem, o: LlmResult): void {
  // 보도자료는 섹션 고정, 그 외엔 LLM이 고른 섹션으로 (어디에도 안 맞으면 숨김)
  const fit = n.label === PRESS_LABEL ? n.category : o.fit;
  if (!fit || !SECTIONS.includes(fit)) {
    n.hidden = true;
    report.hidden++;
    return;
  }
  if (fit !== n.category) {
    report.moved.push(`${n.category}→${fit}`);
    n.category = fit;
  }
  n.summary = o.summary;
  n.tags = o.tags ?? [];
  if (o.titleKo) n.titleKo = o.titleKo;
  if (o.essayPoint) n.essayPoint = o.essayPoint;
  if (o.spaceFact) n.spaceFact = o.spaceFact;
  if (n.label === PRESS_LABEL && o.keyPoints?.length) n.keyPoints = o.keyPoints.slice(0, 5);
}

// 요약 안 된 기사만 Gemini로 (BATCH건씩, 2묶음 동시에). 묶음이 끝날 때마다 onProgress로 중간 저장
export async function enrich(items: NewsItem[], onProgress: () => Promise<void>): Promise<void> {
  const apiKey = geminiKey();
  if (!apiKey) {
    console.log("ℹ️  GEMINI_API_KEY 없음 → LLM 요약 건너뜀");
    return;
  }
  const todo = items.filter((n) => !n.hidden && !n.summary);
  if (todo.length === 0) return;

  const batches = chunk(todo, BATCH);
  let done = 0;
  let saving = Promise.resolve();
  console.log(`⏳ 요약할 기사 ${todo.length}건 (${batches.length}묶음, 2묶음씩 동시에)`);

  await runPool(batches, 2, async (batch) => {
    const bodies = await Promise.all(batch.map(readArticle));
    const gotBody = bodies.filter(Boolean).length;
    const input = batch.map((n, idx) => ({
      idx,
      category: n.category,
      label: n.label ?? null,
      title: n.title,
      snippet: n.snippet,
      body: bodies[idx] ? bodies[idx].slice(0, n.label === PRESS_LABEL ? PRESS_CHARS : BODY_CHARS) : null,
    }));

    try {
      const out = parseJson<LlmResult[]>(await callGemini(apiKey, `${PROMPT}\n\n${JSON.stringify(input)}`), "[");
      for (const o of out) if (batch[o.idx]) apply(batch[o.idx], o);
      report.summarizedNow += batch.filter((n) => n.summary).length;
      report.bodyFound += gotBody;
      done += batch.length;
      console.log(`🤖 요약 ${done}/${todo.length} (본문 확보 ${gotBody}/${batch.length})`);
      saving = saving.then(onProgress); // 중간에 끊겨도 여기까지는 저장 (동시에 안 쓰게 순서대로)
      await saving;
      await sleep(1000);
    } catch (e) {
      report.llmFailedBatches++;
      console.warn(`⚠️  LLM 배치 실패: ${(e as Error).message}`);
    }
  });
}
