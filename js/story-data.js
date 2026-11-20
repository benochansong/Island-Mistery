(function (root) {
  'use strict';
  const game = root.IslandMystery;
  const clues = [
    ['orientation', '찢어진 안내문', '이 섬은 기억 회복 프로그램의 격리 관측소였다. 의료 연구와 감시가 함께 이루어졌다.'],
    ['protocol', '기억 실험 절차서', '연구진은 기억을 지우는 대신 특정 기억에 접근하지 못하도록 신호를 사용했다. 강한 감정은 차단을 깨뜨렸다.'],
    ['manifest', '여섯 명의 명단', '여섯 명은 서로 다른 사유로 기억 회복 프로그램에 등록했다. 명단 자체는 현재의 공작원 신분을 증명하지 않는다.'],
    ['access', '지하실 출입 기록', '사고 당일 연구진은 지하실에서 긴급 정지를 시도했다. 마지막 출입 뒤 보조 통로를 통해 철수했다.'],
    ['accident', '정지 명령 기록', '기억 신호가 통제 범위를 벗어나자 연구진은 시설을 폐쇄하고 철수했다. 외부 계약자는 실험 자료 회수를 지시했다.'],
    ['signal', '반복되는 무전', '구조 주파수와 자료 회수 주파수는 다르다. 모든 응답이 구조선에서 온 것은 아니다.'],
    ['cipher', '암호 해독 메모', '암호에는 비상 정지 순서와 기록 보관함의 위치가 적혀 있다.'],
    ['voice', '참가자의 음성', '한 참가자는 기억 회복을 원했지만 통제 실험에는 동의하지 않았다고 증언했다.'],
    ['watcher', '감시 장치 설계도', '남아 있는 장치는 사람을 추적하고 신호를 외부로 전송한다. 연구진이 아직 섬에 있다는 증거는 아니다.'],
    ['exitRisk', '출항 경고', '기억 신호는 섬 밖에서 약해지지만 기록을 회수하려는 조직은 남아 있다. 탈출과 사건의 완전한 해결은 다르다.'],
    ['final', '연구시설의 마지막 기록', '기억 차단 실패로 연구진은 철수했다. 여섯 참가자는 뒤에 남겨졌고, 자료 회수를 맡은 공작원은 탈출을 지연시키고 있다. 구조 주파수를 사용하면 탈출은 가능하다.'],
    ['staffLink', '시설과의 연결', '발견된 동의서에는 현재 생존자 한 명의 서명이 있다. 참가자·보조자·방문자 모두 서명했으므로 역할을 단정할 수 없다.'],
    ['cave', '동굴의 운송 기록', '해안 동굴은 비상 보급과 자료 운송에 쓰였다.'],
    ['observatory', '관측소의 지도', '정글 관측소는 기억 신호의 범위를 측정했다.'],
    ['equipment', '장비실의 회로도', '구조 송신기와 실험 신호 발생기는 별도 회로다. 구조 송신기를 복구해도 실험을 재개하지 않는다.'],
    ['archive', '미공개 연구 자료', '연구진은 참가자 동의와 실제 실험 범위가 달랐음을 내부 보고서에 남겼다.']
  ].map(([id, title, text]) => ({ id, title, text }));
  const sites = [
    { id: 'basement', parent: 'lab', name: '연구소 지하실', clue: 'archive', loot: { medicine: 2, parts: 2 }, risk: 16 },
    { id: 'observatory', parent: 'jungle', name: '오래된 관측소', clue: 'observatory', loot: { food: 3, medicine: 1 }, risk: 12 },
    { id: 'cave', parent: 'coast', name: '해안 비밀 동굴', clue: 'cave', loot: { water: 3, parts: 2 }, risk: 10 },
    { id: 'equipment', parent: 'tower', name: '지하 장비실', clue: 'equipment', loot: { parts: 4 }, risk: 14 }
  ];
  const fx = (type, key, amount, extra = {}) => ({ type, key, amount, ...extra });
  const resource = (key, amount) => fx('resource', key, amount);
  const facility = (key, amount) => fx('facility', key, amount);
  const clue = (key, audience = 'actor') => fx('clue', key, 1, { audience });
  const flag = key => fx('flag', key, 1);
  const health = amount => fx('health', 'actor', amount);
  const unlock = key => fx('unlock', key, 1);
  const relation = (trust, suspicion) => fx('relation', 'subject', trust, { suspicion });
  const choice = (id, label, effects, cost = {}, extra = {}) => ({ id, label, effects, cost, ...extra });
  const leave = choice('leave', '위험을 피하고 지나간다 · 후속 기회를 포기', [flag('declined')]);
  function event(n, name, category, location, days, condition, choices, extra = {}) {
    return { id: 'event-' + String(n).padStart(2, '0'), name, category, location, days, condition, weight: 3, visibility: 'public', participants: 2, followUps: [], choices: [...choices, leave], ...extra };
  }
  const events = [
    event(1, '열대 폭풍', '자연재해', 'tower', [1,2,3], { facility: 'radio' }, [choice('brace','부품 1개로 통신탑 보강 · 수리도 +1',[facility('radio',1)],{parts:1}),choice('shelter','대피 · 통신탑 -2, 식수 +2',[facility('radio',-2),resource('water',2)])]),
    event(2, '정글을 삼킨 폭우', '자연재해', 'jungle', [1,2], {}, [choice('detour','우회로 조사 · 체력 -8, 관측소 발견',[health(-8),unlock('observatory')]),choice('wait','내일까지 정글 수색을 중단 · 빗물 +3',[fx('close','jungle',1),resource('water',3)])]),
    event(3, '정체불명의 표류 상자', '자연재해', 'coast', [1,2,3], {}, [choice('open','상자 열기 · 식량 +3, 부품 +1',[resource('food',3),resource('parts',1)]),choice('inspect','운송 흔적 조사 · 동굴 발견',[unlock('cave'),clue('cave')])]),
    event(4, '연구시설의 붕괴', '자연재해', 'lab', [2,3], {}, [choice('rescue','의약품 1개로 부상 예방 · 사고 기록 확보',[clue('accident')],{medicine:1}),choice('search','잔해 조사 · 체력 -15, 부품 +3',[health(-15),resource('parts',3)])]),
    event(5, '짙은 안개', '자연재해', 'camp', [1,2,3], {}, [choice('mark','표식 설치 · 부품 1, 전원 식수 +3',[resource('water',3),flag('safeTrail')],{parts:1}),choice('follow','희미한 신호 추적 · 체력 -10, 무전 기록',[health(-10),clue('signal')])]),
    event(6, '야생동물의 습격', '자연재해', 'jungle', [1,2,3], {}, [choice('bait','식량 2개로 유인 · 의약품 +1',[resource('medicine',1)],{food:2}),choice('flee','도망친다 · 체력 -12, 식량 +1',[health(-12),resource('food',1)])]),
    event(7, '식량 저장고 파손', '생존 자원', 'camp', [1,2,3], { resource: 'food' }, [choice('fix','부품 1개로 수리 · 저장고 보호',[flag('storeProtected'),resource('food',1)],{parts:1}),choice('salvage','남은 식량 옮기기 · 식량 -2, 부품 +1',[resource('food',-2),resource('parts',1)])]),
    event(8, '식수 오염 의심', '생존 자원', 'camp', [1,2,3], { resource: 'water' }, [choice('purify','의약품 1개로 정수 · 식수 +1',[resource('water',1),flag('purified')],{medicine:1}),choice('discard','오염 의심 식수 3개 폐기',[resource('water',-3)])]),
    event(9, '숨겨진 의료 상자', '생존 자원', 'lab', [1,2,3], {}, [choice('share','공동 의료품 +3 · 협력 기록',[resource('medicine',3),relation(8,-3)]),choice('study','의료품 +1 · 기억 실험 절차서 확보',[resource('medicine',1),clue('protocol')])]),
    event(10, '난파선의 부품', '생존 자원', 'coast', [1,2,3], {}, [choice('recover','부품 +4 · 체력 -8',[resource('parts',4),health(-8)]),choice('chart','통로 조사 · 비밀 동굴 개방',[unlock('cave'),clue('cave')])]),
    event(11, '사라진 비상식량', '생존 자원', 'camp', [1,2,3], { food: 2, active: 2 }, [choice('audit','창고 조사 · 식량 1 회수, 불확실한 흔적',[resource('food',1),fx('trace','subject',1)]),choice('ration','공동 식량 +2 확보 · 범인 추적 보류',[resource('food',2),flag('theftIgnored')])], { cause: 'theft' }),
    event(12, '오래된 비상 보급품', '생존 자원', 'jungle', [1,2,3], {}, [choice('collect','식량 +2, 식수 +2',[resource('food',2),resource('water',2)]),choice('read','보급품 운송 메모와 의료품 +1',[clue('cipher'),resource('medicine',1)])]),
    event(13, '비밀 실험 문서', '미스터리', 'lab', [1,2,3], {}, [choice('public','모두에게 절차서 공개',[clue('protocol','public'),relation(8,-3)]),choice('private','혼자 문서를 확보 · 체력 -5',[clue('protocol'),health(-5)]),choice('delegate','동료에게 조사를 맡긴다 · 공개 여부는 동료가 결정',[clue('protocol')],{}, {delegate:true})], { visibility:'private', followUps:['event-31'] }),
    event(14, '정체불명의 무전 신호', '미스터리', 'tower', [1,2,3], {}, [choice('decode','부품 1개로 해독 · 공개 주파수 기록',[clue('signal','public'),flag('signalDecoded')],{parts:1}),choice('record','개인 수첩에 신호 기록',[clue('signal')])], {followUps:['event-29']}),
    event(15, '지하실 출입 기록', '미스터리', 'lab', [2,3], {}, [choice('copy','출입 기록 복사 · 지하실 개방',[clue('access'),unlock('basement')]),choice('delegate','동료에게 검증을 맡긴다',[clue('access')],{}, {delegate:true})], {visibility:'private',followUps:['event-31']}),
    event(16, '암호화된 메모', '미스터리', 'jungle', [1,2,3], {}, [choice('solve','식량 1개를 쓰며 해독 · 관측소 발견',[clue('cipher'),unlock('observatory')],{food:1}),choice('publish','암호 메모를 모두에게 공개',[clue('cipher','public')])], {visibility:'private'}),
    event(17, '생존자의 이름이 적힌 명단', '미스터리', 'lab', [2,3], {}, [choice('show','명단 공개 · 인물과 시설의 연관 확인',[clue('manifest','public'),flag('manifestPublic')]),choice('keep','명단을 혼자 보관',[clue('manifest')])], {visibility:'private',followUps:['event-32']}),
    event(18, '과거 사고 기록', '미스터리', 'coast', [2,3], {}, [choice('recover','식수 1개를 쓰며 기록 복원',[clue('accident'),flag('accidentRecovered')],{water:1}),choice('share','남은 사고 기록 공개',[clue('accident','public')])], {followUps:['event-36']}),
    event(19, '엇갈린 소문의 확산', '심리전', 'camp', [2,3], { rumor:true }, [choice('verify','원래 발언과 대조 · 신뢰할 수 없는 소문은 유보',[fx('rumor','verify',1),flag('rumorChecked')]),choice('repeat','소문을 전달 · 사실로 확정하지 않음',[fx('rumor','repeat',1)])]),
    event(20, '익명의 고발장', '심리전', 'camp', [1,2,3], {active:2}, [choice('read','불확실한 고발 내용을 개인적으로 검토',[fx('trace','subject',.35)]),choice('reject','증거 부족을 알리고 고발 대상 변호',[relation(6,-3),flag('anonymousRejected')])], {visibility:'private'}),
    event(21, '생존자의 물건 실종', '심리전', 'camp', [1,2,3], {active:2}, [choice('help','식량 1개를 쓰며 함께 수색 · 신뢰 상승',[relation(10,-2),flag('itemReturned')],{food:1}),choice('suspect','분실 경위를 추궁 · 신뢰 하락, 의심 증가',[relation(-5,5)])]),
    event(22, '서로 충돌하는 증언', '심리전', 'camp', [2,3], {conflict:true}, [choice('compare','기존 발언을 함께 비교 · 모순 기록 확보',[fx('rumor','compare',1),flag('testimonyCompared')]),choice('defer','검증을 유보 · 대상과 관계 회복',[relation(4,-2)])]),
    event(23, '은밀한 추적', '심리전', 'jungle', [2,3], {active:2}, [choice('follow','체력 -8 · 실제 과거 동선의 흔적 확보',[health(-8),fx('pastLocation','subject',1)]),choice('talk','추적을 밝히고 대화 · 신뢰 +5',[relation(5,-1)])], {visibility:'private'}),
    event(24, '비밀 협력 제안', '심리전', 'camp', [1,2,3], {active:2}, [choice('ally','물자 1개씩 나누며 협력 · 상호 신뢰 상승',[relation(12,-4),flag('alliance')],{food:1,water:1}),choice('decline','거리를 둔다 · 물자 보존, 신뢰 하락',[relation(-3,0)])], {visibility:'private'}),
    event(25, '통신탑 전력 중단', '시설 및 탈출', 'tower', [1,2,3], {facility:'radio'}, [choice('restore','부품 2개로 우회 전원 · 수리도 +2',[facility('radio',2),unlock('equipment')],{parts:2}),choice('stop','전원을 차단 · 수리도 -2, 부품 +1',[facility('radio',-2),resource('parts',1)])]),
    event(26, '보트 엔진 고장', '시설 및 탈출', 'coast', [1,2,3], {facility:'boat'}, [choice('repair','부품 2개로 엔진 복구 · 보트 +2',[facility('boat',2)],{parts:2}),choice('strip','엔진 분해 · 보트 -3, 부품 +2',[facility('boat',-3),resource('parts',2)])]),
    event(27, '구조 신호 송신 가능성', '시설 및 탈출', 'tower', [2,3], {}, [choice('send','부품 1개로 신호 증폭 · 통신탑 +3',[facility('radio',3),flag('rescueSignal')],{parts:1}),choice('check','주파수를 먼저 확인',[clue('signal'),unlock('equipment')])]),
    event(28, '비상 발전기의 재가동', '시설 및 탈출', 'lab', [2,3], {}, [choice('power','부품 1개 사용 · 통신탑 +2, 발전기 연결',[facility('radio',2),flag('generator')],{parts:1}),choice('salvage','발전기 분해 · 부품 +3, 재가동 포기',[resource('parts',3),flag('generatorLost')])], {followUps:['event-31']}),
    event(29, '수평선의 선박 불빛', '시설 및 탈출', 'coast', [2,3], {}, [choice('flash','부품 1개로 신호 · 보트 +2',[facility('boat',2),flag('shipContact')],{parts:1}),choice('observe','배의 무전을 비교 · 출항 경고 확보',[clue('exitRisk')])]),
    event(30, '고의로 손상된 탈출 장비', '시설 및 탈출', 'camp', [2,3], {sabotage:true}, [choice('inspect','손상 흔적 조사 · 범인의 역할은 알 수 없음',[fx('trace','subject',.7)]),choice('patch','부품 1개로 긴급 보수 · 손상 시설 +2',[fx('damagedRepair','facility',2)],{parts:1})], {cause:'sabotage'}),
    event(31, '지하 연구실의 숨겨진 문', '특별 스토리', 'lab', [2,3], {anyFlags:['generator','resolved:event-13','resolved:event-15'],notFlags:['generatorLost']}, [choice('open','부품 1개로 문 개방 · 지하실과 자료 발견',[unlock('basement'),clue('archive'),flag('doorOpened')],{parts:1}),choice('delegate','동료에게 우회 통로 조사를 맡긴다',[unlock('basement'),clue('access')],{}, {delegate:true})], {followUps:['event-36']}),
    event(32, '시설과 연결된 생존자', '특별 스토리', 'lab', [2,3], {active:2}, [choice('ask','실제 서명자의 동의서를 공개 · 역할 단정 금지',[clue('staffLink','public'),fx('trace','subject',.3)]),choice('protect','개인적으로 동의서 보관 · 대상과 신뢰 형성',[clue('staffLink'),relation(6,-2)])], {visibility:'private'}),
    event(33, '과거 참가자의 음성', '특별 스토리', 'jungle', [2,3], {}, [choice('play','기록 공개 · 관측소 개방',[clue('voice','public'),unlock('observatory')]),choice('keep','혼자 음성 분석 · 미공개 자료 확보',[clue('voice'),clue('archive')])], {visibility:'private'}),
    event(34, '섬을 감시하는 장치', '특별 스토리', 'tower', [2,3], {}, [choice('disable','부품 1개로 감시 신호 차단 · 설계도 확보',[clue('watcher'),flag('watcherDisabled')],{parts:1}),choice('trace','신호 기록 · 지하 장비실 개방',[clue('watcher'),unlock('equipment')])]),
    event(35, '탈출 직전의 진실', '특별 스토리', 'camp', [1,2,3], {nearEscape:true}, [choice('read','출항 기록을 확인한다',[clue('exitRisk','public'),flag('exitRead')])], {weight:6}),
    event(36, '연구시설의 마지막 기록', '특별 스토리', 'lab', [3], {anyFlags:['doorOpened','truthLinked']}, [choice('broadcast','식수 1개 사용 · 마지막 기록 공개',[clue('final','public'),flag('truthPublic')],{water:1}),choice('keep','마지막 기록을 개인적으로 보관',[clue('final'),flag('truthPrivate')])], {visibility:'private',weight:6})
  ];
  const missions = [
    ['protect','끝까지 보호하기','지정된 동료가 활동 가능한 상태로 결말에 도달하기'],
    ['document','실험 문서 확보','기억 실험 절차서 또는 연구 자료 확보하기'],
    ['medicine','의료품 조달','자신의 행동으로 의약품 3개 이상 공동 창고에 확보하기'],
    ['conceal','기록을 숨겨 지키기','개인 단서 1개 이상을 공개하지 않고 결말에 도달하기'],
    ['access','출입 기록 추적','지하 연구실 출입 기록 확보하기'],
    ['trust','신뢰 얻기','지정된 동료가 자신을 신뢰하도록 실제 협력하기 (신뢰 70)'],
    ['radio','통신 복구 참여','자신의 행동으로 통신탑 수리도 누적 3 이상 올리기'],
    ['risk','위험을 넘어','정글과 숨겨진 장소를 탐험하고 살아서 결말에 도달하기'],
    ['truth','사고의 진상','실험 절차서·명단·사고 기록을 모두 확보하기'],
    ['escapeTogether','함께 탈출하기','지정된 동료와 활동 가능한 상태로 생존자 진영 승리하기'],
    ['archive','연구 자료 수집','서로 다른 스토리 단서 4개 이상 확보하기'],
    ['cover','의혹을 피하기','활동 가능한 상태로 결말에 도달하며 다른 인물의 자신에 대한 의심이 모두 60 미만이기']
  ].map(([id,title,description]) => ({id,title,description,score:100}));
  game.storyData = Object.freeze({ clues, sites, events, missions, chapters:['','생존과 첫 번째 의심','갈등과 진실의 조각','최후의 선택'] });
})(globalThis);
