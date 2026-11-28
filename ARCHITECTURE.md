# ARCHITECTURE — ChoKo QUANT 미국주식 차트분석기

> 최종 갱신 2026-11-28 · 저장소 `sky1856/Us-stock-chart` · 라이브 `https://sky1856.github.io/Us-stock-chart/`
> 이 문서는 **화면·데이터·규칙이 어떻게 연결되어 있는지**와 **깨뜨리면 안 되는 불변 규칙**을 정리한 연결 구조표입니다.
> 빌드 산출물은 저장소 루트 `index.html` 한 파일입니다(모든 CSS·데이터·엔진·UI 인라인).

---

## 0. 한눈에 보는 구조

```
scripts/top150.json ──┐
                      ├─► update_data.py ─► scripts/data.js ──┐
Yahoo Finance ────────┘   (시세·펀더멘털·거시·공포탐욕)        │
                                                              ├─► build.py ─► index.html ─► GitHub Pages
scripts/template.html ───────────────────────────────────────┤     (라이브)
scripts/ui.css  scripts/engine.js  scripts/ui.js  scripts/edufig.js ─┘
```

| 파일 | 역할 | 수정 시 주의 |
|---|---|---|
| `scripts/top150.json` | 유니버스 설정 — 시총 1~150위 150행(`rank`,`ticker`,`name`,`mc`,`mcText`,`price`) | 여기가 **유일한 종목 원장**. `rank ≤ 100`이 추세형, `≤ 150`이 스윙형 |
| `scripts/update_data.py` | Yahoo 10년 일봉 수집 → 최근 1,505봉 유지, 펀더멘털·^VIX·^TNX·DXY·CNN 공포탐욕·거시지표 수집 → `data.js` | 실패 시 기존 `data.js` 유지(exit 2). 95% 미만 수집이면 폐기 |
| `scripts/data.js` | `window.MARKET` — `asOf`,`updatedAt`,`dates[]`,`tickers[]`(meta),`series{}`,`fundamentals`,`fearGreed`,`macro` | meta의 `r`(시총 순위)이 **전략별 유니버스 판정 기준** |
| `scripts/engine.js` | 기술적 분석·전략 시뮬레이션(순수 JS, DOM 없음) | 추세 C2 / 스윙 A 규칙. 성향 프로필은 파라미터만 바꾼다 |
| `scripts/ui.js` | 화면 전체(스캐너·차트·백테스트·리플레이·모의투자) | 유니버스 필터는 `uniList()` 한 곳 |
| `scripts/ui.css` | 디자인 시스템 + 테마(다크/화이트 × 안정형/공격형) | 브랜딩·성향 스위치 블록은 파일 끝(2026-11-28) |
| `scripts/template.html` | 문서 골격(헤더·사이드바·메인·차트) | `__CSS__ __DATA__ __ENGINE__ __EDUFIG__ __UI__ __UPDATED__` 토큰 |
| `scripts/build.py` | 위 조각을 `index.html`로 합침 | `</script>` 포함 파일은 빌드 거부 |
| `/workspace/work/stock_daily_update.sh` | 예약 실행(매일 07:15 KST) — pull → update_data → build → 커밋·푸시 | 종목 수는 `top150.json`을 따라 자동으로 152종목 |

---

## 1. 유니버스 — 추세형 Top 100 / 스윙형 Top 150

| 구분 | rank 범위 | 종목 수 | 쓰이는 곳 |
|---|---|---|---|
| **추세형(trend)** | `r ≤ 100` + `NKE`·`QQQ`(r 없음) | **102** | 스캐너 목록·상태 탭 카운트·프리셋 카운트·유니버스 백테스트 평균·자동 선택(`topScoreT`) |
| **스윙형(swing)** | `r ≤ 150` + `NKE`·`QQQ` | **152** | 위와 동일(같은 함수가 전략 인자만 바꿔 사용) |

- `101~150위 50종목`: STX, BKNG, COF, NEM, SO, WDC, MAR, ABNB, CVS, HCA, MRSH, DUK, REGN, FTNT, BNY, ICE, MMM, GD, WM, MPC, EQIX, SNDK, NOW, UPS, CSX, PSX, CMCSA, MRNA, USB, VLO, ADBE, CTAS, WAT, GLW, MSI, SPG, EMR, TT, PNC, KKR, SHW, PWR, ECL, HWM, MDLZ, AMT, ELV, RCL (**PH·CME는 기존 1~100위에 이미 있어 중복 → 48종목이 실제 신규**) + 시총 연속성을 위해 151·152위 **MCO·WMB**를 포함해 101~150위 50행을 채웠다. 결과: 150행 + NKE·QQQ = **152종목**.
- 구현: `ui.js`의 `uniList(key)` 하나가 유일한 필터 지점.
  ```
  UNIV_MAX_RANK = { trend: 100, swing: 150 }
  inUniv(x, mode) = x.r == null || x.r <= UNIV_MAX_RANK[mode]
  ```
  스캐너(`scanRows`)·상태 카운트(`scanCounts`)·프리셋(`presetData`,`wCounts`,`vcpCounts`,`divCounts`,`bkCounts`,`triCounts`,`win70Counts`,`mom6Counts`)·백테스트 평균(`computeUniNow`, `startUniJob`)·자동 선택(`topScoreT`)이 모두 이 함수를 거친다.
- **검색(전역 검색·관심종목 추가)은 152종목 전체**를 대상으로 한다 — 차트 열람 자체는 유니버스와 무관.

### 1-1. 제목·부제·카운트 연동 (본문-제목 일치 원칙)

| 화면 요소 | 추세형 | 스윙형 | 갱신 지점 |
|---|---|---|---|
| 좌측 제목 `#uniTitle` | 시가총액 Top 100 | 시가총액 Top 150 | `renderUnivHead()` |
| 좌측 부제 `#uniCount` | 분석 102종목 | 분석 152종목 | 같은 함수(실제 `uniList().length`) |
| 상단 로고 부제 `#brandSub` | US Top 100 Analyzer | US Top 150 Analyzer | 같은 함수 |
| 전체 탭 `#cAll` | 102 | 152 | `renderScanner()` (`scanCounts().all`) |
| 상단 통합 컨트롤 오른쪽 `#tcNow` | 🛡️/🔥 · 📈/⚡ · Top 100 · 분석 102종목 | … Top 150 · 분석 152종목 | 같은 함수 |

**불변 규칙**: 화면에 적히는 종목 수는 반드시 그 전략의 `uniList().length`와 같아야 한다(하드코딩 금지).
단, "6M/1Y 백테스트 평균"의 `n`은 선택 기간을 온전히 채운 종목만 세므로 152보다 작을 수 있다(상장 초기 종목 제외 — 기존 규칙).

---

## 2. 화면 연결 구조

### 2-1. 상단 (헤더, `sticky`)
```
[☰(모바일)] [로고 ChoKo QUANT + US Top N Analyzer] [1 성향 🛡️안정형|🔥공격형] [with ChoKo] [CREATED BY JiHoon Park]
[장마감 날짜] [테마] [검색] [관심종목 pills + 추가]
```
- 로고: `downloads/choko-quant-mark-sapphire.png`를 160px로 크롭·리사이즈(둥근 모서리 알파) 후 **base64 data URI**로 인라인. 파비콘·apple-touch-icon은 64px 버전. → 단독 HTML 파일로 저장해도 이미지가 깨지지 않는다.
- 브랜드 텍스트: `ChoKo QUANT` — **C·K만 굵게(900) + 루비 레드(var(--ck-red))**, 나머지는 500.
- `CREATED BY JiHoon Park` 서명 배지는 **원본 디자인·필기체 그대로**(손대지 않는다). 옆에 `with ChoKo` 배지(C·K 강조) — 1180px 미만에서는 자리 확보를 위해 숨김.
- 헤더의 성향 스위치는 **1021~1699px에서 이모지를 접어** 검색창 폭을 확보한다(색으로 구분).

### 2-2. 메인 컬럼 순서 (2026-11-28 개편)
```
① #topCtl  1 성향 + 2 전략 통합 컨트롤  (+ #tcNow 요약)
   #riskBanner (공격형일 때만)
② #hero    종목 히어로: 티커·가격·차트점수 게이지 → 3줄 요약 → 거래량/W다이버전스 스트립 → 신규진입/보유관리 → 손익비
   .chart-card  메인 캔들 차트(툴바·드로잉·기간)
③ .macro-fg-grid  [왼쪽 #fgCard 공포·탐욕 시계] [오른쪽 #macroStrip 거시지표(VIX·금리·DXY·일정)]
④ #beginCard 초보자 3단계 → #fundCard 펀더멘털 → #noticeCard 운용원칙
⑤ #stratBar  하단 전략 비교(전략 버튼 + 성향 스위치 + 유니버스 평균)
⑥ #aggrCard → #btPeriod → #kpis → #seCard → #ewCard → #eduCard → #paperCard → #lower → #logCard
```
- 데스크톱(`≥1100px`)은 공포시계/거시지표 2열(`1fr 1.15fr`), 1100px 미만은 1열(공포시계 먼저).
- 1600×900 첫 화면: 헤더(72) + 통합 컨트롤(65) + 히어로(560) + 차트 상단까지 보인다.

### 2-3. 성향(안정형/공격형) — 3곳 동기화
| 위치 | id | 비고 |
|---|---|---|
| 헤더 | `#riskSwitch` | 항상 보이는 빠른 전환 |
| 상단 통합 컨트롤 | `#topRisk` | **1번째 선택** — 라벨 `1 성향` |
| 하단 전략 비교 바 | `#stratRisk` | 라벨 `1 성향` |

- 세 스위치는 모두 `[data-risk-btn="safe|aggr"]`이고, 클릭은 `.risk-switch` 위임, 상태 표시는 `renderRisk()`가 `$$('[data-risk-btn]')` 전체를 갱신 → **어느 것을 눌러도 3곳이 동시에 바뀐다**.
- 활성 색: 안정형 = 시안·에메랄드 그라데이션 + 밝은 테두리 글로우 / 공격형 = 레드·앰버 그라데이션 + 붉은 글로우.
- 성향이 바뀌면 `setRisk()` → `riskRebuild()`: 캐시(`cache`,`viewCache`,`winCache`,`uniCache`) 전부 폐기 후 재분석(152종목 약 1.5초), 진행 중인 유니버스 집계는 `uniGen`으로 무효화.

### 2-4. 전략(추세형/스윙형) — 2곳 동기화
| 위치 | id/class | 라벨 |
|---|---|---|
| 상단 통합 컨트롤 | `#topStratSeg.strat-seg` | `2 전략` · 📈 추세형(Top 100) / ⚡ 스윙형(Top 150) |
| 하단 전략 비교 바 | `#stratSeg.strat-seg` | 추세형(중기) / 스윙형(단기) |

- 클릭은 `$$('.strat-seg')` 위임 → `setStrategy(mode)`, 표시는 `renderStrategy()`가 `$$('.strat-seg button')`을 모두 갱신.
- `setStrategy()`는 ① `uniReset()`(프리셋·카운트 캐시 폐기) ② 추천순 정렬로 자동 전환 ③ **그 전략의 추천 1위 종목 자동 선택**(`topScoreT`) ④ 주소의 `#종목`·`?t=` 제거(자동 선택은 딥링크를 남기지 않음).

---

## 3. 상태 탭 · 프리셋 · 정렬

| 축 | 값 | 규칙 |
|---|---|---|
| 상태 탭 `#filterTabs` | 전체 / 매수 / 홀드 / 관망 / 매도 / 관심 | 카운트는 **현재 전략 유니버스 × 프리셋 ∩** 기준(`scanCounts(scoped)`) |
| 프리셋 `#presetTabs` | 시총Top30 · 실적우량 · 거래량 · 승률70% · W쌍바닥 · VCP · 삼각수렴 · 다이버전스 · 6M모멘텀(9개) | 상태 탭과 **교집합**. 프리셋을 켜면 카운트도 그 안에서 다시 센다 |
| 정렬 `#sortSel` | 추천순(점수)·시총순·수익률순·RSI 낮은순·등락률순 | 전략 버튼을 누르면 **추천순으로 자동 전환**(`adoptRecSort`) |

- 프리셋·카운트 캐시는 `uniReset()`에서 함께 폐기된다(전략이 바뀌면 유니버스가 바뀌므로).
- `승률70%`는 **선택 전략의 5년 백테스트 승률**(화면 기간과 무관), `6M모멘텀`은 126거래일 수익률 상위 5 — 둘 다 참고용이며 매매 규칙을 바꾸지 않는다.

## 4. 기간 동기화 · 자동 선택 · 딥링크

- 기간 버튼 `#btf`(3M·6M·1Y·2Y·5Y)는 **차트 표시 구간과 아래 백테스트 기간을 함께** 바꾼다(`setPeriod → applyBtPeriod`). `5Y = 1,255거래일`(워밍업 250봉 별도 보관).
- 유니버스 평균(`#stratUni`)은 `기간 × 전략 × 성향` 키로 캐시(`uniCache['성향|전략|bars']`), 8ms 단위로 나눠 계산해 UI가 멈추지 않는다.
- 자동 선택 `topScoreT()`: 스캐너와 **같은 필터·같은 비교 함수**(`scanRows` + `recCmp`)로 1위를 뽑는다 → 화면 1행과 항상 일치. 추세형은 tier→종합점수, 스윙형은 tier→적합도(RSI(2)·W·점수).
- 딥링크: `?t=종목`(초기 선택), `#종목`(직접 고른 종목만). 자동 선택·전략 전환 시에는 주소에 종목을 남기지 않는다.

## 5. 공포·탐욕 시계 · 엘리어트 · 차트

- `#fgCard`: CNN 공포·탐욕(내장값 + `fgRealtime()` 5분 주기 갱신). 실패 시 내장값 유지. 게이지·이력(1주/1개월/1년)·해석 박스.
- 엘리어트: `#ewCard` 기본/대안 시나리오 세그먼트. 엔진은 `engine.js`의 파동 카운트.
- 차트: 캔버스 1장(`#chart`) + HUD·MA 범례·드로잉 도구(추세선·수평선·피보나치). `window.APEX_DIAG`로 검증 스크립트가 축·라벨·오버랩을 읽는다.

## 6. 테마 · 성향 테마

- `data-theme="light"` + `localStorage['apex.theme.v1']`, 첫 페인트 전 `<head>` 스크립트로 적용(깜박임 방지).
- `data-risk="aggr"` + `localStorage['apex.risk.v1']` — 공격형은 붉은 테마 레이어(`html[data-risk="aggr"] …`)를 덧입힌다.
- 브랜딩 색: `--ck-red`(다크 #FF3B5C / 라이트 #D2103A). 성향 활성 그라데이션은 테마별로 동일(밝은 배경 위에서도 대비 확보).

## 7. 데이터 갱신 파이프라인

```
07:15 KST  stock_daily_update.sh
   git pull --ff-only
   python3 scripts/update_data.py     # top150.json → 152종목 수집
   python3 scripts/build.py           # index.html 재빌드
   git add scripts/data.js index.html && git commit && git push
```
- 휴장일: 값이 같으면 `NOCHANGE`(updatedAt만 기록).
- 수집 실패: `exit 2` → 기존 `data.js` 유지(화면 깨지지 않음).
- 시계열: 종목별 `off`(상장 전 오프셋) + `fill_forward` — 신규 상장(SNDK 등)도 캘린더에 정렬되고, 기간을 못 채운 종목은 유니버스 평균에서 제외된다.

## 8. 불변 규칙 (검수 체크리스트)

1. **추세형 수치는 기존과 동일해야 한다** — 102종목·5Y 유니버스 평균이 변경 전과 같아야 한다(2026-11-28 검증: `5Y 99종목 평균 +134.04% · 중앙 +67.60% · 보유 초과 50/99 · 평균 MDD −34.73% · 승률 53.2%` 동일).
2. **제목 = 실제 집합** — Top 100 ↔ 102종목, Top 150 ↔ 152종목. 한쪽만 바꾸지 않는다.
3. **서명 배지(`.sig-badge`)는 디자인 불변** — `with ChoKo`는 옆에 추가만 한다.
4. **성향·전략 스위치는 3곳/2곳이 항상 같은 상태** — 새 위치를 추가하면 `.risk-switch`/`.strat-seg` 클래스만 맞추면 자동 동기화된다.
5. **가로 넘침 0** — 390·480·640·768·900·1024·1180·1280·1366·1440·1500·1600·1920px에서 `document.scrollWidth == innerWidth`.
6. **콘솔 에러 0** — 성향/전략/테마 전 조합(2×2×2) × 데스크톱·모바일.
7. **검색은 152종목 전체**, 스캐너·집계는 전략 유니버스 — 이 둘을 섞지 않는다.
8. **빌드 산출물만 배포** — `index.html` 단일 파일. `downloads/미국주식-차트분석기.html`은 같은 파일의 사본(동기화 필요).
