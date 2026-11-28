import { fighters } from './roster.mjs';

const byId = id => document.getElementById(id);
const codeInput = byId('pieCode');
const notes = byId('tastingNotes');
const radios = [...document.querySelectorAll('input[name="winner"]')];
const corners = [
  {select: byId('redFighter'), label: byId('redLabel'), value: 'red', x: .3, y: .35},
  {select: byId('whiteFighter'), label: byId('whiteLabel'), value: 'white', x: .7, y: .38}
];
const canvas = byId('arenaCanvas');
const context = canvas.getContext('2d');
const arena = new Image();
arena.onload = draw;
arena.src = '/images/other/original/Arena.png';

const prefix = 'pvp-judge-event:';
let battle = null;
let editing = null;
let replacing = null;
let generation = 0;
let flushing = false;
let retryTimer;
let delay = 1000;

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (arena.complete && arena.naturalWidth) context.drawImage(arena, 0, canvas.height - 542, canvas.width, 542);
  for (const corner of corners) {
    if (!corner.image?.naturalWidth) continue;
    const width = canvas.width * .4;
    const height = width * corner.image.naturalHeight / corner.image.naturalWidth;
    context.drawImage(corner.image, canvas.width * corner.x - width / 2, canvas.height * corner.y - height / 2, width, height);
  }
}

function setArtwork() {
  const selected = radios.find(radio => radio.checked)?.value;
  for (const corner of corners) {
    const name = corner.select.value;
    corner.label.textContent = name || (corner.value === 'red' ? 'Red corner' : 'White corner');
    const pose = selected ? (selected === corner.value ? 2 : 3) : 1;
    if (!name) {
      corner.image = null;
      continue;
    }
    const filename = encodeURIComponent(name.replaceAll(' ', '-'));
    const image = new Image();
    corner.image = image;
    image.onload = draw;
    image.onerror = () => {
      if (pose !== 1 && corner.image === image) {
        image.onerror = null;
        image.src = '/images/fighters/800h/' + filename + '-1.png';
      }
    };
    image.src = '/images/fighters/800h/' + filename + '-' + pose + '.png';
  }
  draw();
}

function setPair(pair, practiceSetup) {
  corners.forEach((corner, index) => {
    const names = practiceSetup ? fighters.map(fighter => fighter.name) : pair ? [pair[corner.value]] : [''];
    corner.select.replaceChildren(...names.map(name => new Option(name || '—', name)));
    corner.select.selectedIndex = practiceSetup ? index : 0;
    corner.select.disabled = !practiceSetup;
  });
  setArtwork();
}

function clearForm() {
  editing = null;
  replacing = null;
  notes.value = '';
  radios.forEach(radio => {radio.checked = false;});
  byId('submitBtn').textContent = 'ADD JUDGE VOTE 🥊';
  byId('cancelEdit').hidden = true;
  setArtwork();
}

function button(label, action) {
  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'battle-action';
  control.textContent = label;
  control.onclick = action;
  return control;
}

function renderVotes() {
  const votes = battle?.votes ?? [];
  byId('score').textContent = battle?.pair
    ? votes.length
      ? battle.pair.red + ' ' + battle.redScore.toFixed(2) + ' — ' + battle.whiteScore.toFixed(2) + ' ' + battle.pair.white +
        ' (' + votes.length + (votes.length === 1 ? ' judge)' : ' judges)')
      : 'No judge votes yet.'
    : '';
  byId('votes').replaceChildren(...votes.map(vote => {
    const row = document.createElement('li');
    const text = document.createElement('p');
    text.textContent = vote.winner + (vote.notes ? ' — ' + vote.notes : '');
    row.append(text, button('Edit vote', () => editVote(vote)), button('Remove vote', () => {
      if (confirm('Remove this vote from the score? The audit history will retain it.')) {
        enqueue('remove', vote, vote.winner, vote.notes);
        if (editing?.judge_id === vote.judge_id) clearForm();
      }
    }));
    return row;
  }));
}

function editVote(vote, draft = vote, rejectedKey = null) {
  editing = vote;
  replacing = rejectedKey;
  for (const radio of radios) radio.checked = draft.winner === battle.pair[radio.value];
  notes.value = draft.notes;
  byId('submitBtn').textContent = 'SAVE CORRECTION';
  byId('cancelEdit').hidden = false;
  setArtwork();
  radios[0].focus();
}

async function load(code, fresh = true) {
  const request = ++generation;
  if (fresh) {
    battle = null;
    setPair(null, false);
    clearForm();
    renderVotes();
    byId('judgeControls').disabled = true;
    byId('battleStatus').textContent = code ? 'Loading fight…' : 'Scan a fight card or enter its code.';
  }
  if (!code) return false;
  try {
    const response = await fetch('/api/battle?code=' + encodeURIComponent(code), {signal: AbortSignal.timeout(10000)});
    const data = await response.json();
    if (request !== generation) return false;
    if (response.status === 404 && /^DEMO-/.test(code)) {
      battle = {code, votes: []};
      setPair(null, true);
      byId('battleStatus').textContent = 'Practice fight. Choose the pairing before casting the first vote.';
    } else {
      if (!response.ok) throw new Error(data.error);
      const changePair = !battle?.pair || battle.pair.code !== data.pair.code;
      battle = {...data, code};
      if (changePair) setPair(battle.pair, false);
      byId('battleStatus').textContent = (/^DEMO-/.test(code) ? 'Practice fight ' : 'Fight ') + code;
    }
    byId('judgeControls').disabled = false;
    renderVotes();
    return true;
  } catch (error) {
    if (request === generation) byId('battleStatus').textContent = error.message || 'Could not load fight.';
    return false;
  }
}

function entries() {
  const pending = [];
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(prefix)) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const stored = JSON.parse(raw);
      // The previous practice UI saved the operation directly.
      const item = stored.operation ?? stored;
      if (item.operationId && prefix + item.operationId === key) pending.push({key, operation: item, rejected: stored.rejected});
    } catch {
      // Keep unreadable records in local storage for manual recovery.
      byId('voteStatus').textContent = 'A saved vote could not be read. Its local record has been retained.';
    }
  }
  return pending;
}

function renderQueue(pending = entries()) {
  byId('outbox').replaceChildren(...pending.map(({key, operation, rejected}) => {
    const row = document.createElement('li');
    const text = document.createElement('p');
    text.textContent = operation.code + ' · ' + operation.action + ' · ' + operation.winner +
      (rejected ? ' · Needs review: ' + rejected : ' · Pending confirmation') +
      (operation.notes ? '\n' + operation.notes : '');
    row.append(text);
    if (rejected) {
      row.append(button('Review current votes', async () => {
        openCode(operation.code);
        if (!await load(operation.code)) return;
        const vote = battle.votes.find(item => item.judge_id === operation.judgeId);
        if (vote && operation.action === 'edit') editVote(vote, operation, key);
      }), button('Discard local operation', () => {
        if (!confirm('Discard this rejected local operation?')) return;
        try {
          localStorage.removeItem(key);
          renderQueue();
        } catch {
          byId('voteStatus').textContent = 'Could not remove the rejected record from browser storage.';
        }
      }));
    } else {
      row.append(button('Retry pending vote', flush));
    }
    return row;
  }));
}

function enqueue(action, vote, winner, tastingNotes, rejectedKey = null) {
  if (!battle) return false;
  try {
    if (vote && entries().some(entry => !entry.rejected && entry.operation.code === battle.code &&
        entry.operation.judgeId === vote.judge_id)) {
      byId('voteStatus').textContent = 'There is already a pending correction for this judge.';
      return false;
    }
    const [red, white] = corners.map(corner => corner.select.value);
    if (red === white) {
      byId('voteStatus').textContent = 'Choose two different fighters.';
      return false;
    }
    const operation = {operationId: crypto.randomUUID(), judgeId: vote?.judge_id ?? crypto.randomUUID(),
      code: battle.code, red, white, action, revision: vote ? vote.revision + 1 : 1, winner, notes: tastingNotes};
    localStorage.setItem(prefix + operation.operationId, JSON.stringify({operation}));
    if (rejectedKey) localStorage.removeItem(rejectedKey);
    byId('voteStatus').textContent = 'Saved on this device. Awaiting confirmation.';
    renderQueue();
    void flush();
    return true;
  } catch {
    byId('voteStatus').textContent = 'Browser storage is unavailable. The vote could not be queued.';
    return false;
  }
}

async function flush() {
  if (flushing) return;
  flushing = true;
  clearTimeout(retryTimer);
  let retry = false;
  try {
    const refreshed = new Set();
    for (const {key, operation, rejected} of entries()) {
      if (rejected) continue;
      try {
        const response = await fetch('/api/battle', {
          method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(operation),
          signal: AbortSignal.timeout(10000)
        });
        const data = await response.json();
        if (response.ok && data.success === true && data.operationId === operation.operationId) {
          localStorage.removeItem(key);
          refreshed.add(operation.code);
          byId('voteStatus').textContent = 'Vote confirmed. Receipt: ' + operation.operationId;
        } else if ([400, 403, 404, 409, 413, 415].includes(response.status)) {
          if (localStorage.getItem(key)) {
            localStorage.setItem(key, JSON.stringify({operation, rejected: data.error || 'Request rejected'}));
          }
          refreshed.add(operation.code);
          byId('voteStatus').textContent = 'A local vote needs review.';
        } else {
          retry = true;
        }
      } catch {
        retry = true;
      }
    }
    const visibleCode = new URLSearchParams(location.search).get('code');
    if (refreshed.has(visibleCode)) await load(visibleCode, false);
    const remaining = entries();
    renderQueue(remaining);
    if (remaining.some(entry => !entry.rejected)) {
      if (retry) byId('voteStatus').textContent = 'Pending votes are saved on this device. Retrying automatically.';
      retryTimer = setTimeout(flush, retry ? delay : 0);
      delay = retry ? Math.min(delay * 2, 30000) : 1000;
    } else {
      delay = 1000;
    }
  } catch {
    byId('voteStatus').textContent = 'Unable to read browser storage.';
  } finally {
    flushing = false;
  }
}

function openCode(code) {
  codeInput.value = code;
  const url = new URL(location.href);
  url.search = '';
  if (code) url.searchParams.set('code', code);
  history.replaceState(null, '', url);
}

byId('loadBattle').onsubmit = event => {
  event.preventDefault();
  const code = codeInput.value.trim();
  openCode(code);
  void load(code);
};
byId('judgeForm').onsubmit = event => {
  event.preventDefault();
  const selected = radios.find(radio => radio.checked);
  if (!selected) return;
  const winner = corners.find(corner => corner.value === selected.value).select.value;
  if (enqueue(editing ? 'edit' : 'add', editing, winner, notes.value.trim(), replacing)) clearForm();
};
byId('cancelEdit').onclick = clearForm;
for (const control of [...corners.map(corner => corner.select), ...radios]) control.onchange = setArtwork;
for (const event of ['online', 'pageshow']) window.addEventListener(event, flush);
window.addEventListener('storage', event => {
  if (event.key?.startsWith(prefix)) {
    void flush();
    if (event.oldValue && !event.newValue && battle?.code) void load(battle.code, false);
  }
});
document.addEventListener('visibilitychange', () => {if (!document.hidden) void flush();});
const initialCode = new URLSearchParams(location.search).get('code') ?? '';
openCode(initialCode);
void load(initialCode);
void flush();
