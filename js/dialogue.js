(function (root) {
  'use strict';
  // 12 intent groups × 8 authored variants = 96 grounded templates.
  // Slots are supplied only by witnessed events, explicit claims, or current public state.
  const templates = {
    truth: ['내 동선은 {place}였습니다. {slot}의 기록입니다.', '{slot}, 저는 {place}에서 움직였습니다.', '제 기록부터 밝힐게요. {slot}에는 {place}에 있었습니다.', '{place}에 간 것은 사실입니다. 시점은 {slot}입니다.', '숨기지 않겠습니다. {slot}에 {place}에 갔습니다.', '제 행동 기록의 장소는 {place}, 시간은 {slot}입니다.', '{slot}의 제 위치를 묻는다면, {place}입니다.', '확인 가능한 제 동선은 {slot}의 {place}입니다.'],
    lie: ['제 기억으로는 {slot}에 {place}에 있었습니다.', '저는 {slot}에 {place} 쪽에 있었어요.', '{slot}에는 {place}에 있었다고 말씀드리겠습니다.', '제 동선은 {place}였습니다. {slot} 이야기입니다.', '그때 저는 {place}에 있었습니다. {slot}이 맞아요.', '제 말은 같습니다. {slot}에 {place}에 있었습니다.', '{place}에서 시간을 보냈어요. 시점은 {slot}입니다.', '{slot}에 제 위치는 {place}였다고 기억합니다.'],
    conceal: ['아직 개인 기록을 모두 공개하지 않겠습니다.', '확인할 부분이 남아 있어 세부 동선은 보류할게요.', '제 수첩은 조금 더 정리한 뒤 공유하겠습니다.', '지금은 공개할 정보가 없습니다.', '제가 아는 것을 전부 말할 준비는 안 됐습니다.', '판단을 서두르지 않고 조금 더 관찰하겠습니다.', '일부 기록은 당분간 제게 남겨 두겠습니다.', '지금 발언을 줄이는 것이 거짓말을 뜻하지는 않습니다.'],
    speculate: ['확인되지는 않았지만, {target}의 동선을 더 살펴보고 싶어요.', '{target}에 대한 제 생각은 추측입니다. 증거는 더 필요합니다.', '혹시 {target}의 행동에 다른 설명이 있을까요?', '{target}이 관련됐을 가능성을 열어 두되 단정하지 않겠습니다.', '제 추측으로는 {target}에게 질문할 필요가 있습니다.', '{target}에 대한 의문은 있지만 검증된 결론은 아닙니다.', '{target}의 설명을 더 듣고 싶습니다. 지금은 가설뿐입니다.', '추측과 사실을 나눠 말할게요. {target}이 마음에 걸립니다.'],
    accuse: ['{target}의 행동이 의심스럽습니다. 제 판단 근거는 {reason}입니다.', '저는 {reason} 때문에 {target}을 주시하고 있습니다.', '{target}에게 설명을 부탁합니다. {reason}을 고려하고 있어요.', '{reason}을 보면 {target}에 대한 의문이 남습니다.', '제 의심 대상은 {target}입니다. 이유는 {reason}입니다.', '{target}을 무조건 범인이라 하진 않겠습니다. 다만 {reason}이 걸립니다.', '{reason}을 바탕으로 {target}에게 질문하겠습니다.', '{target}을 지켜보겠습니다. 제 근거는 {reason}입니다.'],
    defend: ['제 설명은 이렇습니다. {slot}에는 {place}에 있었습니다.', '저를 의심한다면 동선을 확인해 주세요. {slot}, {place}입니다.', '장소를 밝히겠습니다. {slot}에 {place}였습니다.', '해명할 기회를 주세요. 제 {slot} 기록은 {place}입니다.', '제가 말할 수 있는 동선은 {slot}의 {place}입니다.', '그 시점의 제 위치를 분명히 하죠. {slot}, {place}.', '기록을 맞춰 봅시다. 저는 {slot}에 {place}에 있었습니다.', '제 기억을 설명합니다. {slot}의 목적지는 {place}였습니다.'],
    question: ['{target}, {slot}에는 어디에 있었나요?', '{target}의 {slot} 동선을 듣고 싶습니다.', '{slot}의 일을 확인하죠. {target}, 설명해 주세요.', '{target}에게 묻겠습니다. {slot}에는 어디를 살폈나요?', '시점을 맞춰 보고 싶어요. {target}의 {slot} 위치는요?', '{target}, {slot}의 기록을 공유할 수 있나요?', '{slot}에 대한 질문입니다. {target}, 동선을 알려 주세요.', '서로 다른 날의 일을 섞지 맙시다. {target}의 {slot} 기록을 묻습니다.'],
    rebut: ['제 기록에는 {evidence}라고 남아 있습니다. 시점을 함께 확인합시다.', '반박할 근거를 공개합니다. {evidence}', '말만으로 판단하지 말고 이 기록을 보세요. {evidence}', '제가 가진 정보는 이렇습니다. {evidence}', '이 증거와 앞선 말을 비교해 주세요. {evidence}', '추가 기록을 제시하겠습니다. {evidence}', '반론의 근거는 제 수첩입니다. {evidence}', '확인할 내용이 하나 더 있습니다. {evidence}'],
    share: ['제가 확보한 단서입니다. {evidence}', '판단에 도움이 되길 바랍니다. {evidence}', '기록을 공유할게요. {evidence}', '제가 알고 있는 정보는 다음과 같습니다. {evidence}', '이 단서를 함께 검토해 주세요. {evidence}', '숨기지 않고 공개합니다. {evidence}', '수첩의 이 내용을 공유하겠습니다. {evidence}', '모두가 알아야 할 기록이라고 생각합니다. {evidence}'],
    reserve: ['지금은 판단을 유보하겠습니다. 증거가 부족합니다.', '확인되지 않은 말로 동료를 추방하고 싶지 않습니다.', '제 판단은 아직 열려 있습니다.', '정보가 더 모일 때까지 단정하지 않겠습니다.', '말수가 적다는 이유만으로 의심하지 않겠습니다.', '다른 설명이 가능하다면 먼저 들어 보죠.', '불확실한 기억은 불확실하다고 말해야 합니다.', '지금은 누구의 정체도 확정할 수 없습니다.'],
    survival: ['현재 식량 {food}, 식수 {water}입니다. 다음 밤을 준비합시다.', '살아남는 일도 중요합니다. 식량 {food}, 식수 {water}가 남았습니다.', '공동 물자는 식량 {food}와 식수 {water}입니다.', '자원부터 확인하죠. 식량 {food}, 식수 {water}.', '우리의 남은 물자는 식량 {food}, 식수 {water}입니다.', '토론 뒤에는 물자를 챙겨야 합니다. 식량 {food}, 식수 {water}가 있어요.', '현재 창고 기록상 식량 {food}, 식수 {water}입니다.', '밤의 배급을 고려해 주세요. 식량 {food}, 식수 {water}가 남았습니다.'],
    final: ['현재 제 의심 대상은 {target}입니다. {reason}을 근거로 판단했습니다.', '최종적으로 {target}을 주시하겠습니다. 이유는 {reason}입니다.', '{reason} 때문에 지금은 {target}에게 기울어 있습니다.', '제 결론은 잠정적입니다. {reason}에 비추어 {target}이 의심됩니다.', '투표 전 생각을 정리하면, {reason} 때문에 {target}입니다.', '{target}에 대한 제 판단은 {reason}에서 나왔습니다.', '저는 {target}을 의심하지만 새 증거가 나오면 바꿀 수 있습니다. 근거는 {reason}입니다.', '마지막으로 말하겠습니다. {reason}을 고려하면 {target}을 더 확인해야 합니다.']
  };
  function render(intent, slots, random) {
    const pool = templates[intent];
    if (!pool) throw new Error('알 수 없는 발언 의도입니다.');
    return pool[Math.floor(random() * pool.length)].replace(/\{(\w+)\}/g, (_, key) => {
      if (slots[key] === undefined) throw new Error('발언에 필요한 근거가 없습니다: ' + key);
      return String(slots[key]);
    });
  }
  root.IslandMystery.dialogue = Object.freeze({ templates, render });
})(globalThis);
