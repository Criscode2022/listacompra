// Tests for scripts/update-from-template.mjs. Run them with: npm run test:scripts
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { planFile } from './update-from-template.mjs';

const SCRIPT = fileURLToPath(new URL('./update-from-template.mjs', import.meta.url));
const DEFAULT_TEMPLATE_URL = 'git@github.com:Criscode2022/angular-ai-template.git';

let workspace;
let gitEnv;

before(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'update-from-template-'));
  // Keep the developer's own git settings, such as commit signing, out of the tests.
  const emptyConfig = join(workspace, 'gitconfig');
  await writeFile(emptyConfig, '');
  gitEnv = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: emptyConfig,
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  };
});
after(() => rm(workspace, { recursive: true, force: true }));

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, env: gitEnv, encoding: 'utf8' });
}

function runUpdate(cwd) {
  return spawnSync(process.execPath, [SCRIPT], { cwd, env: gitEnv, encoding: 'utf8' });
}

async function writeFiles(root, files) {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
}

async function linkSkill(root, name) {
  await mkdir(join(root, '.claude/skills'), { recursive: true });
  await symlink(`../../.agents/skills/${name}`, join(root, '.claude/skills', name));
}

function commitAll(cwd, message) {
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', message);
}

const read = (root, path) => readFile(join(root, path), 'utf8');
const staged = (cwd) => git(cwd, 'diff', '--cached', '--name-only').split('\n').filter(Boolean);

let fixtureCount = 0;

/** A template repository, and an app made from it the way GitHub's "Use this template" does. */
async function createTemplateAndApp({ shareHistory = false } = {}) {
  fixtureCount += 1;
  const template = join(workspace, `template-${fixtureCount}`);
  const app = join(workspace, `app-${fixtureCount}`);

  await mkdir(template);
  git(template, 'init', '-q', '-b', 'main');
  await writeFiles(template, {
    'PROJECT.md': '# Project rules\n\nRule one.\nRule two.\nRule three.\n',
    '.mcp.json': '{\n  "mcpServers": {\n    "angular-cli": {}\n  }\n}\n',
    '.agents/skills/kept/SKILL.md': 'kept skill, first version\n',
    '.agents/skills/retired/SKILL.md': 'retired skill\n',
    'scripts/tool.mjs': "console.log('first version');\n",
    'README.md': '# Template\n',
    'APP.md': '# This app\n',
    'src/main.ts': 'template main, first version\n',
    'package.json': '{\n  "scripts": {\n    "start": "ng serve"\n  }\n}\n',
  });
  await linkSkill(template, 'kept');
  await linkSkill(template, 'retired');
  commitAll(template, 'Template, first version');

  if (shareHistory) {
    git(workspace, 'clone', '-q', '--origin', 'template', template, app);
  } else {
    await mkdir(app);
    await cp(template, app, {
      recursive: true,
      verbatimSymlinks: true,
      filter: (path) => !path.endsWith('.git'),
    });
    git(app, 'init', '-q', '-b', 'main');
    commitAll(app, 'Initial commit');
    git(app, 'remote', 'add', 'template', template);
  }
  return { template, app };
}

describe('update-from-template', () => {
  it("brings in the template's changes to files this app didn't change, and stages them", async () => {
    const { template, app } = await createTemplateAndApp();
    await writeFiles(template, {
      'PROJECT.md': '# Project rules\n\nRule one, updated.\nRule two.\nRule three.\n',
      'scripts/tool.mjs': "console.log('second version');\n",
    });
    commitAll(template, 'Template, second version');
    const appHead = git(app, 'rev-parse', 'HEAD');

    const result = runUpdate(app);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(await read(app, 'PROJECT.md'), await read(template, 'PROJECT.md'));
    assert.equal(await read(app, 'scripts/tool.mjs'), "console.log('second version');\n");
    assert.deepEqual(staged(app).sort(), ['.template-version', 'PROJECT.md', 'scripts/tool.mjs']);
    assert.match(
      await read(app, '.template-version'),
      new RegExp(git(template, 'rev-parse', 'HEAD').trim()),
    );
    assert.equal(git(app, 'rev-parse', 'HEAD'), appHead, 'nothing is committed');
  });

  it('adds new template files, including the links to new skills', async () => {
    const { template, app } = await createTemplateAndApp();
    await writeFiles(template, { '.agents/skills/fresh/SKILL.md': 'fresh skill\n' });
    await linkSkill(template, 'fresh');
    commitAll(template, 'Add a skill');

    const result = runUpdate(app);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(await read(app, '.agents/skills/fresh/SKILL.md'), 'fresh skill\n');
    assert.equal(await readlink(join(app, '.claude/skills/fresh')), '../../.agents/skills/fresh');
  });

  it('removes what the template removed, and keeps what this app added', async () => {
    const { template, app } = await createTemplateAndApp();
    git(template, 'rm', '-q', '-r', '.agents/skills/retired', '.claude/skills/retired');
    commitAll(template, 'Retire a skill');
    await writeFiles(app, {
      '.agents/skills/app-only/SKILL.md': "this app's own skill\n",
      'scripts/deploy.sh': 'echo deploy\n',
    });
    await linkSkill(app, 'app-only');
    commitAll(app, 'Add app-only files');

    const result = runUpdate(app);

    assert.equal(result.status, 0, result.stderr);
    await assert.rejects(read(app, '.agents/skills/retired/SKILL.md'), { code: 'ENOENT' });
    await assert.rejects(readlink(join(app, '.claude/skills/retired')), { code: 'ENOENT' });
    assert.equal(await read(app, '.agents/skills/app-only/SKILL.md'), "this app's own skill\n");
    assert.equal(await read(app, 'scripts/deploy.sh'), 'echo deploy\n');
  });

  it("leaves the app's own files alone, and lists npm scripts the template added", async () => {
    const { template, app } = await createTemplateAndApp();
    await writeFiles(template, {
      'README.md': '# Template, rewritten\n',
      'APP.md': '# This app, rewritten\n',
      'src/main.ts': 'template main, second version\n',
      'package.json':
        '{\n  "scripts": {\n    "start": "ng serve",\n    "update-from-template": "node scripts/update-from-template.mjs"\n  }\n}\n',
    });
    commitAll(template, 'Change files the apps own');

    const result = runUpdate(app);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(await read(app, 'README.md'), '# Template\n');
    assert.equal(await read(app, 'APP.md'), '# This app\n');
    assert.equal(await read(app, 'src/main.ts'), 'template main, first version\n');
    assert.doesNotMatch(await read(app, 'package.json'), /update-from-template/);
    assert.match(result.stdout, /"update-from-template": "node scripts\/update-from-template.mjs"/);
  });

  it("adds starter files that an older app doesn't have yet, like preferences.json", async () => {
    const { template, app } = await createTemplateAndApp();
    await writeFiles(template, { 'preferences.json': '{\n  "appType": ""\n}\n' });
    commitAll(template, 'Add preferences.json');

    const result = runUpdate(app);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(await read(app, 'preferences.json'), '{\n  "appType": ""\n}\n');
    assert.ok(staged(app).includes('preferences.json'));
  });

  it('merges a file that the app and the template changed in different places', async () => {
    const { template, app } = await createTemplateAndApp();
    await writeFiles(template, {
      'PROJECT.md': '# Project rules\n\nRule one.\nRule two.\nRule three, from the template.\n',
    });
    commitAll(template, 'Change rule three');
    await writeFiles(app, {
      'PROJECT.md': '# Project rules\n\nRule one, from the app.\nRule two.\nRule three.\n',
    });
    commitAll(app, 'Change rule one');

    const result = runUpdate(app);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await read(app, 'PROJECT.md'),
      '# Project rules\n\nRule one, from the app.\nRule two.\nRule three, from the template.\n',
    );
    assert.ok(staged(app).includes('PROJECT.md'));
  });

  it('marks a conflict when both changed the same lines, and leaves that file unstaged', async () => {
    const { template, app } = await createTemplateAndApp();
    await writeFiles(template, {
      'PROJECT.md': '# Project rules\n\nRule one.\nRule two, the template way.\nRule three.\n',
    });
    commitAll(template, 'Change rule two');
    await writeFiles(app, {
      'PROJECT.md': '# Project rules\n\nRule one.\nRule two, the app way.\nRule three.\n',
    });
    commitAll(app, 'Change rule two too');

    const result = runUpdate(app);

    assert.equal(result.status, 1);
    assert.match(result.stdout, /Conflicts to fix[\s\S]*PROJECT\.md/);
    assert.match(await read(app, 'PROJECT.md'), /<<<<<<< this app[\s\S]*>>>>>>> template now/);
    assert.ok(!staged(app).includes('PROJECT.md'));
  });

  it('keeps a file the template deleted when this app changed it', async () => {
    const { template, app } = await createTemplateAndApp();
    git(template, 'rm', '-q', '.agents/skills/retired/SKILL.md');
    commitAll(template, 'Retire a skill');
    await writeFiles(app, { '.agents/skills/retired/SKILL.md': 'retired skill, changed here\n' });
    commitAll(app, 'Change the skill');

    const result = runUpdate(app);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await read(app, '.agents/skills/retired/SKILL.md'),
      'retired skill, changed here\n',
    );
    assert.match(result.stdout, /Kept this app's version[\s\S]*retired\/SKILL\.md/);
  });

  it('uses the recorded version on later runs, and says when there is nothing new', async () => {
    const { template, app } = await createTemplateAndApp();
    await writeFiles(template, { 'scripts/tool.mjs': "console.log('second version');\n" });
    commitAll(template, 'Second version');
    assert.equal(runUpdate(app).status, 0);
    commitAll(app, 'Update from the template');

    const upToDate = runUpdate(app);
    assert.equal(upToDate.status, 0, upToDate.stderr);
    assert.match(upToDate.stdout, /up to date/);

    await writeFiles(template, { 'scripts/tool.mjs': "console.log('third version');\n" });
    commitAll(template, 'Third version');
    const later = runUpdate(app);
    assert.equal(later.status, 0, later.stderr);
    assert.deepEqual(staged(app).sort(), ['.template-version', 'scripts/tool.mjs']);
  });

  it('finds the starting point from shared history when the app was cloned from the template', async () => {
    const { template, app } = await createTemplateAndApp({ shareHistory: true });
    await writeFiles(template, { 'scripts/tool.mjs': "console.log('second version');\n" });
    commitAll(template, 'Second version');

    const result = runUpdate(app);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(await read(app, 'scripts/tool.mjs'), "console.log('second version');\n");
  });

  it('replaces but never deletes when it cannot tell which template version the app came from', async () => {
    const { template, app } = await createTemplateAndApp();
    await rm(join(app, '.git'), { recursive: true, force: true });
    await writeFiles(app, { 'src/extra.ts': 'makes the first commit differ from the template\n' });
    git(app, 'init', '-q', '-b', 'main');
    commitAll(app, 'Initial commit');
    git(app, 'remote', 'add', 'template', template);
    await writeFiles(template, { 'PROJECT.md': '# Project rules\n\nNew rules.\n' });
    git(template, 'rm', '-q', '.agents/skills/retired/SKILL.md');
    commitAll(template, 'Change and remove');

    const result = runUpdate(app);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(await read(app, 'PROJECT.md'), '# Project rules\n\nNew rules.\n');
    assert.equal(await read(app, '.agents/skills/retired/SKILL.md'), 'retired skill\n');
    assert.match(result.stdout, /doesn't record which template version/);
  });

  it('refuses to run with uncommitted changes', async () => {
    const { app } = await createTemplateAndApp();
    await writeFiles(app, { 'PROJECT.md': 'an edit in progress\n' });

    const result = runUpdate(app);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Commit or stash/);
    await assert.rejects(read(app, '.template-version'), { code: 'ENOENT' });
  });

  it('refuses to run in the template itself', async () => {
    const { template } = await createTemplateAndApp();
    git(template, 'remote', 'add', 'origin', DEFAULT_TEMPLATE_URL);

    const result = runUpdate(template);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /the template itself/);
  });
});

describe('planFile', () => {
  const file = (oid, mode = '100644') => ({ mode, oid });

  it("leaves files the template didn't change, even when this app changed them", () => {
    assert.equal(
      planFile({ base: file('a'), target: file('a'), app: file('b'), baseKnown: true }).action,
      'none',
    );
  });

  it("takes the template's version when this app didn't change the file", () => {
    assert.equal(
      planFile({ base: file('a'), target: file('b'), app: file('a'), baseKnown: true }).action,
      'take',
    );
  });

  it('merges text files both changed, but keeps links and new files both added', () => {
    assert.equal(
      planFile({ base: file('a'), target: file('b'), app: file('c'), baseKnown: true }).action,
      'merge',
    );
    const link = (oid) => file(oid, '120000');
    assert.equal(
      planFile({ base: link('a'), target: link('b'), app: link('c'), baseKnown: true }).action,
      'keep',
    );
    assert.equal(
      planFile({ base: undefined, target: file('b'), app: file('c'), baseKnown: true }).action,
      'keep',
    );
  });

  it("doesn't bring back a file this app deleted", () => {
    assert.equal(
      planFile({ base: file('a'), target: file('b'), app: undefined, baseKnown: true }).action,
      'keep',
    );
  });

  it('without a known starting point, replaces files but never removes them', () => {
    assert.equal(
      planFile({ base: undefined, target: file('b'), app: file('c'), baseKnown: false }).action,
      'take',
    );
    assert.equal(
      planFile({ base: undefined, target: undefined, app: file('c'), baseKnown: false }).action,
      'none',
    );
  });
});
