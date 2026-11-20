(function (root) {
  'use strict';
  const game = root.IslandMystery, { $ } = game.ui;
  let state = null, busy = false, pendingVote = null;
  function refreshWelcome() { game.ui.welcome(game.storage.load(), Boolean(state)); }
  function render(action = null) { const view = game.state.viewFor(state); game.ui.render(view); game.storyUI.render(view); game.presentation.render(view, action); }
  function persist() { game.ui.saveStatus(game.storage.save(state)); const captured = game.codex.record(game.state.viewFor(state)); if ($('collection-status')) $('collection-status').textContent = captured ? '완료 기록이 미스터리 도감에 저장되었습니다.' : '도감 저장 불가 · 현재 기록은 유지됩니다.'; }
  function openGame() { render(); game.ui.screen('game'); game.presentation.screen('game'); if (state.outcome) $('ending-panel').focus(); }
  function newGame() { const raw = $('seed-input').value.trim(), seed = raw ? Number(raw) : undefined; if (seed !== undefined && (!Number.isInteger(seed) || seed < 0 || seed > 4294967295)) { $('save-description').textContent = '시드는 0~4294967295의 정수여야 합니다.'; return; } state = game.state.create(undefined, seed, $('difficulty').value); $('log-filter').value = 'all'; $('action-error').textContent = ''; persist(); openGame(); }
  function requestNew() {
    const saved = game.storage.load();
    if (state || ['loaded', 'migrated', 'invalid'].includes(saved.status)) $('restart-dialog').showModal(); else newGame();
  }
  function dispatch(action) {
    if (!state || busy) return;
    busy = true;
    try {
      const hadOutcome = Boolean(state.outcome);
      state = game.state.transition(state, action); $('action-error').textContent = ''; $('event-error').textContent = ''; render(action); persist();
      if (!hadOutcome && state.outcome) { $('ending-panel').focus(); $('ending-panel').scrollIntoView({ block: 'start' }); }
    } catch (error) { $('action-error').textContent = error.message; $('event-error').textContent = error.message; }
    finally { busy = false; }
  }
  function menu() { refreshWelcome(); game.ui.screen('welcome'); game.presentation.screen('welcome'); }
  $('new-button').addEventListener('click', requestNew);
  $('restart-button').addEventListener('click', requestNew);
  $('ending-panel').addEventListener('click', event => { if (event.target.closest('#ending-new-button')) requestNew(); });
  $('confirm-restart').addEventListener('click', () => { $('restart-dialog').close(); newGame(); });
  $('cancel-restart').addEventListener('click', () => $('restart-dialog').close());
  $('continue-button').addEventListener('click', () => {
    const result = game.storage.load(); state = state || result.state;
    if (state) { openGame(); if (result.status === 'migrated') persist(); else game.ui.saveStatus(result.status === 'loaded' && JSON.stringify(result.state) === JSON.stringify(state)); } else refreshWelcome();
  });
  $('map-locations').addEventListener('click', event => {
    const button = event.target.closest('[data-location]');
    if (button && !button.disabled) dispatch({ type: 'SELECT_LOCATION', location: button.dataset.location });
  });
  $('plan-button').addEventListener('click', () => dispatch({ type: 'PLAN_EXPEDITION' }));
  $('action-list').addEventListener('click', event => {
    const button = event.target.closest('[data-action-index]');
    if (!button || button.disabled) return;
    const action = game.ui.actionAt(Number(button.dataset.actionIndex));
    if (action?.kind === 'vote') { pendingVote = action; $('vote-choice').textContent = action.label; $('vote-dialog').showModal(); }
    else if (action) dispatch({ type: 'ACT', ...action });
  });
  $('confirm-vote').addEventListener('click', () => { const vote = pendingVote; pendingVote = null; $('vote-dialog').close(); if (vote) dispatch({ type: 'ACT', ...vote }); });
  $('cancel-vote').addEventListener('click', () => { pendingVote = null; $('vote-dialog').close(); });
  $('skip-discussion').addEventListener('click', () => dispatch({ type: 'SKIP_DISCUSSION' }));
  $('next-button').addEventListener('click', () => dispatch({ type: 'NEXT' }));
  $('log-filter').addEventListener('change', () => { if (state) game.ui.renderJournal(game.state.viewFor(state)); });
  $('menu-button').addEventListener('click', menu);
  $('home-link').addEventListener('click', event => { event.preventDefault(); menu(); });
  $('help-button').addEventListener('click', () => $('help-dialog').showModal());
  $('close-help').addEventListener('click', () => $('help-dialog').close());
  $('event-dialog').addEventListener('cancel', event => event.preventDefault());
  $('event-options').addEventListener('click', event => { const b = event.target.closest('[data-event-choice]'); if (b && !b.disabled) dispatch({type:'EVENT_CHOICE', instance:b.dataset.eventInstance, choiceId:b.dataset.eventChoice}); });
  $('hidden-sites').addEventListener('click', event => { const b = event.target.closest('[data-hidden-parent]'); if (b && !b.disabled) dispatch({type:'SELECT_LOCATION',location:b.dataset.hiddenParent}); });
  $('codex-button').addEventListener('click', game.storyUI.codex);
  $('close-codex').addEventListener('click', () => $('codex-dialog').close());
  game.presentation.init(location => dispatch({type: 'SELECT_LOCATION', location}));
  refreshWelcome();
})(globalThis);
