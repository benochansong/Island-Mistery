# Phase 4 콘텐츠 목록

검증일: 2026-11-20. 실행 데이터 `js/story-data.js`에서 추출했습니다.

## 사건 처리 공통 규칙

모든 사건은 지정 날짜와 현재 행동 장소에 활동 중인 인물이 있어야 합니다. 야영지 사건은 활동 인물 중에서 선택합니다. 같은 사건은 한 게임에 한 번, 아침·낮 처리 뒤 각 한 번, 하루 최대 2회입니다. 관련 인물은 활동 중인 사람에서 선정하며 추가 인물이 없으면 위임 선택을 막습니다. 기본 가중치는 3, 35·36번은 6이며 후속 연결이 충족되면 가중치를 3배로 높입니다. 사건 선택은 자원·시설·체력·단서·관계·기억·분기 플래그에 반영됩니다.

공개 사건의 개인 단서 선택은 해당 인물만 단서를 얻습니다. 공개 선택을 하면 활동 중인 인물에게 공유합니다. 개인 사건의 존재와 선택 기록은 해당 인물만 보며, AI 사건은 자신이 아는 정보·성격·목표에 따라 자동 처리합니다.

조건의 `facility`/`resource`는 해당 수치가 양수, `food`/`active`는 최소 수량/인원입니다. `rumor`는 실제 공개된 의도적 거짓 주장, `conflict`는 같은 화자의 같은 시간대에 대한 서로 다른 공개 동선 주장입니다. `sabotage`는 활동 중인 공작원과 손상 가능한 시설이 있어야 합니다. `nearEscape`는 한 시설이 완성 기준의 70% 이상입니다. `anyFlags`/`notFlags`는 선행 선택 분기입니다. 개인 정보는 사건 엔진에서만 사용하며 AI에게 전달하지 않습니다.

## 36종 사건

### event-01 · 열대 폭풍

- 분류: 자연재해 / 장소: 통신탑 / 날짜: 1, 2, 3일차
- 조건: `{"facility":"radio"}` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 brace: 부품 1개로 통신탑 보강 · 수리도 +1. 비용: parts 1. 효과: `[{"type":"facility","key":"radio","amount":1}]`
- 선택 shelter: 대피 · 통신탑 -2, 식수 +2. 비용: 없음. 효과: `[{"type":"facility","key":"radio","amount":-2},{"type":"resource","key":"water","amount":2}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-02 · 정글을 삼킨 폭우

- 분류: 자연재해 / 장소: 정글 / 날짜: 1, 2일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 detour: 우회로 조사 · 체력 -8, 관측소 발견. 비용: 없음. 효과: `[{"type":"health","key":"actor","amount":-8},{"type":"unlock","key":"observatory","amount":1}]`
- 선택 wait: 내일까지 정글 수색을 중단 · 빗물 +3. 비용: 없음. 효과: `[{"type":"close","key":"jungle","amount":1},{"type":"resource","key":"water","amount":3}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-03 · 정체불명의 표류 상자

- 분류: 자연재해 / 장소: 해안가 / 날짜: 1, 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 open: 상자 열기 · 식량 +3, 부품 +1. 비용: 없음. 효과: `[{"type":"resource","key":"food","amount":3},{"type":"resource","key":"parts","amount":1}]`
- 선택 inspect: 운송 흔적 조사 · 동굴 발견. 비용: 없음. 효과: `[{"type":"unlock","key":"cave","amount":1},{"type":"clue","key":"cave","amount":1,"audience":"actor"}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-04 · 연구시설의 붕괴

- 분류: 자연재해 / 장소: 연구소 / 날짜: 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 rescue: 의약품 1개로 부상 예방 · 사고 기록 확보. 비용: medicine 1. 효과: `[{"type":"clue","key":"accident","amount":1,"audience":"actor"}]`
- 선택 search: 잔해 조사 · 체력 -15, 부품 +3. 비용: 없음. 효과: `[{"type":"health","key":"actor","amount":-15},{"type":"resource","key":"parts","amount":3}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-05 · 짙은 안개

- 분류: 자연재해 / 장소: 야영지 / 날짜: 1, 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 mark: 표식 설치 · 부품 1, 전원 식수 +3. 비용: parts 1. 효과: `[{"type":"resource","key":"water","amount":3},{"type":"flag","key":"safeTrail","amount":1}]`
- 선택 follow: 희미한 신호 추적 · 체력 -10, 무전 기록. 비용: 없음. 효과: `[{"type":"health","key":"actor","amount":-10},{"type":"clue","key":"signal","amount":1,"audience":"actor"}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-06 · 야생동물의 습격

- 분류: 자연재해 / 장소: 정글 / 날짜: 1, 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 bait: 식량 2개로 유인 · 의약품 +1. 비용: food 2. 효과: `[{"type":"resource","key":"medicine","amount":1}]`
- 선택 flee: 도망친다 · 체력 -12, 식량 +1. 비용: 없음. 효과: `[{"type":"health","key":"actor","amount":-12},{"type":"resource","key":"food","amount":1}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-07 · 식량 저장고 파손

- 분류: 생존 자원 / 장소: 야영지 / 날짜: 1, 2, 3일차
- 조건: `{"resource":"food"}` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 fix: 부품 1개로 수리 · 저장고 보호. 비용: parts 1. 효과: `[{"type":"flag","key":"storeProtected","amount":1},{"type":"resource","key":"food","amount":1}]`
- 선택 salvage: 남은 식량 옮기기 · 식량 -2, 부품 +1. 비용: 없음. 효과: `[{"type":"resource","key":"food","amount":-2},{"type":"resource","key":"parts","amount":1}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-08 · 식수 오염 의심

- 분류: 생존 자원 / 장소: 야영지 / 날짜: 1, 2, 3일차
- 조건: `{"resource":"water"}` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 purify: 의약품 1개로 정수 · 식수 +1. 비용: medicine 1. 효과: `[{"type":"resource","key":"water","amount":1},{"type":"flag","key":"purified","amount":1}]`
- 선택 discard: 오염 의심 식수 3개 폐기. 비용: 없음. 효과: `[{"type":"resource","key":"water","amount":-3}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-09 · 숨겨진 의료 상자

- 분류: 생존 자원 / 장소: 연구소 / 날짜: 1, 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 share: 공동 의료품 +3 · 협력 기록. 비용: 없음. 효과: `[{"type":"resource","key":"medicine","amount":3},{"type":"relation","key":"subject","amount":8,"suspicion":-3}]`
- 선택 study: 의료품 +1 · 기억 실험 절차서 확보. 비용: 없음. 효과: `[{"type":"resource","key":"medicine","amount":1},{"type":"clue","key":"protocol","amount":1,"audience":"actor"}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-10 · 난파선의 부품

- 분류: 생존 자원 / 장소: 해안가 / 날짜: 1, 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 recover: 부품 +4 · 체력 -8. 비용: 없음. 효과: `[{"type":"resource","key":"parts","amount":4},{"type":"health","key":"actor","amount":-8}]`
- 선택 chart: 통로 조사 · 비밀 동굴 개방. 비용: 없음. 효과: `[{"type":"unlock","key":"cave","amount":1},{"type":"clue","key":"cave","amount":1,"audience":"actor"}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-11 · 사라진 비상식량

- 분류: 생존 자원 / 장소: 야영지 / 날짜: 1, 2, 3일차
- 조건: `{"food":2,"active":2}` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 audit: 창고 조사 · 식량 1 회수, 불확실한 흔적. 비용: 없음. 효과: `[{"type":"resource","key":"food","amount":1},{"type":"trace","key":"subject","amount":1}]`
- 선택 ration: 공동 식량 +2 확보 · 범인 추적 보류. 비용: 없음. 효과: `[{"type":"resource","key":"food","amount":2},{"type":"flag","key":"theftIgnored","amount":1}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-12 · 오래된 비상 보급품

- 분류: 생존 자원 / 장소: 정글 / 날짜: 1, 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 collect: 식량 +2, 식수 +2. 비용: 없음. 효과: `[{"type":"resource","key":"food","amount":2},{"type":"resource","key":"water","amount":2}]`
- 선택 read: 보급품 운송 메모와 의료품 +1. 비용: 없음. 효과: `[{"type":"clue","key":"cipher","amount":1,"audience":"actor"},{"type":"resource","key":"medicine","amount":1}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-13 · 비밀 실험 문서

- 분류: 미스터리 / 장소: 연구소 / 날짜: 1, 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 개인 / 후속 연결: event-31
- 선택 public: 모두에게 절차서 공개. 비용: 없음. 효과: `[{"type":"clue","key":"protocol","amount":1,"audience":"public"},{"type":"relation","key":"subject","amount":8,"suspicion":-3}]`
- 선택 private: 혼자 문서를 확보 · 체력 -5. 비용: 없음. 효과: `[{"type":"clue","key":"protocol","amount":1,"audience":"actor"},{"type":"health","key":"actor","amount":-5}]`
- 선택 delegate: 동료에게 조사를 맡긴다 · 공개 여부는 동료가 결정. 비용: 없음. 효과: `[{"type":"clue","key":"protocol","amount":1,"audience":"actor"}]` · 동료가 자신의 목표와 협력 성향으로 공개 여부 결정
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-14 · 정체불명의 무전 신호

- 분류: 미스터리 / 장소: 통신탑 / 날짜: 1, 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: event-29
- 선택 decode: 부품 1개로 해독 · 공개 주파수 기록. 비용: parts 1. 효과: `[{"type":"clue","key":"signal","amount":1,"audience":"public"},{"type":"flag","key":"signalDecoded","amount":1}]`
- 선택 record: 개인 수첩에 신호 기록. 비용: 없음. 효과: `[{"type":"clue","key":"signal","amount":1,"audience":"actor"}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-15 · 지하실 출입 기록

- 분류: 미스터리 / 장소: 연구소 / 날짜: 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 개인 / 후속 연결: event-31
- 선택 copy: 출입 기록 복사 · 지하실 개방. 비용: 없음. 효과: `[{"type":"clue","key":"access","amount":1,"audience":"actor"},{"type":"unlock","key":"basement","amount":1}]`
- 선택 delegate: 동료에게 검증을 맡긴다. 비용: 없음. 효과: `[{"type":"clue","key":"access","amount":1,"audience":"actor"}]` · 동료가 자신의 목표와 협력 성향으로 공개 여부 결정
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-16 · 암호화된 메모

- 분류: 미스터리 / 장소: 정글 / 날짜: 1, 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 개인 / 후속 연결: 없음
- 선택 solve: 식량 1개를 쓰며 해독 · 관측소 발견. 비용: food 1. 효과: `[{"type":"clue","key":"cipher","amount":1,"audience":"actor"},{"type":"unlock","key":"observatory","amount":1}]`
- 선택 publish: 암호 메모를 모두에게 공개. 비용: 없음. 효과: `[{"type":"clue","key":"cipher","amount":1,"audience":"public"}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-17 · 생존자의 이름이 적힌 명단

- 분류: 미스터리 / 장소: 연구소 / 날짜: 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 개인 / 후속 연결: event-32
- 선택 show: 명단 공개 · 인물과 시설의 연관 확인. 비용: 없음. 효과: `[{"type":"clue","key":"manifest","amount":1,"audience":"public"},{"type":"flag","key":"manifestPublic","amount":1}]`
- 선택 keep: 명단을 혼자 보관. 비용: 없음. 효과: `[{"type":"clue","key":"manifest","amount":1,"audience":"actor"}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-18 · 과거 사고 기록

- 분류: 미스터리 / 장소: 해안가 / 날짜: 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: event-36
- 선택 recover: 식수 1개를 쓰며 기록 복원. 비용: water 1. 효과: `[{"type":"clue","key":"accident","amount":1,"audience":"actor"},{"type":"flag","key":"accidentRecovered","amount":1}]`
- 선택 share: 남은 사고 기록 공개. 비용: 없음. 효과: `[{"type":"clue","key":"accident","amount":1,"audience":"public"}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-19 · 엇갈린 소문의 확산

- 분류: 심리전 / 장소: 야영지 / 날짜: 2, 3일차
- 조건: `{"rumor":true}` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 verify: 원래 발언과 대조 · 신뢰할 수 없는 소문은 유보. 비용: 없음. 효과: `[{"type":"rumor","key":"verify","amount":1},{"type":"flag","key":"rumorChecked","amount":1}]`
- 선택 repeat: 소문을 전달 · 사실로 확정하지 않음. 비용: 없음. 효과: `[{"type":"rumor","key":"repeat","amount":1}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-20 · 익명의 고발장

- 분류: 심리전 / 장소: 야영지 / 날짜: 1, 2, 3일차
- 조건: `{"active":2}` / 기본 가중치: 3
- 사건 기록 공개 범위: 개인 / 후속 연결: 없음
- 선택 read: 불확실한 고발 내용을 개인적으로 검토. 비용: 없음. 효과: `[{"type":"trace","key":"subject","amount":0.35}]`
- 선택 reject: 증거 부족을 알리고 고발 대상 변호. 비용: 없음. 효과: `[{"type":"relation","key":"subject","amount":6,"suspicion":-3},{"type":"flag","key":"anonymousRejected","amount":1}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-21 · 생존자의 물건 실종

- 분류: 심리전 / 장소: 야영지 / 날짜: 1, 2, 3일차
- 조건: `{"active":2}` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 help: 식량 1개를 쓰며 함께 수색 · 신뢰 상승. 비용: food 1. 효과: `[{"type":"relation","key":"subject","amount":10,"suspicion":-2},{"type":"flag","key":"itemReturned","amount":1}]`
- 선택 suspect: 분실 경위를 추궁 · 신뢰 하락, 의심 증가. 비용: 없음. 효과: `[{"type":"relation","key":"subject","amount":-5,"suspicion":5}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-22 · 서로 충돌하는 증언

- 분류: 심리전 / 장소: 야영지 / 날짜: 2, 3일차
- 조건: `{"conflict":true}` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 compare: 기존 발언을 함께 비교 · 모순 기록 확보. 비용: 없음. 효과: `[{"type":"rumor","key":"compare","amount":1},{"type":"flag","key":"testimonyCompared","amount":1}]`
- 선택 defer: 검증을 유보 · 대상과 관계 회복. 비용: 없음. 효과: `[{"type":"relation","key":"subject","amount":4,"suspicion":-2}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-23 · 은밀한 추적

- 분류: 심리전 / 장소: 정글 / 날짜: 2, 3일차
- 조건: `{"active":2}` / 기본 가중치: 3
- 사건 기록 공개 범위: 개인 / 후속 연결: 없음
- 선택 follow: 체력 -8 · 실제 과거 동선의 흔적 확보. 비용: 없음. 효과: `[{"type":"health","key":"actor","amount":-8},{"type":"pastLocation","key":"subject","amount":1}]`
- 선택 talk: 추적을 밝히고 대화 · 신뢰 +5. 비용: 없음. 효과: `[{"type":"relation","key":"subject","amount":5,"suspicion":-1}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-24 · 비밀 협력 제안

- 분류: 심리전 / 장소: 야영지 / 날짜: 1, 2, 3일차
- 조건: `{"active":2}` / 기본 가중치: 3
- 사건 기록 공개 범위: 개인 / 후속 연결: 없음
- 선택 ally: 물자 1개씩 나누며 협력 · 상호 신뢰 상승. 비용: food 1, water 1. 효과: `[{"type":"relation","key":"subject","amount":12,"suspicion":-4},{"type":"flag","key":"alliance","amount":1}]`
- 선택 decline: 거리를 둔다 · 물자 보존, 신뢰 하락. 비용: 없음. 효과: `[{"type":"relation","key":"subject","amount":-3,"suspicion":0}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-25 · 통신탑 전력 중단

- 분류: 시설 및 탈출 / 장소: 통신탑 / 날짜: 1, 2, 3일차
- 조건: `{"facility":"radio"}` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 restore: 부품 2개로 우회 전원 · 수리도 +2. 비용: parts 2. 효과: `[{"type":"facility","key":"radio","amount":2},{"type":"unlock","key":"equipment","amount":1}]`
- 선택 stop: 전원을 차단 · 수리도 -2, 부품 +1. 비용: 없음. 효과: `[{"type":"facility","key":"radio","amount":-2},{"type":"resource","key":"parts","amount":1}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-26 · 보트 엔진 고장

- 분류: 시설 및 탈출 / 장소: 해안가 / 날짜: 1, 2, 3일차
- 조건: `{"facility":"boat"}` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 repair: 부품 2개로 엔진 복구 · 보트 +2. 비용: parts 2. 효과: `[{"type":"facility","key":"boat","amount":2}]`
- 선택 strip: 엔진 분해 · 보트 -3, 부품 +2. 비용: 없음. 효과: `[{"type":"facility","key":"boat","amount":-3},{"type":"resource","key":"parts","amount":2}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-27 · 구조 신호 송신 가능성

- 분류: 시설 및 탈출 / 장소: 통신탑 / 날짜: 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 send: 부품 1개로 신호 증폭 · 통신탑 +3. 비용: parts 1. 효과: `[{"type":"facility","key":"radio","amount":3},{"type":"flag","key":"rescueSignal","amount":1}]`
- 선택 check: 주파수를 먼저 확인. 비용: 없음. 효과: `[{"type":"clue","key":"signal","amount":1,"audience":"actor"},{"type":"unlock","key":"equipment","amount":1}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-28 · 비상 발전기의 재가동

- 분류: 시설 및 탈출 / 장소: 연구소 / 날짜: 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: event-31
- 선택 power: 부품 1개 사용 · 통신탑 +2, 발전기 연결. 비용: parts 1. 효과: `[{"type":"facility","key":"radio","amount":2},{"type":"flag","key":"generator","amount":1}]`
- 선택 salvage: 발전기 분해 · 부품 +3, 재가동 포기. 비용: 없음. 효과: `[{"type":"resource","key":"parts","amount":3},{"type":"flag","key":"generatorLost","amount":1}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-29 · 수평선의 선박 불빛

- 분류: 시설 및 탈출 / 장소: 해안가 / 날짜: 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 flash: 부품 1개로 신호 · 보트 +2. 비용: parts 1. 효과: `[{"type":"facility","key":"boat","amount":2},{"type":"flag","key":"shipContact","amount":1}]`
- 선택 observe: 배의 무전을 비교 · 출항 경고 확보. 비용: 없음. 효과: `[{"type":"clue","key":"exitRisk","amount":1,"audience":"actor"}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-30 · 고의로 손상된 탈출 장비

- 분류: 시설 및 탈출 / 장소: 야영지 / 날짜: 2, 3일차
- 조건: `{"sabotage":true}` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 inspect: 손상 흔적 조사 · 범인의 역할은 알 수 없음. 비용: 없음. 효과: `[{"type":"trace","key":"subject","amount":0.7}]`
- 선택 patch: 부품 1개로 긴급 보수 · 손상 시설 +2. 비용: parts 1. 효과: `[{"type":"damagedRepair","key":"facility","amount":2}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-31 · 지하 연구실의 숨겨진 문

- 분류: 특별 스토리 / 장소: 연구소 / 날짜: 2, 3일차
- 조건: `{"anyFlags":["generator","resolved:event-13","resolved:event-15"],"notFlags":["generatorLost"]}` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: event-36
- 선택 open: 부품 1개로 문 개방 · 지하실과 자료 발견. 비용: parts 1. 효과: `[{"type":"unlock","key":"basement","amount":1},{"type":"clue","key":"archive","amount":1,"audience":"actor"},{"type":"flag","key":"doorOpened","amount":1}]`
- 선택 delegate: 동료에게 우회 통로 조사를 맡긴다. 비용: 없음. 효과: `[{"type":"unlock","key":"basement","amount":1},{"type":"clue","key":"access","amount":1,"audience":"actor"}]` · 동료가 자신의 목표와 협력 성향으로 공개 여부 결정
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-32 · 시설과 연결된 생존자

- 분류: 특별 스토리 / 장소: 연구소 / 날짜: 2, 3일차
- 조건: `{"active":2}` / 기본 가중치: 3
- 사건 기록 공개 범위: 개인 / 후속 연결: 없음
- 선택 ask: 실제 서명자의 동의서를 공개 · 역할 단정 금지. 비용: 없음. 효과: `[{"type":"clue","key":"staffLink","amount":1,"audience":"public"},{"type":"trace","key":"subject","amount":0.3}]`
- 선택 protect: 개인적으로 동의서 보관 · 대상과 신뢰 형성. 비용: 없음. 효과: `[{"type":"clue","key":"staffLink","amount":1,"audience":"actor"},{"type":"relation","key":"subject","amount":6,"suspicion":-2}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-33 · 과거 참가자의 음성

- 분류: 특별 스토리 / 장소: 정글 / 날짜: 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 개인 / 후속 연결: 없음
- 선택 play: 기록 공개 · 관측소 개방. 비용: 없음. 효과: `[{"type":"clue","key":"voice","amount":1,"audience":"public"},{"type":"unlock","key":"observatory","amount":1}]`
- 선택 keep: 혼자 음성 분석 · 미공개 자료 확보. 비용: 없음. 효과: `[{"type":"clue","key":"voice","amount":1,"audience":"actor"},{"type":"clue","key":"archive","amount":1,"audience":"actor"}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-34 · 섬을 감시하는 장치

- 분류: 특별 스토리 / 장소: 통신탑 / 날짜: 2, 3일차
- 조건: `추가 조건 없음` / 기본 가중치: 3
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 disable: 부품 1개로 감시 신호 차단 · 설계도 확보. 비용: parts 1. 효과: `[{"type":"clue","key":"watcher","amount":1,"audience":"actor"},{"type":"flag","key":"watcherDisabled","amount":1}]`
- 선택 trace: 신호 기록 · 지하 장비실 개방. 비용: 없음. 효과: `[{"type":"clue","key":"watcher","amount":1,"audience":"actor"},{"type":"unlock","key":"equipment","amount":1}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-35 · 탈출 직전의 진실

- 분류: 특별 스토리 / 장소: 야영지 / 날짜: 1, 2, 3일차
- 조건: `{"nearEscape":true}` / 기본 가중치: 6
- 사건 기록 공개 범위: 공개 / 후속 연결: 없음
- 선택 read: 출항 기록을 확인한다. 비용: 없음. 효과: `[{"type":"clue","key":"exitRisk","amount":1,"audience":"public"},{"type":"flag","key":"exitRead","amount":1}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

### event-36 · 연구시설의 마지막 기록

- 분류: 특별 스토리 / 장소: 연구소 / 날짜: 3일차
- 조건: `{"anyFlags":["doorOpened","truthLinked"]}` / 기본 가중치: 6
- 사건 기록 공개 범위: 개인 / 후속 연결: 없음
- 선택 broadcast: 식수 1개 사용 · 마지막 기록 공개. 비용: water 1. 효과: `[{"type":"clue","key":"final","amount":1,"audience":"public"},{"type":"flag","key":"truthPublic","amount":1}]`
- 선택 keep: 마지막 기록을 개인적으로 보관. 비용: 없음. 효과: `[{"type":"clue","key":"final","amount":1,"audience":"actor"},{"type":"flag","key":"truthPrivate","amount":1}]`
- 선택 leave: 위험을 피하고 지나간다 · 후속 기회를 포기. 비용: 없음. 효과: `[{"type":"flag","key":"declined","amount":1}]`

## 개인 목표 12종

| ID | 목표 | 달성 조건 | 점수 |
| --- | --- | --- | --- |
| protect | 끝까지 보호하기 | 지정된 동료가 활동 가능한 상태로 결말에 도달하기 | 100 |
| document | 실험 문서 확보 | 기억 실험 절차서 또는 연구 자료 확보하기 | 100 |
| medicine | 의료품 조달 | 자신의 행동으로 의약품 3개 이상 공동 창고에 확보하기 | 100 |
| conceal | 기록을 숨겨 지키기 | 개인 단서 1개 이상을 공개하지 않고 결말에 도달하기 | 100 |
| access | 출입 기록 추적 | 지하 연구실 출입 기록 확보하기 | 100 |
| trust | 신뢰 얻기 | 지정된 동료가 자신을 신뢰하도록 실제 협력하기 (신뢰 70) | 100 |
| radio | 통신 복구 참여 | 자신의 행동으로 통신탑 수리도 누적 3 이상 올리기 | 100 |
| risk | 위험을 넘어 | 정글과 숨겨진 장소를 탐험하고 살아서 결말에 도달하기 | 100 |
| truth | 사고의 진상 | 실험 절차서·명단·사고 기록을 모두 확보하기 | 100 |
| escapeTogether | 함께 탈출하기 | 지정된 동료와 활동 가능한 상태로 생존자 진영 승리하기 | 100 |
| archive | 연구 자료 수집 | 서로 다른 스토리 단서 4개 이상 확보하기 | 100 |
| cover | 의혹을 피하기 | 활동 가능한 상태로 결말에 도달하며 다른 인물의 자신에 대한 의심이 모두 60 미만이기 | 100 |

## 숨겨진 장소 4곳

| 장소 | 기존 지역 | 단서 | 확보 자원 | 함정 피해 |
| --- | --- | --- | --- | --- |
| 연구소 지하실 | 연구소 | 미공개 연구 자료 | {"medicine":2,"parts":2} | 40% 확률로 체력 -16 |
| 오래된 관측소 | 정글 | 관측소의 지도 | {"food":3,"medicine":1} | 40% 확률로 체력 -12 |
| 해안 비밀 동굴 | 해안가 | 동굴의 운송 기록 | {"water":3,"parts":2} | 40% 확률로 체력 -10 |
| 지하 장비실 | 통신탑 | 장비실의 회로도 | {"parts":4} | 40% 확률로 체력 -14 |

지역 첫 탐험은 40% 확률, 해당 인물의 같은 지역 재탐험은 확정으로 숨겨진 장소를 개방합니다. 선택형 사건으로도 개방할 수 있습니다. 각 인물은 장소별 한 번만 세부 탐험을 수행합니다.

## 세계관 단서 16개

| 기록 | 내용 |
| --- | --- |
| 찢어진 안내문 | 이 섬은 기억 회복 프로그램의 격리 관측소였다. 의료 연구와 감시가 함께 이루어졌다. |
| 기억 실험 절차서 | 연구진은 기억을 지우는 대신 특정 기억에 접근하지 못하도록 신호를 사용했다. 강한 감정은 차단을 깨뜨렸다. |
| 여섯 명의 명단 | 여섯 명은 서로 다른 사유로 기억 회복 프로그램에 등록했다. 명단 자체는 현재의 공작원 신분을 증명하지 않는다. |
| 지하실 출입 기록 | 사고 당일 연구진은 지하실에서 긴급 정지를 시도했다. 마지막 출입 뒤 보조 통로를 통해 철수했다. |
| 정지 명령 기록 | 기억 신호가 통제 범위를 벗어나자 연구진은 시설을 폐쇄하고 철수했다. 외부 계약자는 실험 자료 회수를 지시했다. |
| 반복되는 무전 | 구조 주파수와 자료 회수 주파수는 다르다. 모든 응답이 구조선에서 온 것은 아니다. |
| 암호 해독 메모 | 암호에는 비상 정지 순서와 기록 보관함의 위치가 적혀 있다. |
| 참가자의 음성 | 한 참가자는 기억 회복을 원했지만 통제 실험에는 동의하지 않았다고 증언했다. |
| 감시 장치 설계도 | 남아 있는 장치는 사람을 추적하고 신호를 외부로 전송한다. 연구진이 아직 섬에 있다는 증거는 아니다. |
| 출항 경고 | 기억 신호는 섬 밖에서 약해지지만 기록을 회수하려는 조직은 남아 있다. 탈출과 사건의 완전한 해결은 다르다. |
| 연구시설의 마지막 기록 | 기억 차단 실패로 연구진은 철수했다. 여섯 참가자는 뒤에 남겨졌고, 자료 회수를 맡은 공작원은 탈출을 지연시키고 있다. 구조 주파수를 사용하면 탈출은 가능하다. |
| 시설과의 연결 | 발견된 동의서에는 현재 생존자 한 명의 서명이 있다. 참가자·보조자·방문자 모두 서명했으므로 역할을 단정할 수 없다. |
| 동굴의 운송 기록 | 해안 동굴은 비상 보급과 자료 운송에 쓰였다. |
| 관측소의 지도 | 정글 관측소는 기억 신호의 범위를 측정했다. |
| 장비실의 회로도 | 구조 송신기와 실험 신호 발생기는 별도 회로다. 구조 송신기를 복구해도 실험을 재개하지 않는다. |
| 미공개 연구 자료 | 연구진은 참가자 동의와 실제 실험 범위가 달랐음을 내부 보고서에 남겼다. |
