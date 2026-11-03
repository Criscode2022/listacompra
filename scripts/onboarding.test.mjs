// Tests for scripts/onboarding.mjs. Run them with: npm run test:scripts
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { promisify } from 'node:util';
import { parseAppType, readPreferences, saveAppType } from './onboarding.mjs';

const execFileAsync = promisify(execFile);

describe('parseAppType', () => {
  it('accepts the number of an option', () => {
    assert.equal(parseAppType('1'), 'spa');
    assert.equal(parseAppType('4'), 'angular-native');
  });

  it('accepts a type name in any case, with spaces around it', () => {
    assert.equal(parseAppType(' Ionic-PWA '), 'ionic-pwa');
    assert.equal(parseAppType('ssr'), 'ssr');
  });

  it('rejects anything that is not an option', () => {
    for (const answer of ['', '0', '5', '1.5', 'react']) {
      assert.equal(parseAppType(answer), undefined, answer);
    }
  });
});

describe('preferences.json', () => {
  let folder;
  before(async () => {
    folder = await mkdtemp(join(tmpdir(), 'preferences-'));
  });
  after(() => rm(folder, { recursive: true, force: true }));

  it('reads a missing file as no preferences', async () => {
    assert.deepEqual(await readPreferences(join(folder, 'missing.json')), {});
  });

  it('saves the app type and keeps the other preferences', async () => {
    const file = join(folder, 'kept.json');
    await writeFile(file, '{ "theme": "dark", "appType": "" }');

    await saveAppType('ssr', file);

    assert.equal(await readFile(file, 'utf8'), '{\n  "theme": "dark",\n  "appType": "ssr"\n}\n');
  });

  it('refuses to overwrite a file that is not valid JSON', async () => {
    const file = join(folder, 'broken.json');
    await writeFile(file, '{ "appType": ');

    await assert.rejects(saveAppType('spa', file), /not valid JSON/);
    assert.equal(await readFile(file, 'utf8'), '{ "appType": ');
  });
});

describe('the onboarding command', () => {
  // The script runs in a copy of the project layout, so the real preferences.json never changes.
  let project;
  let preferencesFile;
  before(async () => {
    project = await mkdtemp(join(tmpdir(), 'onboarding-'));
    await mkdir(join(project, 'scripts'));
    await copyFile(
      new URL('./onboarding.mjs', import.meta.url),
      join(project, 'scripts', 'onboarding.mjs'),
    );
    preferencesFile = join(project, 'preferences.json');
  });
  after(() => rm(project, { recursive: true, force: true }));

  // Runs without a terminal, the way CI and coding agents run it.
  const runOnboarding = (...args) =>
    execFileAsync(process.execPath, [join(project, 'scripts', 'onboarding.mjs'), ...args]);

  it('saves a type given on the command line', async () => {
    await writeFile(preferencesFile, '{\n  "appType": ""\n}\n');

    const { stdout } = await runOnboarding('ionic-pwa');

    assert.deepEqual(JSON.parse(await readFile(preferencesFile, 'utf8')), { appType: 'ionic-pwa' });
    assert.match(stdout, /Saved "ionic-pwa"/);
  });

  it('stays quiet before a build once a type is saved', async () => {
    await writeFile(preferencesFile, '{\n  "appType": "ssr"\n}\n');

    const { stdout } = await runOnboarding('--if-unset');

    assert.equal(stdout, '');
  });

  it('explains how to choose when nobody can answer, and saves nothing', async () => {
    await writeFile(preferencesFile, '{\n  "appType": ""\n}\n');

    const { stdout } = await runOnboarding('--if-unset');

    assert.match(stdout, /npm run onboarding/);
    assert.equal(await readFile(preferencesFile, 'utf8'), '{\n  "appType": ""\n}\n');
  });

  it('rejects a type this template does not support', async () => {
    await assert.rejects(runOnboarding('react'), (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /isn't one of the app types/);
      assert.match(error.stderr, /angular-native/);
      return true;
    });
  });
});
