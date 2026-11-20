# Phase 2.5 시작 시 진단

2026-11-20. 판정은 작업 시작 시점의 코드와 실제 Node 테스트 결과를 기준으로 합니다. PASS는 실행 증거가 있는 항목에만 사용합니다.

전체 코드 조사: `index.html`, `css/styles.css`, `js/data.js`, `js/state.js`, `js/storage.js`, `js/ui.js`, `js/app.js`, 추가 중이던 `config.js`, `ai.js`, 보류한 `social.js`, `dialogue.js`, 기존 테스트와 SVG 자산.

백업: `backups/pre-phase2-5-repair.zip`. Phase 3 초안은 `drafts/phase3/`로 옮겨 런타임에서 제외했습니다.

| 기능 | 시작 상태 | 근거 |
| --- | --- | --- |
| 게임 시작 | FAIL | `data.version`은 2로 변경되었으나 `state.valid`는 1만 허용하여 새 상태가 자체 검증에 실패함 |
| 6명 생성 | PARTIAL | 6명 소개 데이터는 생성하나 인간/AI·체력·탈락 정보가 없음 |
| 직업 배정 | MISSING | 모든 역할이 null |
| 공작원 1명 | MISSING | 배정 로직 없음 |
| 네 지역 지도 | PARTIAL | 기존 선택 UI는 있으나 전이 검증 실패로 현재 선택 동작 중단 |
| 실제 탐험 | MISSING | 계획 기록만 구현 |
| 자원 변화 | MISSING | 초기 숫자 표시만 있음 |
| AI 자동 행동 | PARTIAL | ai.js 초안은 있으나 HTML에 로드되지 않으며 엔진에 미연결 |
| 날짜 진행 | MISSING | day=1, phase=preparation에 고정 |
| 토론 | MISSING | 실행 가능한 토론 없음 |
| 투표·추방 | MISSING | 실행 가능한 투표 없음 |
| 밤 능력 | MISSING | 직업별 상태 변화 없음 |
| 승패 판정 | MISSING | 종료 규칙 없음 |
| 엔딩 화면 | MISSING | 화면 없음 |
| 저장·복원 | FAIL | 버전 충돌로 새 저장 불가. Phase 1 파일 저장도 브라우저 실검증 미완료 |

우선 수정: 스키마 버전 충돌 → 게임 상태/직업 → 단계별 행동 및 AI → 탐험·자원·능력 → 투표·종료 → UI·저장 → 자동 완주 및 브라우저 검증.

최종 실행 결과와 항목별 재판정은 `TESTING.md`에 기록합니다. 이 문서는 초기 실패 상태를 남기기 위해 보존합니다.
