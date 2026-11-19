# 말씀알림

어르신이 혼자서도 쓸 수 있는 가장 쉬운 성경 앱(가칭). 우리 교회 목사님의 매일 묵상을 큰 글씨 글자로 받아 읽고 듣고, 주일에는 목사님이 지정한 설교 본문이 첫 화면에 바로 뜹니다.

## 현재 상태

기획 단계입니다. 앱 코드는 아직 없습니다.

- 기획과 결정 사항 전체: [docs/handoff.md](docs/handoff.md)
- 개발용 성경 DB 만들기: [scripts/build_bible_db.py](scripts/build_bible_db.py)

## 확정된 방향

| 항목 | 결정 |
| --- | --- |
| 배포 | 앱스토어·구글 플레이 앱 (Expo, React Native + TypeScript) |
| 알림 | 앱 푸시 (Firebase 주제 구독, GitHub Actions가 매일 발송) |
| 서버 | 없음. GitHub Pages·Actions만 사용 |
| 성경 판본 | 개역개정 (대한성서공회 허가 필요. 허가 전에는 개역한글로 개발) |
| 성경 데이터 | 설치 후 와이파이에서 한 번만 받는 2차 다운로드 |
| 카카오톡 | 단톡방 공유만 (휴대폰 기본 공유 창) |

## 개발용 성경 DB

```bash
python3 scripts/build_bible_db.py
```

`data/bible.sqlite`가 만들어집니다(개역한글 + KJV, 전문 검색 색인 포함, 약 29MB). 이 파일은 저장소에 올리지 않습니다.
