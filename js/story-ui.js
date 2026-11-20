(function(root){
  'use strict';
  const game=root.IslandMystery,D=game.storyData,$=id=>document.getElementById(id);
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const name=id=>game.data.survivors.find(p=>p.id===id)?.name||'없음';
  function render(view){
    $('story-dashboard').hidden=!view.storyEnabled;
    if(view.storyEnabled){
      $('story-chapter').textContent=`DAY ${view.day} · ${view.chapter} · 시드 ${view.replaySeed??'이전 저장'}`;
      const m=view.self.mission,definition=D.missions.find(x=>x.id===m.id);
      $('mission-info').innerHTML=`<p class="eyebrow">나만의 비밀 임무</p><h2>${esc(definition.title)}</h2><p>${esc(definition.description)}</p>${['protect','trust','escapeTogether'].includes(m.id)?`<p>대상: ${esc(name(m.target))}</p>`:''}<strong>${m.complete?'달성 · 추가 점수 100':'진행 중 · '+m.progress}</strong><p class="small muted">진영의 승리 조건은 그대로 유지됩니다. 완료 여부는 결말까지의 실제 기록으로 평가합니다.</p>`;
      $('hidden-sites').innerHTML=D.sites.map(site=>`<article><strong>${view.unlockedSites.includes(site.id)?'◇':'▧'} ${esc(site.name)}</strong><p>${view.unlockedSites.includes(site.id)?view.self.visitedSites.includes(site.id)?'탐험 완료':'발견됨 · 부모 지역 선택 후 탐험':'잠김 · 해당 지역을 반복 탐험하거나 사건의 단서를 찾으세요'}</p><button class="quiet" data-hidden-parent="${site.parent}" ${view.outcome||view.pendingEvent?'disabled':''}>${esc(game.discussion.place(site.parent))} 선택</button></article>`).join('');
      $('story-timeline').innerHTML=view.storyHistory.slice().reverse().map(e=>`<li><span class="log-time">${e.day}일차 · ${e.audience==='public'?'공개 사건':'나의 사건'}</span><p>${esc(e.text)}</p></li>`).join('')||'<li>탐험과 낮 행동 뒤 사건을 확인하세요. 일반 사건은 하루 최대 2개입니다.</li>';
      $('story-clues').innerHTML=view.self.storyClues.map(c=>{const d=D.clues.find(d=>d.id===c.id);return `<details><summary>${esc(d.title)} · ${c.shared?'공개':'나만의 단서'}</summary><p>${esc(d.text)}</p></details>`;}).join('')||'<p>첫 탐험이나 연구 기록 조사로 단서를 찾을 수 있습니다.</p>';
    }
    const pending=view.pendingEvent,dialog=$('event-dialog');
    if(pending&&!view.outcome){
      $('event-category').textContent=(pending.private?'개인 사건 · ':'공개 사건 · ')+pending.category;
      $('event-title').textContent=pending.name;
      dialog.classList.toggle('important-event',['미스터리','특별 스토리'].includes(pending.category));
      $('event-options').innerHTML=pending.choices.map(c=>`<button class="secondary" data-event-instance="${esc(pending.instance)}" data-event-choice="${esc(c.id)}" ${c.disabled?'disabled':''}>${esc(c.label)}${c.disabled?' · 사용 불가':''}</button>`).join('');
      if(!dialog.open)dialog.showModal();
      $('next-button').disabled=true; $('plan-button').disabled=true;
    }else if(dialog.open)dialog.close();
    if(view.outcome&&view.endingDetail){const e=view.endingDetail,m=view.self.mission;
      $('ending-panel').insertAdjacentHTML('beforeend',`<div class="ending-details"><h3>${esc(e.title)}</h3><p>승리 진영: ${view.outcome.winner==='survivors'?'생존자':view.outcome.winner==='saboteur'?'공작원':'없음'}</p><p>최종 활동 인물: ${e.survivors.map(name).map(esc).join(', ')||'없음'}</p><p>생존 인물: ${view.players.filter(p=>p.isAlive).map(p=>esc(p.name)).join(", ")||"없음"}</p><p>추방 인물: ${view.players.filter(p=>p.isExiled).map(p=>esc(p.name)).join(", ")||"없음"}</p><p>공작원의 정체: <strong>${esc(name(e.spyId))}</strong></p><p>발견한 이야기 단서 ${e.clues.length}/${D.clues.length} · 아직 발견하지 못한 비밀 ${e.unknownSecrets}개</p><p>나의 개인 목표: ${esc(D.missions.find(x=>x.id===m.id).title)} — ${m.complete?'달성 (+100점)':'미달성'}</p><details><summary>인물별 목표 결과</summary><ul>${e.missions.map(m=>`<li>${esc(name(m.playerId))}: ${esc(D.missions.find(x=>x.id===m.id).title)} · ${m.complete?'달성':'미달성'}</li>`).join('')}</ul></details><details><summary>이번 이야기 요약</summary><ul>${e.events.map(x=>`<li>${x.day}일차 · ${esc(x.text)}</li>`).join('')}</ul><p>${e.clues.map(c=>esc(D.clues.find(x=>x.id===c.id).title)).join(' · ')||'확보한 이야기 단서 없음'}</p></details><p id="collection-status" class="small">완료한 기록을 도감에 보관합니다.</p></div>`);
    }
  }
  function codex(){const result=game.codex.load(),d=result.data;
    $('codex-content').innerHTML=!result.available?'<p>수집 기록을 읽을 수 없습니다. 기존 데이터는 덮어쓰지 않았습니다.</p>':`<p>완료한 이야기 ${d.runs.length}회 · 발견 기록 ${d.clues.length}/${D.clues.length}</p><p class="small muted">완료한 게임의 수집 기록입니다. 현재 게임의 AI에게 전달되지 않습니다.</p><h3>연구 기록</h3>${D.clues.map(c=>`<details><summary>${d.clues.includes(c.id)?esc(c.title):'미발견 기록'}</summary><p>${d.clues.includes(c.id)?esc(c.text):'새로운 선택과 탐험으로 발견하세요.'}</p></details>`).join('')}<h3>주요 사건 ${d.events.length}/36</h3><ul>${d.events.map(id=>`<li>${esc(D.events.find(e=>e.id===id)?.name||id)}</li>`).join('')}</ul><h3>숨겨진 장소</h3><ul>${D.sites.map(s=>`<li>${d.sites.includes(s.id)?esc(s.name):'미발견 장소'} · ${d.sites.includes(s.id)?'발견':'잠김'}</li>`).join('')}</ul><h3>달성한 세부 엔딩</h3><p>${d.endings.map(id=>esc({unknown:'남겨진 의문',stranded:'섬에 남겨진 기록',covert:'의혹을 피한 공작원',interference:'마지막 구조 신호의 단절',captured:'공작원 추방 후 구조',truth:'진실을 밝힌 탈출',research:'연구 자료와 함께 탈출',together:'여섯 명의 귀환',partial:'남겨진 이름들'}[id]||id)).join(' · ')||'아직 없음'}</p><h3>달성한 개인 목표</h3><p>${d.missions.map(id=>esc(D.missions.find(m=>m.id===id)?.title||id)).join(' · ')||'아직 없음'}</p><h3>인물 기록</h3>${d.characters.map(id=>`<p>${esc(name(id))} — ${esc(game.data.survivors.find(p=>p.id===id)?.personality||'')}. 섬에 함께 남겨진 생존자. 다음 게임의 직업과 진영은 새로 배정됩니다.</p>`).join('')}`;
    $('codex-dialog').showModal();
  }
  game.storyUI=Object.freeze({render,codex});
})(globalThis);
