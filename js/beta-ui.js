(function(root){
  'use strict';
  const g=root.IslandMystery,B=g.betaCore,$=id=>document.getElementById(id);
  let view=null,step=0,diagnostics=[];
  const browser=()=>/Edg\//.test(navigator.userAgent)?'Edge':/Firefox\//.test(navigator.userAgent)?'Firefox':/Chrome\//.test(navigator.userAgent)?'Chrome':/Safari\//.test(navigator.userAgent)?'Safari':'Other';
  const ctx=()=>B.context(view||{},{browser:browser(),width:innerWidth,height:innerHeight});
  const errors=code=>{diagnostics.push({code,phase:ctx().phase});diagnostics=diagnostics.slice(-20);};
  root.addEventListener('error',e=>errors(e.target!==root?'asset-error':'script-error'),true);
  root.addEventListener('unhandledrejection',()=>errors('promise-error'));
  const labels=['규칙 이해도','탐험의 재미','AI의 자연스러움','토론·추리의 재미','공작원 심리전의 긴장감','그래픽 완성도','사운드 완성도','조작 편의성','진행 속도','다시 플레이할 의향'];
  $('beta-ratings').innerHTML=B.ratings.map((k,i)=>`<label>${labels[i]}<select name="rating-${k}"><option value="">선택</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${n}점</option>`).join('')}</select></label>`).join('');
  const fields={fun:'가장 재미있었던 부분',friction:'가장 불편했던 부분',confusing:'이해하기 어려웠던 규칙',suggestion:'개선했으면 하는 기능',bug:'발생한 오류',steps:'오류 재현 순서',expected:'예상한 결과',actual:'실제로 일어난 결과'};
  $('beta-text').innerHTML=Object.entries(fields).map(([k,label])=>`<label>${label}<textarea name="${k}" maxlength="2000" rows="2"></textarea></label>`).join('');
  function review(){const list=$('beta-records');list.replaceChildren();try{const entries=B.load();$('beta-count').textContent=`이 브라우저에 저장된 의견 ${entries.length}개 · 외부 전송 없음`;for(const entry of entries.slice().reverse()){
    const card=document.createElement('details'),title=document.createElement('summary'),body=document.createElement('pre');title.textContent=`${entry.created.slice(0,10)} · ${entry.type} · ${entry.category} · ${entry.severity} · ${entry.status}`;body.textContent=JSON.stringify(entry,null,2);card.append(title,body);
    for(const [key,values]of Object.entries({category:['A','B','C','D','E'],severity:['P0','P1','P2','P3'],status:['new','reviewed','resolved']})){const label=document.createElement('label'),select=document.createElement('select');label.textContent={category:'분류',severity:'우선순위',status:'검토 상태'}[key];for(const value of values){const option=document.createElement('option');option.value=value;option.textContent=value;option.selected=value===entry[key];select.append(option);}select.addEventListener('change',()=>{try{B.update(entry.id,{[key]:select.value});review();}catch(e){$('beta-error').textContent=e.message;}});label.append(select);card.append(label);}list.append(card);
  }}catch(e){$('beta-error').textContent=e.message;}}
  function open(type){$('beta-feedback').showModal();if(type)$('beta-type').value=type;$('beta-error').textContent='';$('beta-result').textContent='';$('beta-context').textContent=JSON.stringify(ctx());review();}
  $('beta-open').addEventListener('click',()=>open());$('beta-close').addEventListener('click',()=>$('beta-feedback').close());
  $('beta-form').addEventListener('submit',e=>{e.preventDefault();$('beta-error').textContent='';try{const form=new FormData(e.target),input=Object.fromEntries(B.fields.map(k=>[k,form.get(k)]));Object.assign(input,{type:form.get('type'),category:form.get('category'),severity:form.get('severity'),consent:$('beta-consent').checked,includeDiagnostics:$('beta-diagnostics').checked,diagnostics,ratings:Object.fromEntries(B.ratings.map(k=>[k,form.get('rating-'+k)]))});B.save(B.make(input,ctx()));e.target.reset();$('beta-result').textContent='이 브라우저에 저장했습니다. 개발자에게 전달하려면 아래 JSON 내보내기를 사용하세요.';review();}catch(e){$('beta-error').textContent=e.message;}});
  $('beta-export').addEventListener('click',()=>{try{const entries=B.load();if(!entries.length)throw Error('내보낼 의견이 없습니다.');const blob=new Blob([JSON.stringify({version:B.VERSION,source:'user-authored-local-feedback',entries},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='island-mystery-feedback.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){$('beta-error').textContent=e.message;}});
  $('beta-delete').addEventListener('click',()=>{try{if(!$('beta-delete-confirm').checked)throw Error('의견 전체 삭제 확인란을 선택하세요.');localStorage.removeItem(B.key);$('beta-delete-confirm').checked=false;review();$('beta-result').textContent='이 브라우저의 피드백만 삭제했습니다.';}catch(e){$('beta-error').textContent=e.message;}});
  const steps=[
    ['게임의 목표','여섯 명이 최대 3일을 보냅니다. 생존자는 탈출하거나 공작원을 추방한 뒤 밤을 버티세요.'],
    ['두 진영','공작원은 정확히 한 명입니다. 다른 사람의 직업은 비밀이며, 의혹과 증거는 다릅니다.'],
    ['나의 직업',()=>view?g.config.roles[view.self.role].name+' · '+g.config.roles[view.self.role].description:'게임을 시작하면 자신의 직업과 능력이 표시됩니다. 탐험·치료·수리·조사·방해 능력을 확인하세요.'],
    ['섬 탐험','아침에 지도에서 지역을 선택하고 “선택 지역 탐험”을 누르세요. 탐사 계획에 기록은 탐험 실행과 별개입니다.'],
    ['자원 확보','밤에는 활동 인원당 식량과 식수가 각각 1개 필요합니다. 부족하면 체력이 줄어듭니다. 의약품과 부품도 함께 확인하세요.'],
    ['비밀 임무','낮에 물자 확보·치료·수리·연구 등을 선택하세요. 자신의 비밀 목표는 이야기 패널에서 확인합니다.'],
    ['토론과 추리','사건 공유 → 의심 → 질문·해명 → 증거 검토 → 최종 의견 순서입니다. 발언 목록을 펼쳐 단서나 해명을 선택하세요. 온라인 자유 채팅은 사람끼리 전달됩니다.'],
    ['투표','후보를 누른 뒤 확인 창에서 확정합니다. 자신에게는 투표할 수 없고 기권도 가능합니다. 동률이면 추방하지 않습니다.'],
    ['밤 행동',()=>`직업 능력 또는 휴식을 선택하세요. ${view?.mode==='online'?'모두 제출하거나 시간이 지나면 서버가 정산합니다.':'행동 결과를 확인하고 하루 정산 버튼을 누르세요.'} 사망·추방 후에는 관전합니다.`],
    ['엔딩과 다음 기록',()=>`통신탑 ${g.config.repairGoals.radio} 또는 보트 ${g.config.repairGoals.boat} 완성 시 탈출합니다. 3일째 밤까지 탈출하지 못하면 공작원 승리 조건을 확인합니다. 결과는 한 번 정산되며 설문은 선택사항입니다.`]
  ];
  function tutorial(){const [title,body]=steps[step];$('beta-tutorial-title').textContent=`${step+1}/10 · ${title}`;$('beta-tutorial-copy').textContent=typeof body==='function'?body():body;$('beta-tutorial-prev').disabled=step===0;$('beta-tutorial-next').textContent=step===9?'안내 마치기':'다음 안내';$('beta-tutorial-context').textContent=view?`현재 ${view.day}일차 · ${g.config.phaseNames[view.phase]} · 안내는 행동을 실행하지 않습니다. 온라인 제한 시간은 계속 흐릅니다.`:'게임 시작 전 안내 · 언제든 건너뛸 수 있습니다.';}
  $('beta-tutorial-open').addEventListener('click',()=>{step=0;tutorial();$('beta-tutorial').showModal();});$('beta-tutorial-prev').addEventListener('click',()=>{step=Math.max(0,step-1);tutorial();});$('beta-tutorial-next').addEventListener('click',()=>{if(step===9)$('beta-tutorial').close();else{step++;tutorial();}});$('beta-tutorial-skip').addEventListener('click',()=>$('beta-tutorial').close());
  g.beta=Object.freeze({observe(v){view=v;if(v.outcome){const b=document.createElement('button');b.className='secondary';b.id='ending-feedback';b.textContent='플레이 평가 · 선택 설문';b.addEventListener('click',()=>open('survey'));$('ending-panel').append(b);}if($('beta-tutorial').open)tutorial();},error:errors});
  // Expiration applies on startup and every time the local review is opened.
  try{B.load();}catch{}
})(globalThis);
