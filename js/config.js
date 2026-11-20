(function (root) {
  'use strict';
  root.IslandMystery.config = Object.freeze({
    maxDays: 3,
    initialResources: { food: 12, water: 12, medicine: 2, parts: 2 },
    phases: ['morning', 'afternoon', 'discussion', 'voting', 'night'],
    phaseNames: { morning: '아침 · 탐험', afternoon: '낮 · 비밀 임무', discussion: '저녁 · 토론', voting: '투표 · 추방 결정', night: '밤 · 직업 행동' },
    roles: {
      explorer: { name: '탐험가', description: '탐험 성공률 +15%, 정글 위험 감소. 밤에도 탐험 가능.', goal: '숨겨진 기록을 찾아 생존자들과 탈출하세요.' },
      doctor: { name: '의사', description: '의약품 1개로 체력 45 회복. 다른 직업은 25 회복.', goal: '부상자를 치료하고 생존자들의 탈출을 도우세요.' },
      engineer: { name: '기술자', description: '부품 1개로 수리도 +3. 다른 직업은 부품 2개로 +2.', goal: '통신탑이나 보트를 완성하여 탈출 경로를 확보하세요.' },
      investigator: { name: '조사관', description: '탐험 단서 확률 +25%. 밤에 한 사람의 흔적 조사 가능.', goal: '불확실한 단서를 모아 공작원을 찾아내세요.' },
      saboteur: { name: '공작원', description: '낮·밤에 물자를 숨기거나 시설을 파괴할 수 있습니다.', goal: '자신의 추방을 피하고 3일 밤까지 탈출을 저지하세요.' }
    },
    repairGoals: { radio: 18, boat: 14 },
    explorationBonus: 0.15, investigatorBonus: 0.25,
    restHeal: 10, doctorHeal: 45, normalHeal: 25,
    shortageDamage: { food: 20, water: 30 },
    locations: {
      coast: { success: 0.90, injury: 0.08, clue: 0.12, loot: { food: [2, 4], water: [3, 5], parts: [0, 1] } },
      jungle: { success: 0.78, injury: 0.30, clue: 0.24, loot: { food: [3, 5], medicine: [0, 2] } },
      lab: { success: 0.74, injury: 0.22, clue: 0.38, loot: { medicine: [1, 2], parts: [1, 3] } },
      tower: { success: 0.76, injury: 0.18, clue: 0.26, loot: { parts: [2, 4] } }
    }
  });
})(globalThis);
