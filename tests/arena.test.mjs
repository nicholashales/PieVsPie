import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { startWorker, password } from './local-worker.mjs';

let runtime;
let profileRoot;
const browserOptions = {
  headless: true,
  args: ['--disable-dev-shm-usage', '--no-proxy-server']
};

before(async () => {
  runtime = await startWorker();
  await runtime.db.prepare(
    "INSERT INTO registered_fights(fight_code,red_fighter,white_fighter) VALUES ('BROWSER-01','Alan Star','Billie Pieper'),('BROWSER-02','Alan Star','Billie Pieper'),('BROWSER-03','Alan Star','Billie Pieper')"
  ).run();
  profileRoot = await mkdtemp(join(tmpdir(), 'pvp-browser-'));
  const systemBrowser = '/usr/bin/chromium';
  const hasSystemBrowser = await access(systemBrowser).then(() => true, () => false);
  browserOptions.executablePath = process.env.PVP_CHROMIUM || (hasSystemBrowser ? systemBrowser : undefined);
  browserOptions.env = {...process.env, XDG_CONFIG_HOME: profileRoot, XDG_CACHE_HOME: profileRoot};
});
after(async () => {
  await runtime?.worker.dispose();
  if (profileRoot) await rm(profileRoot, {recursive: true, force: true});
});

const arena = code => runtime.base + '/arena/?code=' + code;
const state = async code => (await fetch(runtime.base + '/api/battle?code=' + code)).json();

async function ready(page, code) {
  await page.goto(arena(code) + '&red=28&white=12', {waitUntil: 'domcontentloaded'});
  await page.getByText('Fight ' + code, {exact: true}).waitFor();
  assert.deepEqual(await page.locator('#redFighter').evaluate(el => [el.value, el.disabled]), ['Alan Star', true]);
  assert.deepEqual(await page.locator('#whiteFighter').evaluate(el => [el.value, el.disabled]), ['Billie Pieper', true]);
  assert.equal(await page.getByRole('link', {name: 'Rules of Engagement'}).getAttribute('href'), '/rules');
}

async function fill(page, winner, notes) {
  await page.getByRole('radio', {name: winner}).check();
  await page.getByLabel('TASTING NOTES').fill(notes);
}

const confirmed = page => page.getByText(/Vote confirmed\. Receipt:/).waitFor({timeout: 15000});

test('arena restores the QR pairing, edits votes and removes them, and an admin can restore', {timeout: 30000}, async () => {
  const context = await chromium.launchPersistentContext(join(profileRoot, 'edit'), {
    ...browserOptions, viewport: {width: 390, height: 844}, httpCredentials: {username: 'admin', password}
  });
  try {
    const page = context.pages()[0];
    page.setDefaultTimeout(8000);
    await ready(page, 'BROWSER-01');
    await fill(page, 'Alan Star', 'Flaky pastry');
    let lost = false;
    await page.route('**/api/battle', async route => {
      if (!lost && route.request().method() === 'POST') {
        lost = true;
        const persisted = await route.fetch({maxRetries: 0});
        assert.equal(persisted.status(), 200);
        await route.abort('failed');
      } else await route.continue();
    });
    await page.getByRole('button', {name: /ADD JUDGE VOTE/}).evaluate(button => {button.click(); button.click();});
    await page.getByText(/Pending votes are saved/).waitFor();
    await confirmed(page);
    await page.locator('#votes').getByText('Alan Star — Flaky pastry').waitFor();
    const added = (await state('BROWSER-01')).votes;
    assert.equal(added.length, 1);
    await page.reload({waitUntil: 'domcontentloaded'});
    await page.getByRole('button', {name: 'Edit vote'}).click();
    assert.equal(await page.getByLabel('TASTING NOTES').inputValue(), 'Flaky pastry');
    await fill(page, 'Billie Pieper', 'Better filling, <strong>literal notes</strong>');
    await page.getByRole('button', {name: 'SAVE CORRECTION'}).click();
    await page.locator('#votes').getByText(/Billie Pieper — Better filling/).waitFor();
    assert.equal(await page.locator('#votes strong').count(), 0);
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', {name: 'Remove vote'}).click();
    assert.equal((await state('BROWSER-01')).votes.length, 1);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', {name: 'Remove vote'}).click();
    await page.getByText('No judge votes yet.').waitFor();
    assert.equal((await state('BROWSER-01')).votes.length, 0);
    await page.goto(runtime.base + '/admin/audit');
    await page.getByRole('row').filter({hasText: 'Better filling, <strong>literal notes</strong>'})
      .getByRole('button', {name: 'Restore this revision'}).click();
    await page.getByText('Vote restored.', {exact: true}).waitFor();
    const restored = (await state('BROWSER-01')).votes[0];
    assert.equal(restored.winner, 'Billie Pieper');
    assert.equal(restored.revision, 4);
  } finally {
    await context.close();
  }
});

test('offline queue survives multiple tabs and a full browser restart', {timeout: 30000}, async () => {
  const profile = join(profileRoot, 'restart');
  let context = await chromium.launchPersistentContext(profile, browserOptions);
  try {
    const left = context.pages()[0];
    const right = await context.newPage();
    await Promise.all([ready(left, 'BROWSER-02'), ready(right, 'BROWSER-02')]);
    await context.setOffline(true);
    await fill(left, 'Alan Star', 'First tab, offline');
    await fill(right, 'Billie Pieper', 'Second tab, offline');
    await Promise.all([left, right].map(page => page.getByRole('button', {name: /ADD JUDGE VOTE/}).click()));
    await left.locator('#outbox li').nth(1).waitFor();
    assert.equal((await state('BROWSER-02')).votes.length, 0);
    await context.close();
    context = await chromium.launchPersistentContext(profile, browserOptions);
    const page = context.pages()[0];
    await ready(page, 'BROWSER-02');
    await page.locator('#votes li').nth(1).waitFor();
    assert.deepEqual((await state('BROWSER-02')).votes.map(vote => vote.notes).sort(),
      ['First tab, offline', 'Second tab, offline']);
    assert.equal(await page.locator('#outbox li').count(), 0);
  } finally {
    await context.close();
  }
});

test('stale correction stays local and can be reviewed and explicitly reapplied', {timeout: 30000}, async () => {
  const context = await chromium.launchPersistentContext(join(profileRoot, 'conflict'), browserOptions);
  try {
    const left = context.pages()[0];
    await ready(left, 'BROWSER-03');
    await fill(left, 'Alan Star', 'Original');
    await left.getByRole('button', {name: /ADD JUDGE VOTE/}).click();
    await left.getByRole('button', {name: 'Edit vote'}).waitFor();
    const right = await context.newPage();
    await ready(right, 'BROWSER-03');
    await right.getByRole('button', {name: 'Edit vote'}).click();
    await fill(right, 'Billie Pieper', 'Other taster correction');
    await left.getByRole('button', {name: 'Edit vote'}).click();
    await fill(left, 'Alan Star', 'First correction');
    await left.getByRole('button', {name: 'SAVE CORRECTION'}).click();
    await left.locator('#votes').getByText('Alan Star — First correction').waitFor();
    await right.getByRole('button', {name: 'SAVE CORRECTION'}).click();
    await right.locator('#outbox').getByText(/Needs review/).waitFor();
    assert.equal((await state('BROWSER-03')).votes[0].notes, 'First correction');
    await right.getByRole('button', {name: 'Review current votes'}).click();
    await right.getByRole('button', {name: 'SAVE CORRECTION'}).waitFor();
    assert.equal(await right.getByLabel('TASTING NOTES').inputValue(), 'Other taster correction');
    await right.getByRole('button', {name: 'SAVE CORRECTION'}).click();
    await right.locator('#votes').getByText('Billie Pieper — Other taster correction').waitFor();
    assert.equal((await state('BROWSER-03')).votes[0].revision, 3);
    assert.equal(await right.locator('#outbox li').count(), 0);
  } finally {
    await context.close();
  }
});
