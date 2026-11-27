# 미국주식 차트분석기

102개 미국 종목(대형주 100 + NKE, QQQ)의 최근 1,505 일봉(2020-11-30~2026-11-25)을 한 화면에서 보는 단일 HTML 차트 분석 도구입니다.
이 중 **앞쪽 250봉은 지표 워밍업**, 뒤쪽 **1,255거래일(2021-11-26~2026-11-25, 정확히 5년)** 이 추세형·스윙형 백테스트 구간입니다 — 2022년 하락장이 포함됩니다.
거시 지표(VIX · 미 10년물 금리), **CNN 공포·탐욕 지수(Fear & Greed) 반원 게이지와 상황별 심리 해석**, 종목별 펀더멘털(Forward/Trailing PER, 매출성장률, 애널리스트 목표가, 배당수익률, 52주 범위)을 함께 보여줍니다.
엘리엇 파동 심층분석, 작도 도구, 일목균형표, 이동평균, 거래량 분석을 포함합니다.
W 쌍바닥(이중 바닥)은 차트에 L1 → 넥라인 → L2 → 돌파 W자 선과 라벨로 표시되고(토글 · 기본 ON, 브라우저에 저장),
스캐너 프리셋 `W 쌍바닥`으로 마지막 종가 기준 돌파·임박·진행 종목만 추려 볼 수 있으며,
스캐너의 상단 탭(전체 · 매수 신호 · 매도 신호 · 관심)과 5개 프리셋(시총 Top 30 · 실적 우량주 · W 쌍바닥 · VCP · 삼각수렴)은 서로 독립이라
프리셋 하나를 켠 채 매수/매도/관심 탭을 눌러 **교집합**으로 좁힐 수 있습니다(같은 프리셋을 다시 누르면 해제).
스윙형 전략에는 `QQQ > 200일선`에서 W 넥라인 상향 돌파를 받는 보조 진입 루트가 들어 있고(99종목 5년 평균 +98.59%),
청산은 이익 +5% 이상에서 종가가 20일선 아래로 **2거래일 연속** 마감해야 발동합니다(하루 이탈은 넘김).
추세형은 QQQ 위험 0%의 전량 청산을 **진입 3거래일 이후**에만 발동해 1~2일 왕복 매매를 없앴습니다(손절 6 ATR·트레일 10 ATR은 즉시).

- 앱: https://sky1856.github.io/Us-stock-chart/
- 받아서 쓰기: 저장소의 `index.html` 파일 하나만 내려받아도 동작합니다(외부 의존성 없음).

## 자동 갱신

미국 증시 마감 후 매일 아침(KST) 최신 일봉으로 `scripts/data.js` 와 `index.html` 이 다시 만들어져 커밋됩니다.
갱신은 `scripts/update_data.py`(Yahoo Finance 10년 일봉을 받아 최근 1,505봉만 유지 + `^VIX`·`^TNX` + 펀더멘털 + CNN 공포·탐욕 지수 수집 → `data.js`) → `scripts/build.py`(`index.html` 재생성) 순서로 돌고,
GitHub Pages 가 `main` 브랜치를 그대로 배포하므로 커밋 후 몇 분 안에 사이트에 반영됩니다.

공포·탐욕 지수는 `window.MARKET.fearGreed`(현재 점수·등급·직전 마감·1주/1개월/1년 전·갱신 시각)로 `data.js` 에 들어갑니다.
페이지를 열면 이 값으로 즉시 그린 뒤, 브라우저에서 CNN API(`production.dataviz.cnn.io`)를 한 번 더 시도해 성공하면 `실시간`으로 바꿔 그립니다(4초 타임아웃, 실패·CORS 차단 시 조용히 `일일 갱신` 값 유지).
CNN API 가 일시에 실패해도 `update_data.py` 는 기존 `data.js` 의 `fearGreed` 를 그대로 이어 씁니다.

GitHub Actions 로 돌리고 싶다면 `docs/update-stocks.yml` 을 `.github/workflows/update-stocks.yml` 로 옮기면 됩니다
(화~토 21:30 UTC = 수~일 06:30 KST 자동 실행 + 수동 실행 버튼).

## 구조

```
index.html                  배포되는 단일 파일 앱 (scripts/ 조각들을 합친 결과물)
scripts/
  update_data.py            Yahoo Finance 10년 일봉 → 최근 1,505봉(5년+워밍업) + VIX·US10Y + 펀더멘털 → data.js 생성
  build.py                  template + data + engine + ui → index.html
  template.html  ui.css  engine.js  ui.js  data.js  top100.json
docs/update-stocks.yml      GitHub Actions 워크플로 템플릿
```

## 로컬에서 갱신하기

```bash
python scripts/update_data.py   # 인터넷 필요, 102종목 10년 일봉 → 최근 1,505봉 + 거시지표 + 펀더멘털 수집 후 data.js 갱신
python scripts/build.py         # index.html 재생성
```

`update_data.py` 는 일부 종목 수집에 실패하면 기존 `data.js` 를 그대로 두고 경고만 출력합니다(사이트는 이전 데이터로 정상 동작).
