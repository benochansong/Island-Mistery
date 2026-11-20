(function(root){
  'use strict';
  const game=root.IslandMystery;
  const modes=[
    ['classic','기본 게임','기존 규칙으로 섬의 비밀을 탐험합니다.'],
    ['storm','폭풍의 섬','탐험 성공률 -20%p, 정글·통신탑 부상 확률 1.5배.'],
    ['scarcity','부족한 물자','식량과 식수 각각 6개로 시작합니다.'],
    ['darkness','어둠 속의 진실','1일차 무작위 단서 확률 35%, 자동 안내문 없음. 연구 조사는 가능합니다.'],
    ['broken','고장 난 통신탑','통신탑은 추가 손상 4를 먼저 복구해야 수리도가 오릅니다. 보트 경로도 가능합니다.'],
    ['distrust','불신의 시작','모든 인물의 초기 상호 신뢰 -20. 공개 증거와 협력이 중요합니다.'],
    ['deadline','최후의 3일','매일 밤 추가 위험 확률 65% / 80% / 95%. 물자 손실과 전원 부상이 발생합니다.']
  ].map(([id,name,description])=>({id,name,description}));
  function initialize(s,id='classic'){
    if(!modes.some(m=>m.id===id))throw Error('알 수 없는 도전 모드입니다.');
    s.challenge={id,radioDebt:id==='broken'?4:0,hazardDays:[]};
    if(id==='scarcity')s.resources.food=s.resources.water=6;
    if(id==='distrust')for(const m of Object.values(s.secrets))for(const id in m.trust)m.trust[id]=Math.max(0,m.trust[id]-20);
  }
  function repair(s,key,amount){if(key==='radio'&&amount>0&&s.challenge?.radioDebt){const paid=Math.min(amount,s.challenge.radioDebt);s.challenge.radioDebt-=paid;return amount-paid;}return amount;}
  function night(s,random,record){
    if(s.challenge?.id!=='deadline'||s.challenge.hazardDays.includes(s.day))return;
    s.challenge.hazardDays.push(s.day);
    if(random()<.5+s.day*.15){const key=random()<.5?'food':'water',loss=Math.min(s.resources[key],s.day+1);s.resources[key]-=loss;for(const p of s.players.filter(p=>p.isAlive&&!p.isExiled)){p.health=Math.max(0,p.health-5*s.day);p.isAlive=p.health>0;}record(s,`최후의 3일 · 위험 사건: ${key==='food'?'식량':'식수'} -${loss}, 활동 인원 체력 -${5*s.day}.`,null,'public','challenge');}
    else record(s,'최후의 3일 · 오늘 밤은 위험을 피했다.',null,'public','challenge');
  }
  function valid(s){const c=s.challenge;return c===undefined||Boolean(c&&modes.some(m=>m.id===c.id)&&Number.isInteger(c.radioDebt)&&c.radioDebt>=0&&c.radioDebt<=4&&Array.isArray(c.hazardDays)&&new Set(c.hazardDays).size===c.hazardDays.length&&c.hazardDays.every(d=>Number.isInteger(d)&&d>=1&&d<=3));}
  game.challenges=Object.freeze({modes,initialize,repair,night,valid});
})(globalThis);
