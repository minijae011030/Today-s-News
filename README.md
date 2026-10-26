# Today's News

경제·국제·사회·IT·우주·예술·엔터·책 소식을 매시간 모아서, 원문을 읽고 LLM으로 요약해 보여주는 개인용 신문 PWA.
서버와 DB 없이 GitHub Actions + 정적 JSON + GitHub Pages로 돌아가.

👉 https://minijae011030.github.io/Today-s-News/

## 구조

```
feeds.json                      수집할 소스 목록 (네이버 뉴스 검색 키워드 / RSS)
scripts/collect.ts              수집 → 중복 제거 → 원문 본문 추출 → Gemini 요약 → public/data/*.json
scripts/notify.ts               새 기사가 있으면 웹 푸시 알림 전송
.github/workflows/collect.yml   매시간: 수집 → 데이터 커밋 → 빌드 → Pages 배포 → 알림
public/push-sw.js               서비스워커 푸시 알림 처리
src/                            React + Tailwind 프론트 (해시 라우팅)
```

### 데이터 파일 (`public/data/`)

| 파일 | 내용 |
|---|---|
| `news.json` | 기사 목록 + 요약, 태그, 논술 포인트, 우주 이야기 |
| `meta.json` | 마지막 수집 시각, 기사 수, 새 기사 수 |
| `concept.json` | 오늘의 개념 (최근 30일) |

`public/data`는 Actions 봇만 커밋해. 로컬에서 수집하면 `public/data-local`(gitignore)에 따로 저장돼서 main과 충돌하지 않아.

## 로컬 실행

```bash
npm install
# .env 에 GEMINI_API_KEY, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, VITE_VAPID_PUBLIC_KEY
npm run collect   # public/data-local 에 저장
npm run dev
```

## GitHub Secrets

| 이름 | 용도 |
|---|---|
| `GEMINI_API_KEY` | 요약 (Google AI Studio) |
| `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` | 네이버 뉴스 검색 (NCP NAVER API HUB) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | 웹 푸시 키 (`npx web-push generate-vapid-keys`) |
| `PUSH_SUBSCRIPTION` | 폰 구독 정보 (앱 푸터 "구독 정보 복사") |

## LLM

- 모델: `gemini-flash-lite-latest` (thinking 최소화). `GEMINI_MODEL`로 바꿀 수 있어
- 이미 요약한 기사는 다시 요약하지 않음
- 경제·국제·사회는 논술 포인트, 우주는 "알고 보면 재밌는 우주 이야기", 영어 기사는 한국어 제목 생성
- 하루 한 번 "오늘의 개념" 생성

## TODO

### 다음 작업
- [ ] **1면 사진**: NASA 오늘의 이미지를 1면에 신문 보도사진처럼 크게, 캡션(한국어 설명) 붙여서
- [ ] **검색**: 키워드로 기사 + 논술 포인트 모아 보기 (예: "공매도")
- [ ] **조간/석간 알림**: 매시간 알림 대신 아침 7시 조간, 저녁 7시 석간 하루 두 번
  - 알림 문구에 섹션별 요약 (예: "오늘 조간: 경제 12건, 국제 5건…")
- [ ] **용어 풀이**: 기사마다 어려운 용어 2~3개를 LLM이 뽑아서 한 줄 정의와 함께 정리
  - 기사 상세의 요약 아래에 "용어" 칸으로 모아서 표시 (본문 인라인 링크는 X)
  - 한 줄 정의는 LLM이 정확하게, 더 보기 링크는 위키백과(정의) + 나무위키(배경 맥락)
  - 문서가 없으면 검색 결과로 이동하게 링크 생성
  - 쌓인 용어는 나중에 개념 퀴즈 재료로 활용

### 나중에
- [ ] 개념 아카이브 + 복습 퀴즈 (플래시카드)
- [ ] 주말판: 이번 주 논술 주제 + 개요 예시
- [ ] 스크랩북 (★ + 메모, localStorage)
- [ ] 읽음 표시 / 안 읽은 기사 수
- [ ] 같은 사건 기사 묶기
- [ ] 키워드 설정 UI

### 완료
- [x] PWA 아이콘
- [x] 당겨서 새로고침
- [x] 섹션 페이지네이션
- [x] 새 기사 웹 푸시 알림
- [x] 오늘의 개념
