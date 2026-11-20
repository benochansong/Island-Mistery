(function (root) {
  'use strict';
  const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
  root.IslandMystery.config = freeze({
    maxDays: 3,
    discussionRounds: ['사건 공유', '의심 제기', '질문과 해명', '증거 검토', '최종 의견'],
    defaultDifficulty: 'normal',
    difficulty: {
      easy: { evidenceWeight: 0.8, contradictionThreshold: 0.95, attention: .75, relationshipWeight: 1.25, judgmentError: 3, memoryDays: 1, planning: 1 },
      normal: { evidenceWeight: 1, contradictionThreshold: 0.85, attention: 1, relationshipWeight: 1, judgmentError: .8, memoryDays: 3, planning: 2 },
      hard: { evidenceWeight: 1.12, contradictionThreshold: 0.8, attention: 1.15, relationshipWeight: .65, judgmentError: .2, memoryDays: 3, planning: 3 }
    },
    mechanics: {
      repair: { engineer: { cost: 1, amount: 3 }, other: { cost: 2, amount: 2 } },
      sabotage: 4, hide: 3, gather: 2, medicineCost: 1,
      engineerExplorationBonus: .1, maxSuccess: .98, maxClue: .9,
      explorerJungleRisk: .4, injury: [12, 24], supplyChance: .12, supplyWater: 2,
      investigation: { suspicious: .75, innocent: .20, reliability: .7, weight: 30 }
    },
    reasoning: { evidenceCap: 24, betrayalWeight: 18, traceWeight: 7, contradictionCap: 16, contradictionWeight: 8, voteThreshold: 43, cautionWeight: 12, aggressionWeight: 5, directProofFloor: 55, recordChance: .65, betrayalWitnessChance: .35 },
    strategy: { dangerHealth: 30, healHealth: 55, patientHealth: 76, supplyDays: 2, partsReserve: 6, urgentProgress: .65, repairChance: .6 },
    storyBalance: { clueChance: .55, unlockChance: .4, hiddenInjuryChance: .4, followupWeight: 3, eventWeights: { 'event-31': 6, 'event-36': 9 } },
    relationships: {
      initialTrust: 50, initialSuspicion: 20,
      cooperation: [5, -2], sharing: [8, -3], healing: [12, -5],
      verifiedLie: [-20, 20], betrayal: [-30, 30], suspicious: [-5, 10], alibi: [5, -20]
    },
    observationChance: [0, 0.25, 0.5, 0.75],
    personalities: {
      seo: { logicalThinking: 0.95, aggression: 0.25, cooperation: 0.6, caution: 0.9, emotionalSensitivity: 0.1, deceptionTendency: 0.15 },
      min: { logicalThinking: 0.35, aggression: 0.65, cooperation: 0.65, caution: 0.25, emotionalSensitivity: 0.95, deceptionTendency: 0.35 },
      ha: { logicalThinking: 0.7, aggression: 0.15, cooperation: 0.95, caution: 0.95, emotionalSensitivity: 0.3, deceptionTendency: 0.1 },
      do: { logicalThinking: 0.65, aggression: 0.95, cooperation: 0.45, caution: 0.25, emotionalSensitivity: 0.55, deceptionTendency: 0.45 },
      ji: { logicalThinking: 0.8, aggression: 0.3, cooperation: 0.25, caution: 0.85, emotionalSensitivity: 0.2, deceptionTendency: 0.75 },
      player: { logicalThinking: 0.7, aggression: 0.5, cooperation: 0.6, caution: 0.65, emotionalSensitivity: 0.4, deceptionTendency: 0.4 }
    },
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
