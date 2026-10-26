# 오늘의 세상

경제·우주·IT·예술 뉴스를 RSS로 모아서 LLM으로 요약해 보여주는 개인용 PWA.
서버와 DB 없이 GitHub Actions + 정적 JSON으로 돌아가.

## 구조

```
feeds.json                  수집할 피드 목록 (여기만 고치면 소스 추가/삭제)
scripts/collect.ts          RSS 수집 → 중복 제거 → LLM 요약 → public/data/news.json
.github/workflows/collect.yml   매시간 collect 실행 후 news.json 커밋
src/                        React 프론트 (news.json 읽어서 카테고리 탭으로 표시)
vite.config.ts              PWA 설정 (manifest, 오프라인 캐시)
```

## 로컬 실행

```bash
npm install
cp .env.example .env        # GEMINI_API_KEY 넣기 (없으면 요약 없이 수집만)
export $(cat .env | xargs)
npm run collect             # public/data/news.json 생성
npm run dev
```

## 배포

1. GitHub에 레포 만들고 push
2. Settings → Secrets and variables → Actions → `GEMINI_API_KEY` 추가
3. Actions 탭에서 "Collect news" 수동 실행해서 확인
4. Vercel에 레포 연결 (Framework: Vite). news.json 커밋될 때마다 자동 재배포

## LLM 요약

- 모델: `claude-haiku-5-5` (`scripts/collect.ts`의 `MODEL`)
- 이미 요약한 기사는 다시 요약하지 않아서 새 기사분만 비용이 나가
- 경제 카테고리는 `essayPoint`(논술 포인트)도 생성

## TODO

- [ ] PWA 아이콘 192/512 PNG
- [ ] 읽음 처리, 북마크 (localStorage)
- [ ] 같은 사건 기사 묶기
- [ ] 키워드 설정 UI
