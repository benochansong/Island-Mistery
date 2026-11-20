(function (root) {
  'use strict';
  const game = root.IslandMystery;
  const expressions = ['기본','의심','분노','불안','놀람','부상'];
  function expression(view, player, statement) {
    if (player.health < 65) return 5;
    if (!player.isAlive || player.isExiled) return 3;
    if (statement?.speakerId === player.id) {
      if (/반박|거짓|모순/.test(statement.text)) return 2;
      if (/발견|증거|기록.*공개/.test(statement.text)) return 4;
      if (/의심|확인|누구/.test(statement.text)) return 1;
    }
    if ((view.self.suspicion[player.id] || 0) >= 60) return 1;
    if (view.phase === 'voting' || view.phase === 'night') return 3;
    return 0;
  }
  function music(view) { return !view ? 'menu' : view.outcome ? view.outcome.winner : view.phase; }
  function delta(before, after) {
    if (!before || before.runId !== after.runId) return { resources: [], injuries: [], unlocked: [], clues: [], statements: [] };
    return {
      resources: game.data.resources.map(r=>({id:r.id,name:r.name,amount:after.resources[r.id]-before.resources[r.id]})).filter(r=>r.amount),
      injuries: after.players.filter(p=>p.health < before.players.find(o=>o.id===p.id).health).map(p=>p.id),
      unlocked: after.unlockedSites.filter(id=>!before.unlockedSites.includes(id)),
      clues: after.self.storyClues.filter(c=>!before.self.storyClues.some(old=>old.id===c.id)),
      statements: after.statements.filter(s=>!before.statements.some(old=>old.id===s.id))
    };
  }
  function eventEffect(event) {
    if (!event) return 'none';
    if (/폭풍|폭우|안개/.test(event.name)) return 'storm';
    if (/전력|고장|손상|붕괴|발전기/.test(event.name)) return 'electric';
    if (/무전|신호|불빛|감시/.test(event.name)) return 'signal';
    if (/문서|기록|메모|명단|음성|진실/.test(event.name)) return 'document';
    if (event.category==='심리전') return 'testimony';
    return 'supply';
  }
  const descriptions = [
    '먹구름 아래 통신탑의 버팀줄이 흔들린다. 보강할지 대피할지 결정해야 한다.', '폭우로 정글의 길이 잠겼다. 우회로를 찾거나 수색을 미룰 수 있다.', '파도가 봉인된 상자를 밀어 올렸다. 물자와 운송 흔적 중 무엇을 먼저 살필까.',
    '연구동에서 콘크리트가 떨어진다. 잔해 속 기록과 부품을 찾으려면 위험을 감수해야 한다.', '안개가 표식을 삼키고 희미한 신호만 남았다. 안전한 길을 표시하거나 신호를 따라갈 수 있다.', '수풀 안에서 짐승이 길을 막았다. 물자를 쓰거나 다칠 위험을 감수해야 한다.',
    '저장고의 벽이 벌어졌다. 남은 식량을 지키기 위한 선택이 필요하다.', '물통에서 낯선 냄새가 난다. 정수할지 의심되는 물을 버릴지 결정하자.', '잠긴 선반 뒤에서 의료 상자가 발견됐다. 물자를 나누거나 실험 흔적을 조사할 수 있다.',
    '난파선 아래 부품이 남아 있다. 잔해를 인양하거나 운송 통로를 조사할 수 있다.', '창고의 식량 수량이 맞지 않는다. 누가 가져갔는지는 아직 알 수 없다.', '덩굴 아래 오래된 보급품이 남아 있다. 내용물과 운송 메모를 살펴보자.',
    '실험 절차가 적힌 문서가 발견됐다. 공개할지 보관할지, 동료에게 맡길지 선택하자.', '무전기에 같은 신호가 반복된다. 구조 신호인지 먼저 확인할 필요가 있다.', '지하실의 출입 기록에 마지막 통행이 남아 있다. 복사하거나 동료에게 검증을 맡길 수 있다.',
    '메모의 문장은 암호로 가려져 있다. 직접 풀거나 모두에게 공개할 수 있다.', '명단에는 익숙한 이름들이 있다. 명단 자체가 지금의 진영을 증명하지는 않는다.', '훼손된 사고 기록이 남아 있다. 복원하거나 남은 부분을 공유할 수 있다.',
    '이미 공개된 발언이 소문으로 번지고 있다. 원래 주장과 비교하고 확인 여부를 구분하자.', '이름 없는 고발장이 도착했다. 고발만으로 정체를 단정할 수는 없다.', '동료의 물건이 사라졌다. 함께 찾거나 경위를 따져 물을 수 있다.',
    '같은 시간에 대한 공개 증언이 서로 맞지 않는다. 비교할지 판단을 유보할지 정하자.', '정글에 과거 동선의 흔적이 있다. 추적하거나 동료와 직접 이야기할 수 있다.', '한 동료가 은밀한 협력을 제안했다. 물자를 나누거나 거리를 둘 수 있다.',
    '통신탑 전력이 끊겼다. 우회 전원을 연결하거나 전원을 차단해야 한다.', '보트 엔진에서 불규칙한 소리가 난다. 복구하거나 분해해 부품을 회수할 수 있다.', '송신 장치가 잠시 반응한다. 신호를 증폭하거나 주파수를 먼저 조사하자.',
    '비상 발전기를 발견했다. 다시 연결하거나 분해해 부품으로 쓸 수 있다.', '수평선 위에 선박의 불빛이 보인다. 신호를 보내거나 무전을 비교할 수 있다.', '탈출 장비에 고의로 손댄 흔적이 있다. 흔적은 정체를 확정하는 증거가 아니다.',
    '선행 조사로 지하 연구실 문에 접근했다. 열거나 우회로 조사를 맡길 수 있다.', '한 생존자와 시설을 연결하는 서류가 발견됐다. 서명만으로 역할을 단정하지 말자.', '과거 참가자의 목소리가 녹음기에 남아 있다. 모두 함께 듣거나 혼자 분석할 수 있다.',
    '감시 장치가 바깥으로 신호를 보내고 있다. 차단하거나 전송 경로를 살펴볼 수 있다.', '탈출 준비가 끝나 가는 지금, 출항 기록의 경고가 눈에 들어온다.', '연구시설의 마지막 기록에 접근했다. 공개할지 개인적으로 보관할지 결정하자.'
  ];
  game.presentationModel = Object.freeze({ expressions, expression, music, delta, eventEffect, eventDescription: id => descriptions[Number(id.slice(-2))-1] || '현장의 기록을 확인하고 선택하세요.' });
})(globalThis);
