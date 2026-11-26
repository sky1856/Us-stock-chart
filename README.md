# 미국주식 차트분석기

102개 미국 종목(대형주 100 + NKE, QQQ)의 최근 2년 일봉을 한 화면에서 보는 단일 HTML 차트 분석 도구입니다.
엘리어트 파동 심층분석, 작도 도구, 일목균형표, 이동평균, 거래량 분석을 포함합니다.

- 앱: https://sky1856.github.io/Us-stock-chart/
- 받아서 쓰기: 저장소의 `index.html` 파일 하나만 내려받아도 동작합니다(외부 의존성 없음).

## 자동 갱신

`.github/workflows/update-stocks.yml` 이 미국 증시 마감 후(화~토 21:30 UTC = 수~일 06:30 KST)에
Yahoo Finance 에서 최신 일봉을 받아 `scripts/data.js` 를 다시 만들고 `index.html` 을 재빌드해 자동 커밋합니다.
저장소 Actions 탭에서 **Run workflow** 로 즉시 실행할 수도 있습니다.

## 구조

```
index.html                  배포되는 단일 파일 앱 (scripts/ 조각들을 합친 결과물)
scripts/
  update_data.py            Yahoo Finance 2년 일봉 수집 → data.js 생성
  build.py                  template + data + engine + ui → index.html
  template.html  ui.css  engine.js  ui.js  data.js  top100.json
.github/workflows/update-stocks.yml
```

## 로컬에서 갱신하기

```bash
python scripts/update_data.py   # 인터넷 필요, 102종목 수집 후 data.js 갱신
python scripts/build.py         # index.html 재생성
```

`update_data.py` 는 일부 종목 수집에 실패하면 기존 `data.js` 를 그대로 두고 경고만 출력합니다(사이트는 이전 데이터로 정상 동작).
