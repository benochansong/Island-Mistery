(function (root) {
  'use strict';
  const game = root.IslandMystery, { $ } = game.ui;
  let state = null, busy = false;
  function refreshWelcome() { game.ui.welcome(game.storage.load(), Boolean(state)); }
  function render() { game.ui.render(game.state.viewFor(state)); }
  function persist() { game.ui.saveStatus(game.storage.save(state)); }
  function openGame() { render(); game.ui.screen('game'); if (state.outcome) $('ending-panel').focus(); }
  function newGame() { state = game.state.create(); $('log-filter').value = 'all'; $('action-error').textContent = ''; persist(); openGame(); }
  function requestNew() {
    const saved = game.storage.load();
    if (state || ['loaded', 'invalid'].includes(saved.status)) $('restart-dialog').showModal(); else newGame();
  }
  function dispatch(action) {
    if (!state || busy) return;
    busy = true;
    try {
      const hadOutcome = Boolean(state.outcome);
      state = game.state.transition(state, action); $('action-error').textContent = ''; render(); persist();
      if (!hadOutcome && state.outcome) { $('ending-panel').focus(); $('ending-panel').scrollIntoView({ block: 'start' }); }
    } catch (error) { $('action-error').textContent = error.message; }
    finally { busy = false; }
  }
  function menu() { refreshWelcome(); game.ui.screen('welcome'); }
  $('new-button').addEventListener('click', requestNew);
  $('restart-button').addEventListener('click', requestNew);
  $('ending-panel').addEventListener('click', event => { if (event.target.closest('#ending-new-button')) requestNew(); });
  $('confirm-restart').addEventListener('click', () => { $('restart-dialog').close(); newGame(); });
  $('cancel-restart').addEventListener('click', () => $('restart-dialog').close());
  $('continue-button').addEventListener('click', () => {
    const result = game.storage.load(); state = state || result.state;
    if (state) { openGame(); game.ui.saveStatus(result.status === 'loaded' && JSON.stringify(result.state) === JSON.stringify(state)); } else refreshWelcome();
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
    if (action) dispatch({ type: 'ACT', ...action });
  });
  $('next-button').addEventListener('click', () => dispatch({ type: 'NEXT' }));
  $('log-filter').addEventListener('change', () => { if (state) game.ui.renderJournal(game.state.viewFor(state)); });
  $('menu-button').addEventListener('click', menu);
  $('home-link').addEventListener('click', event => { event.preventDefault(); menu(); });
  $('help-button').addEventListener('click', () => $('help-dialog').showModal());
  $('close-help').addEventListener('click', () => $('help-dialog').close());
  refreshWelcome();
})(globalThis);
