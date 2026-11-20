(function (root) {
  'use strict';
  const game = root.IslandMystery = root.IslandMystery || {};
  game.data = Object.freeze({
    version: 3,
    locations: [
      { id: 'coast', name: '해안가', label: '난파선이 밀려온 곳', marker: '≈', x: 32, y: 73, risk: '낮음', resources: '식량 · 식수', description: '젖은 모래 위로 배의 잔해가 흩어져 있다. 파도에 떠밀려온 물자와 우리가 이곳에 온 흔적을 찾을 수 있을지도 모른다.' },
      { id: 'jungle', name: '정글', label: '빛이 닿지 않는 숲', marker: '♧', x: 49, y: 52, risk: '높음', resources: '식량 · 의약품', description: '빽빽한 나무 사이로 좁은 길이 이어진다. 먹을 수 있는 열매와 약초가 있을 법하지만, 수풀 너머에서 무언가 움직인다.' },
      { id: 'lab', name: '버려진 연구소', label: '멈춰 버린 실험', marker: '⌑', x: 33, y: 35, risk: '보통', resources: '의약품 · 단서', description: '덩굴에 뒤덮인 건물의 문이 반쯤 열려 있다. 빛바랜 표지판과 남겨진 문서가 이 섬의 과거를 가리키고 있다.' },
      { id: 'tower', name: '통신탑', label: '마지막 신호', marker: '⌁', x: 68, y: 29, risk: '보통', resources: '부품 · 구조 신호', description: '능선 위로 녹슨 철탑이 솟아 있다. 끊어진 배선을 복구할 수 있다면, 바다 건너 누군가에게 닿을 수 있을 것이다.' }
    ],
    survivors: [
      { id: 'player', name: '당신', personality: '기억을 잃은 생존자', initials: '나' },
      { id: 'seo', name: '서윤', personality: '논리적인 분석가', initials: '서' },
      { id: 'do', name: '도현', personality: '공격적인 리더', initials: '도' },
      { id: 'ha', name: '하린', personality: '신중한 협력가', initials: '하' },
      { id: 'min', name: '민재', personality: '감정적인 생존자', initials: '민' },
      { id: 'ji', name: '지우', personality: '비밀이 많은 인물', initials: '지' }
    ],
    resources: [ { id: 'food', name: '식량', icon: '◒', unit: '인분' }, { id: 'water', name: '식수', icon: '◈', unit: '회분' }, { id: 'medicine', name: '의약품', icon: '✚', unit: '개' }, { id: 'parts', name: '부품', icon: '⚙', unit: '개' } ]
  });
})(globalThis);
