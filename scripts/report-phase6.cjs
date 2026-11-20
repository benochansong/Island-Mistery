// Regenerate tables directly from measured artifacts; no synthetic measurements.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=n=>JSON.parse(fs.readFileSync(path.join(root,'docs',n),'utf8'));
const before=read('phase6-before.json'),after=read('phase6-after.json'),strategies=read('phase6-strategies.json'),browser=read('phase6-browser-results.json'),features=read('phase6-browser-features.json');
for(const r of [before,after,strategies])assert.equal(r.errors.length,0);
assert.equal(browser.scenarios.length,5);assert.equal(browser.failures.length,0);assert.equal(features.errors.length,0);
const n=x=>Number(x).toFixed(2),pct=(a,b)=>n(100*a/b)+'%',row=a=>'| '+a.join(' | ')+' |',table=(head,rows)=>[row(head),row(head.map(()=>'---')),...rows.map(row)].join('\n');
const roles={explorer:'탐험가',doctor:'의사',engineer:'기술자',investigator:'조사관',saboteur:'공작원'};
const phases={morning:'탐험',afternoon:'비밀 임무',discussion:'토론',voting:'투표',night:'밤 행동','night-settlement':'밤 정산 NEXT (관전 AI 처리 포함)'};
const means=values=>values.reduce((a,b)=>a+b,0)/values.length;
const innocent=r=>r.runs.reduce((n,r)=>n+r.exiles.filter(p=>p.role!=='saboteur').length,0);
const difficultyRows=Object.entries(after.byDifficulty).map(([d,r])=>{const runs=strategies.runs.filter(r=>r.difficulty===d),lies=runs.reduce((n,r)=>n+r.lieStatements,0),detected=runs.reduce((n,r)=>n+r.detectedLies,0);return[d,r.games,r.wins.survivors,r.wins.saboteur,n(r.averageDay),pct(r.spyExileRate,1),`${detected}/${lies}`];});
const eventRows=Object.keys(after.events).map(id=>[id,before.events[id],after.events[id]]);
const roleRows=Object.keys(roles).map(id=>{const b=before.roles[id],a=after.roles[id];return[roles[id],a.actors,`${n(b.resourceGain/b.actors)} → ${n(a.resourceGain/a.actors)}`,`${n(b.repairPoints/b.actors)} → ${n(a.repairPoints/a.actors)}`,a.heals,a.investigations,a.storyClues,a.exiles];});
const uiGroups={};for(const t of browser.timings){const k=t.phase+(t.phase==='night'&&t.type==='NEXT'?'-settlement':'');(uiGroups[k]||=[]).push(t.ms);}
const audit=[
 ['6인 싱글플레이','PASS','PASS','시드별 인간 1명·AI 5명, 전이·완주 검사'],
 ['직업·공작원 배정','PASS','PASS','200개 초기화 회귀 + 300개 고정 역할 사례'],
 ['3일 진행','PASS','PASS','모든 단계 저장 복원·마지막 밤·관전 검사'],
 ['탐험·자원','PASS','PASS','실제 획득/부상, 중복 정산 금지, 0 하한'],
 ['AI 성격·기억','PARTIAL','PASS','성격은 작동했으나 임무 우선순위·좌석 편향 수정'],
 ['신뢰·의심','PASS','PASS','개인별 변화와 동일 원인 중복 적용 방지'],
 ['거짓말·정보 조작','FAIL','PASS','발언자의 비공개 증거 보유 여부가 청자 판단에 전달되는 경로 수정'],
 ['토론·투표','PARTIAL','PASS','집계는 정상; 근거 없는 AI 투표 17건에서 0건'],
 ['랜덤 사건 36종','PARTIAL','PASS','전 분기 조건 테스트; 자연 발생 35종, 22번은 조건 구성으로 검증'],
 ['개인 비밀 목표','PARTIAL','PASS','12종 평가 유지; 생존·진영 긴급 판단보다 앞서던 문제 수정'],
 ['숨겨진 장소','PARTIAL','PASS','AI가 인간의 지도 선택과 무관하게 개방 장소를 탐험'],
 ['다중 엔딩','PASS','PASS','4개 기본 판정·우선순위와 특별 엔딩 검사'],
 ['미스터리 도감','PASS','PASS','완료 기록 1회 수집, 새 게임 비밀 유입 없음'],
 ['캐릭터 그래픽','PASS','PASS','실제 JPG 초상화 6인×6표정, 두 브라우저 확인'],
 ['지도·애니메이션','PASS','PASS','네 지역 클릭, 반복 개방 애니메이션 제거, 효과 감소'],
 ['음악·효과음','PASS','PASS','9개 BGM×2브라우저 실제 재생, 효과음 중복 제한·누락 대체'],
 ['저장·이어하기','PASS','PASS','v4 유지, v2/v3 원본 보존, 각 단계·토론·투표·2/3일·엔딩 복원']
];
const baseline=`# Phase 6 변경 전 진단\n\n기준 커밋: e17d58f3d87a03ded8c1cbc548fd5447d7c5e47c (Phase 5). 작업 전 백업: [pre-phase6-e17d58f.zip](../backups/pre-phase6-e17d58f.zip). 기존 코드 전체의 모듈 연결, 규칙·저장·뷰·연출과 테스트를 확인했다. 기존 기능을 재작성하거나 삭제하지 않았다.\n\n변경 전 npm test 94/94 통과, 변경 전 고정 시드 300회 300/300 완료. 그래픽·음향의 기존 실행 근거는 [Phase 5 브라우저 기록](phase5-browser-features.json), 수정 후 실행 근거는 Phase 6 기록이다. 단위 테스트 통과를 공정성·전략성 완료로 간주하지 않았다.\n\n${table(['기능','변경 전','최종','실행 근거 / 보완 내용'],audit)}\n\n## 오류와 미완성 구분\n\n- FAIL / 논리 오류: 공작원이 일반 수리 및 사건 선택으로 상대 탈출을 완성할 수 있었다. 일반 행동의 즉시 패배 선택을 제거하고 사건 결과도 확인한다.\n- FAIL / 정보 경계: 고발의 supported 표시가 발언자 비공개 voteScores에서 왔다. 청자가 이미 가진 기억으로만 판정하도록 수정했다.\n- PARTIAL / 전략: 생존 위험·즉시 탈출보다 개인 임무가 우선했고 같은 점수에서 첫 좌석을 반복 조사했다. 긴급 우선순위와 제한된 동점 선택을 적용했다.\n- PARTIAL / 난이도: 기존에는 증거 가중치·모순 기준만 달랐다. 관찰·기억 활용·관계 비중·판단 오차·계획을 추가했다.\n- PARTIAL / 안내: 수동 도움말은 있었으나 첫 실행 안내와 상황별 설명, 간단한 결과 보기가 없었다. 기존 도움말을 재사용해 보완했다.\n- PARTIAL / 사건: 22·26·36번 자연 발생 0회. 26번은 보트 선택 편향 수정, 31·36번은 조건 만족 시 가중치 조정. 22번을 거짓 조건으로 강제하지 않았다.\n\nPASS는 명시한 기능의 실제 실행을 뜻하며, 모든 인간에게 재미있거나 완벽하게 균형 잡혔다는 뜻이 아니다.\n`;
const comparison=[
 ['정상 완료',`${before.completed}/${before.games}`,`${after.completed}/${after.games}`],
 ['오류 / 진행 중단',`${before.errors.length} / ${before.stalls}`,`${after.errors.length} / ${after.stalls}`],
 ['생존자 / 공작원 / 생존 실패',`${before.summary.wins.survivors} / ${before.summary.wins.saboteur} / ${before.summary.wins.none}`,`${after.summary.wins.survivors} / ${after.summary.wins.saboteur} / ${after.summary.wins.none}`],
 ['생존자 승률',pct(before.summary.wins.survivors,300),pct(after.summary.wins.survivors,300)],
 ['평균 종료 날짜',n(before.summary.averageDay),n(after.summary.averageDay)],
 ['공작원 추방',pct(before.summary.spyExileRate,1),pct(after.summary.spyExileRate,1)],
 ['생존자 직업의 추방 건수',innocent(before),innocent(after)],
 ['근거 없는 AI 지목표 / 전체 지목표',`${before.unsubstantiatedAIVotes}/${before.totalAIVotes}`,`${after.unsubstantiatedAIVotes}/${after.totalAIVotes}`],
 ['AI 비밀 정보 접근 / 불법 행동',`${before.informationViolations} / ${before.invalidDecisions}`,`${after.informationViolations} / ${after.invalidDecisions}`],
 ['직접 증거로 발견된 거짓말 / 거짓말',`${before.detectedLies}/${before.lieStatements}`,`${after.detectedLies}/${after.lieStatements}`],
 ['진실을 직접 모순으로 오판한 건수',before.falseContradictions,after.falseContradictions],
 ['최대 직렬화 저장 크기 (UTF-8 byte)',before.maxSaveBytes,after.maxSaveBytes]
];
const report=`# ISLAND MYSTERY · PHASE 6 결과 보고서

검증일: 2026-11-20. 기존 HTML/CSS/JavaScript 구조와 Phase 1~5 기능을 유지하면서 규칙 기반 AI, 공정성, 안내와 안정성을 보완했다. **최종 300회 본 시험 + 150회 전략 시험이 모두 정상 종료했고, 회귀 테스트 107개 및 실제 브라우저 A~E를 통과했다.** 온라인 기능은 구현하지 않았다.

## A. 기존 프로젝트 진단

전체 17항목의 변경 전/후 상태는 [진단표](PHASE6-BASELINE.md)에 있다. 기준 커밋과 ZIP 백업을 보존했다. 핵심 단계 전이·저장은 정상 작동했으나, 공작원의 자기 패배 선택, 개인 임무 우선순위, 고발에서의 정보 경계, 증거 없는 투표가 문제였다. 첫 실행 안내와 상황 도움말도 부족했다.

## B. 실제 수정 사항

| 파일 | 변경과 목적 |
| --- | --- |
| js/config.js | 기존 설정 확장: 수리 비용·효과, 방해, 부상, 조사, 관찰·투표, 난이도, 사건 가중치. 중첩 설정을 동결해 우발적 런타임 변경 방지 |
| js/state.js | 설정값을 행동과 표시 문구에 연결. AI의 개방 장소 탐험 허용. 내부 판정용 뷰에서 쓰지 않는 로그 복사 생략 |
| js/ai.js | 즉시 탈출·위급 치료·배급 부족·3일 차 준비를 임무보다 우선. 동점 좌석 편향 완화. 공작원 일반 수리 제외. 비공개 결정 이력에 자원·시설·이전 행동 대비 변경 기록 |
| js/social.js | 같은 사건의 가장 강한 출처 하나만 집계. 증거 없는 추방표 금지. 보통/고급의 직접 훼손 증거는 과거 친분으로 상쇄되지 않음. 후반 배신 전략 추가 |
| js/discussion.js, js/perception.js | 청자 자신이 가진 증거만 사용. 난이도별 주의력은 가능한 현장 관찰에만 적용. 전언은 직접 증거로 승격하지 않음 |
| js/story.js | 사건 가중치를 설정에서 읽음. 공작원이 사건 선택으로 탈출 장비를 완성하는 예외 방지 |
| js/ui.js, js/app.js, js/settings.js, index.html | 첫 실행 안내/건너뛰기 기억, 지역·배급·단서·투표·밤 도움말, 막힌 행동 이유, 간단한 결과 보기. 변경 없는 상태의 렌더·재저장 생략 |
| js/presentation.js, css/cinematic.css | 이미 개방된 지도 표식이 다시 렌더될 때 발견 애니메이션 반복 방지 |
| tests/, scripts/report-phase6.cjs | 재현 가능한 시드·정책, 정보 접근 감시, 저장 왕복, 브라우저 시나리오, 수치 보고서 생성 |

직업 능력·초기 물자 12/12/2/2·탈출 기준 18/14·3일 제한은 유지했다. 실제 데이터에서 31번은 1/300, 36번은 0/300으로 드물어 **조건을 만족한 후보끼리** 뽑을 때 31번 가중치 3→6, 36번 6→9로 조정했다. 조건·하루 최대 2개·중복 금지는 유지한다. 사건 고유 효과·장소별 보상은 콘텐츠 데이터 js/story-data.js에 남겨 두며 핵심 규칙 설정과 구분한다.

## C. AI 난이도 구현

| 항목 | EASY | NORMAL | HARD |
| --- | --- | --- | --- |
| 현장 관찰 주의력 배율 | 0.75 | 1 | 1.15 |
| 투표에 활용하는 사건 기간 | 당일 | 최대 3일 | 최대 3일 |
| 증거 가중치 | 0.8 | 1 | 1.12 |
| 직접 모순 비교 최소 신뢰도 | 0.95 | 0.85 | 0.8 |
| 관계 영향 배율 | 1.25 | 1 | 0.65 |
| 후보 판단 오차 상한 | 3점 | 0.8점 | 0.2점 |
| 계획 | 낮 협력/밤 방해 중심 | 탈출 임박·3일 차 우선 | 같은 장기 계획 + 증거 우선·정밀 관찰 |

기억 자체를 삭제하지 않는다. 초급은 오래된 흔적을 투표 점수에 덜 활용한다. 모든 AI는 자신의 역할·기억과 공개 상태만 받는다. 감시 프록시는 다른 사람의 역할/기억/목표, 전체 사실·이야기 내부 상태 접근을 오류로 처리한다. 최종 본 시험 ${after.aiDecisions}개 AI 결정을 감시했고 위반 ${after.informationViolations}건이었다. 공개 뷰에 다른 AI의 결정 이력도 없다. 엔진이 실제 사실을 판정하는 권한과 AI의 정보 권한은 별개다.

${table(['AI 수준','본 시험 수','생존자 승','공작원 승','평균 날짜','공작원 추방','별도 동일 시드 전략 시험: 거짓말 발견'],difficultyRows)}

본 시험 난이도별 시드는 서로 다르므로 이것만으로 난이도의 인과 효과를 확정하지 않는다. 별도 전략 시험은 같은 공작원 시드 10개×정책 5개를 세 난이도에 적용했다. 그중 거짓말 정책의 실제 허위 발언은 수준별 18개이며 발견 수가 8/10/11이었다. 추리 수준은 동료 AI에도 적용되므로 인간 생존자에게 HARD가 항상 더 어렵다는 뜻은 아니다. 고급에서도 인간 공작원의 후반 배신 정책 승리 사례(시드 100050)가 있다.

## D. 직업 및 공작원 밸런스

${table(['직업','참여 인원 표본','인물당 획득 물량 전→후','인물당 수리도 전→후','치료 행동','조사 행동','이야기 단서 합계','추방'],roleRows)}

획득 물량은 식량·식수·의약품·부품의 **단순 개수 합계**이며 서로 다른 자원의 경제적 가치를 같다고 평가한 지표가 아니다. 표본 인원은 중복 직업 배정을 포함한다. 기여는 종료 시점·직업·인물·정책이 섞인 관찰값이므로 직업의 단독 인과 효과로 해석하지 않는다.

- 탐험가: 일반 정글 성공 78%에 +15%p, 정글 부상 30%를 12%로 줄이며 야간 탐험이 가능하다. 같은 난수 조건의 직업 보정 회귀를 유지했다. 최종 인물당 획득 물량이 가장 높다.
- 의사: 의약품 1개당 최대 45 회복, 일반 직업 25. 과잉 회복은 체력 100에서 잘린다. 위급 환자를 우선한다. **별도의 야간 무적·보호막 능력은 없으며**, 밤에도 치료 행동으로 보호한다. 의약품 평균 잔량 ${n(after.summary.resources.medicine)}개와 낮은 치료 횟수는 남은 밸런스 관찰 사항이다.
- 기술자: 부품당 +3 대 일반 직업 부품 2개당 +2로 효율 3배. 수리 기여가 크지만 자동 승리는 아니다. 다른 직업도 수리 가능하며, 특정 생존자 직업 전원이 활동 불능이어도 탈출 가능한 조건 테스트를 추가했다.
- 조사관: 발견 확률 +25%p. 당일 방해 이력이 있을 때 흔적 75%, 없을 때 20%로 불확실하다. 증거 공개는 실제 청자 판단과 투표를 바꾸며 역할을 직접 알려 주지 않는다.
- 공작원: 은닉 3/파괴 4와 행동 1회 소비, 현장 목격 위험을 유지했다. 자기 패배 수리 대신 물자 확보로 위장한다. 시설 완성도와 시점에 따라 적극 방해·협력·거짓 정보·분열·후반 배신을 선택하고 압박 시 알리바이를 보조 전략으로 쓴다.

${table(['인간 공작원 고정 정책','게임','공작원 승','공작원 승률','추방률'],Object.entries(strategies.byPolicy).map(([id,r])=>[id,r.games,r.wins.saboteur,pct(r.wins.saboteur,r.games),pct(r.spyExileRate,1)]))}

정책 비교는 같은 시드와 난이도에 대한 30회씩의 실행이다. aggressive는 가능한 단계마다 방해, cooperate는 끝까지 위장 협력, misinform은 방해 후 하루 1회 허위 동선, divide는 방해와 의혹 전환, late는 2일 차 이후 시설 40% 이상에서 방해를 시작한다. 모두 실제 허용 행동만 사용한다. 이것이 모든 가능한 인간 전략의 우열을 증명하지는 않는다. AI 전략 사용 횟수·함께 나타난 승패는 원본 JSON strategies에 별도 기록했으며, 여러 전략을 한 게임에 사용하므로 합산 승률로 비교하지 않는다.

## E. 자동 시뮬레이션

최종 본 시험은 인간 생존자 100회·인간 공작원 100회·무작위 역할 100회다. 자연 배정으로 역할을 확인한 시드를 고정했으며 역할을 강제로 바꾸지 않았다. tests/fixtures/phase6-cases.json에서 모든 시드·역할·난이도·정책을 확인할 수 있다.

${table(['항목','변경 전 300회','최종 300회'],comparison)}

${table(['최종 그룹','게임','생존자 승','공작원 승','생존 실패','평균 날짜'],Object.entries(after.byGroup).map(([id,r])=>[id,r.games,r.wins.survivors,r.wins.saboteur,r.wins.none,n(r.averageDay)]))}

${table(['평균 잔량','변경 전','최종'],Object.keys(after.summary.resources).map(k=>[k,n(before.summary.resources[k]),n(after.summary.resources[k])]))}

정책은 cooperate(현재 버전 AI 계획), evidence(공개·반박·조사·연구), survival(치료·식수·휴식), escape(수리·탐험)로 교대한다. 본 시험의 인간 공작원은 가능한 방해와 반복 허위 동선을 선택하는 공격적 스트레스 정책이다. 이 정책의 승리는 0/100→9/100, 추방은 98%→82%였다. 나머지 단계의 기본 선택은 각 버전 AI에 위임하므로 변경 전후 비교에는 그 기본 정책의 개선도 포함한다. **이 수치는 실제 인간 승률이 아니다.**

각 전이마다 합법성·자원 하한·행동 슬롯 중복·사건 중복/일일 상한·저장/복원 전체 일치·종료 후 행동 금지를 검사했다. 본 시험 300회와 별도 전략 시험 150회 모두 오류·정지·불법 결정·비밀 접근 위반 0건이다. 변경 전 300회, 탐색 60회, 1차 변경본 300회/전략 150회, 최종 300회/전략 150회로 **보존된 자동 실행 총 1,260회**다. 1차 통계 이후 사건 선택의 자기 패배 예외를 발견해 회귀를 추가하고 최종 시험을 다시 실행했다. 탐색 자료는 pilot 및 initial 접두 파일로 구분해 남겼다.

### 사건 빈도

${table(['사건','변경 전 300회','최종 300회'],eventRows)}

26번은 시설 동률 때 통신탑만 고르던 편향을 없애며 0→27회, 31번은 1→6회, 36번은 0→1회였다. 22번은 동일 인물의 동일 시점 동선 주장이 실제로 충돌해야 하므로 본 표본에서는 0회다. 사건 36종 모든 선택지의 유효성·분기 효과는 별도 조건 구성 회귀로 확인했다. 희귀 사건을 만나지 않아도 연구 기록 조사와 세 가지 핵심 기록의 공개로 마지막 단서를 얻을 수 있어 진행이 막히지 않는다.

원본: [변경 전 JSON](phase6-before.json) / [CSV](phase6-before.csv), [최종 JSON](phase6-after.json) / [CSV](phase6-after.csv), [전략 JSON](phase6-strategies.json) / [CSV](phase6-strategies.csv), [사건 CSV](phase6-events.csv), [직업 CSV](phase6-roles.csv), [비교 그림](phase6-balance.svg).

## F. 브라우저 플레이 테스트

[verification 스킬](../docs/PHASE6-REQUIREMENTS.md)의 전체 흐름 관점을 적용해 버튼 → state.transition → localStorage → 복원된 화면과 엔딩을 확인했다. 이 게임에는 외부 API/DB/환경 비밀키가 없다. 테스트 서버는 로컬 자산만 제공하며 게임 상태는 브라우저 안에서 처리한다. 처음 브라우저와 서버의 격리 환경이 달라 연결이 시간 초과되었고, 같은 로컬 환경에서 서버를 실행한 뒤 재검증했다. 이는 게임 로직 오류와 구분한다.

${table(['시나리오','시작 조건','실제 결과','UI 단계 수','자동 조작 경과 초'],browser.scenarios.map(r=>[r.name,r.type.startsWith('full')?'새 게임부터 실제 버튼':'명시적 조건 저장 후 실제 버튼',r.outcome.code+' / '+r.ending,r.steps,n(r.elapsedSeconds)]))}

A는 시드 1의 생존자로 실제 단서·반박·투표 후 탈출했다. B는 시드 5 인간 공작원으로 은닉/파괴·허위 동선을 사용했고 생존자 탈출로 패배하는 엔딩까지 확인했다. C는 인간에 대한 직접 증거가 주어진 조건 저장에서 1일 차에 실제 AI 표로 추방된 뒤 3일 차까지 관전했다. D는 6명 체력 20·식량/식수 0인 밤 정산 직전 조건에서 정산 버튼으로 전멸을 확인했다. E는 핵심 기록이 공개되고 보트가 13인 조건에서 연구소 지하실을 실제 탐험해 archive를 획득한 뒤 AI 수리로 진실 엔딩이 발생했다. **C/D/E는 희귀 조건 재현이며 자연 플레이 빈도를 측정한 사례가 아니다.**

토론 도중, 투표 직후, 2일 차, 3일 차와 엔딩을 새로고침해 저장 원문 일치를 검사했다. 종료 후 버튼 비활성화·도감 1회 기록·투표 취소·튜토리얼 재표시 방지·결과 접기를 확인했다. Chrome ${browser.browser}, Firefox ${features.browsers.find(b=>b.name==='Firefox').version}에서 지도, 설정, 효과 감소, 9개 BGM 실제 재생, 효과음 제한, 390px 화면을 검사했다. 이미지·모든 음원·저장소·전체화면 실패를 강제로 재현해 무음/기본 화면/저장 불가 안내로 계속 진행함을 확인했다. 런타임 오류 0건.

실행 화면: [A](phase6-browser-A.png), [B](phase6-browser-B.png), [C 추방](phase6-browser-C-exile.png), [C 결말](phase6-browser-C.png), [D](phase6-browser-D.png), [E](phase6-browser-E.png), [모바일 폭](phase6-browser-mobile.png), [자산 누락 대체](phase6-fallback.png). [전체 결과](phase6-browser-results.json), [두 브라우저 기능 결과](phase6-browser-features.json).

### 처리 시간과 최적화

${table(['구간','Node 전이 평균 ms: 전→후','최종 p95 ms'],Object.keys(after.timings).map(k=>[phases[k],`${n(before.timings[k].meanMs)} → ${n(after.timings[k].meanMs)}`,n(after.timings[k].p95Ms)]))}

${table(['실제 Chrome 엔진 전이 구간','표본','평균 ms','최대 ms'],Object.entries(uiGroups).map(([k,v])=>[phases[k],v.length,n(means(v)),n(Math.max(...v))]))}

첫 페이지 DOM 준비는 ${n(Math.min(...browser.scenarios.map(r=>r.startupMs)))}~${n(Math.max(...browser.scenarios.map(r=>r.startupMs)))}ms였다. 엔딩 판정이 포함된 전이는 ${browser.timings.filter(t=>t.ending).length}개이며 평균 ${n(means(browser.timings.filter(t=>t.ending).map(t=>t.ms)))}ms였다. A/B 전체 경과에는 자동 클릭·새로고침·검증·음향 대기가 포함되고 사람의 읽기/판단 시간은 포함하지 않는다. **인간 평균 플레이 시간, FPS, 힙 누수 장기 추적은 측정하지 않았다.**

불필요한 로그 복사와 같은 상태의 재렌더·재저장을 줄였고, 발견 연출은 실제 새 개방에서만 실행한다. 전체 상태/저장 유효성 검사와 개인 정보 필터는 유지했다. 토론 평균과 p95는 소폭 낮아졌으나 실행 시 다른 검사와 CPU를 공유했고 변화한 게임 경로도 있어 성능 향상률을 단정하지 않는다. 마지막 저장은 약 ${n(after.maxSaveBytes/1024)}KiB까지 관찰했으며, 게임 로그·개인 기억·행동 이력은 기존 상한을 유지한다. 새 프레임워크나 상시 타이머는 추가하지 않았다.

### 엔딩 우선순위

전원 활동 불능(D) → 생존자 진영 활동 인원 0(C) → 밤 정산 시 공작원 추방(B) → 시설 완성(A) → 3일째 밤 제한(C). 시설 완성은 정산 전 행동 직후에도 즉시 검사한다. 종료 후 다른 조건으로 덮어쓰지 않는다. 1일 차 추방, 일찍 완성한 시설, 동시 조건, 마감일·자원 부족은 기존/신규 회귀에서 검사했다.

## G. 남은 문제와 검증 한계

- 알려진 진행 차단 오류는 최종 검사에서 0건이다. 완료 판정은 명시한 PC 브라우저와 테스트 조건에 한정한다.
- 생존자 진영 우세와 의약품 잉여는 남아 있다. 이를 숨기거나 목표 승률에 맞춰 능력을 임의 조정하지 않았다. 실제 초보자·숙련자 플레이와 역할별 정책을 더 모아 후속 수치 조정을 판단할 수 있다.
- 22번 사건은 본 시험에서 자연 발생하지 않았다. 조건/분기와 대체 핵심 단서는 검증했지만 자연 체감 빈도 개선은 추가 관찰 대상이다.
- 의사의 별도 야간 보호막, 자연어 자유 발언, Safari·모바일 실기기, 사람의 재미/읽기 시간 평가는 구현·실행 완료로 보고하지 않는다.
- 단일 PC의 CPU 부하를 분리한 성능 벤치마크나 장시간 메모리 누수 검사를 수행하지 않았다. 로컬 싱글플레이 저장은 개발자 도구에서 읽을 수 있으므로 서버 수준의 비밀 보안 모델은 아니다.

## H. 게임 실행 방법

저장소를 내려받아 index.html을 Chrome 또는 Firefox로 열면 된다. 설치·계정·외부 API 없이 실행한다. 브라우저의 로컬 파일 저장 정책 때문에 저장이 제한되면 Node.js를 설치한 후 프로젝트 폴더에서 아래 명령을 실행하고 표시된 주소를 연다.

\`\`\`sh
node tests/serve.cjs
# 브라우저 주소: http://127.0.0.1:4173
\`\`\`

개발 검증: npm test, npm run test:simulation, npm run test:strategies. 실제 브라우저 검증은 npm ci 및 Chrome/Playwright Firefox 설치 후 서버가 실행된 상태에서 npm run test:browser, npm run test:browser:features. 브라우저 테스트는 사용자 프로필과 분리된다. [회귀 실행 원문](phase6-tests.txt).

## I. Phase 7 진입 가능 여부

**온라인 멀티플레이 설계와 별도 프로토타입에 진입할 수 있다. 운영 출시 준비가 완료되었다는 뜻은 아니다.** 단일 상태 전이·저장·종료 조건과 개인 뷰의 기반은 검증했다. 온라인에서는 authoritative 상태를 서버로 옮기고 인증·턴 권한·재전송 멱등성·재접속·방 관리·클라이언트별 정보 전달을 별도로 구현하고 검증해야 한다. 이번 작업은 그 기능을 추가하지 않았다. 도메인이 필요해지면 APP_DOMAIN/APP_ORIGIN 환경 설정을 사용하며 특정 도메인을 소스에 고정하지 않는다.
`;
fs.writeFileSync(path.join(root,'docs/PHASE6-BASELINE.md'),baseline);
// Skill attribution is a workflow description, not a repository-relative skill link.
fs.writeFileSync(path.join(root,'docs/PHASE6-REPORT.md'),report.replace('[verification 스킬](../docs/PHASE6-REQUIREMENTS.md)','verification 스킬'));
fs.writeFileSync(path.join(root,'docs/phase6-events.csv'),'event,before,after\n'+eventRows.map(r=>r.join(',')).join('\n')+'\n');
fs.writeFileSync(path.join(root,'docs/phase6-roles.csv'),'role,actors,resource_units_per_actor_before_after,repair_points_per_actor_before_after,heals,investigations,clues,exiles\n'+roleRows.map(r=>r.join(',')).join('\n')+'\n');
const bars=[['Survivor wins',before.summary.wins.survivors/3,after.summary.wins.survivors/3],['Human spy wins',before.byGroup.saboteur.wins.saboteur,after.byGroup.saboteur.wins.saboteur],['Spy exile rate',before.summary.spyExileRate*100,after.summary.spyExileRate*100],['Unsupported AI votes',100*before.unsubstantiatedAIVotes/before.totalAIVotes,100*after.unsubstantiatedAIVotes/after.totalAIVotes]];
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="490" viewBox="0 0 1000 490"><title>Phase 6 measured policy outcomes</title><rect width="1000" height="490" fill="#10272b"/><g font-family="Arial,sans-serif" fill="#edf1e6"><text x="35" y="40" font-size="24">PHASE 6 — Measured policy outcomes</text><text x="35" y="68" font-size="14">300 matched-seed games per version. Automated policies, not human win rates.</text><text x="650" y="105" fill="#8caeb3">Before</text><text x="760" y="105" fill="#e5c894">After</text>';
bars.forEach(([label,b,a],i)=>{const y=145+i*78;svg+=`<text x="35" y="${y+17}" font-size="16">${label}</text><rect x="260" y="${y}" width="${b*6}" height="20" fill="#8caeb3"/><text x="${270+b*6}" y="${y+15}" font-size="13">${n(b)}%</text><rect x="260" y="${y+25}" width="${a*6}" height="20" fill="#e5c894"/><text x="${270+a*6}" y="${y+40}" font-size="13">${n(a)}%</text>`;});svg+='</g></svg>';
fs.writeFileSync(path.join(root,'docs/phase6-balance.svg'),svg);
console.log('Phase 6 measured reports, CSVs and comparison SVG written.');
