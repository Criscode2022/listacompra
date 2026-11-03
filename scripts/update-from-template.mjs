// Brings the template's latest skills, rules, and settings into an app made from it, and leaves the
// app's own files alone. Run it in the app: npm run update-from-template
//
// It only stages the changes; it never commits. Review them with `git diff --staged`, keep them
// with `git commit`, or undo the whole update with `git reset --hard`.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// Change this if you copy the template into a repository of your own.
const TEMPLATE_URL = 'git@github.com:Criscode2022/angular-ai-template.git';
const TEMPLATE_REMOTE = 'template';
const TEMPLATE_BRANCH = 'main';
const VERSION_FILE = '.template-version';

// The files the template owns. Everything else belongs to the app: its code, package.json,
// angular.json, preferences.json, README.md, APP.md, and any skill or script the app adds.
export const TEMPLATE_PATHS = [
  '.agents/skills/',
  '.claude/skills/',
  'third_party/',
  'templates/',
  'scripts/',
  'AGENTS.md',
  'GEMINI.md',
  'CLAUDE.md',
  'PROJECT.md',
  'SKILLS.lock.md',
  'skills-lock.json',
  '.mcp.json',
  '.vscode/mcp.json',
  '.vscode/extensions.json',
  '.cursor/',
  '.antigravity/',
  '.prettierrc',
  '.prettierignore',
  '.gitignore',
  '.editorconfig',
];

// Files the app owns, but that the template starts it with. An app made before the template had
// one of them gets it once; after that, the update never changes it.
const STARTER_FILES = ['APP.md', 'preferences.json'];

const REGULAR_FILE_MODES = new Set(['100644', '100755']);

class UpdateError extends Error {}

function runGit(args) {
  return spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function git(args) {
  const result = runGit(args);
  if (result.status !== 0) {
    throw new UpdateError(`git ${args.join(' ')} failed:\n${result.stderr.trim()}`);
  }
  return result.stdout;
}

/** Runs git and returns its output, or undefined when git exits with an error. */
function gitOrUndefined(args) {
  const result = runGit(args);
  return result.status === 0 ? result.stdout.trim() : undefined;
}

const sameEntry = (a, b) => a?.mode === b?.mode && a?.oid === b?.oid;

/**
 * Decides what to do with one file the template owns, from three versions of it: `base`, the
 * template version this app last took; `target`, the template now; and `app`, this app's. Each
 * is `{ mode, oid }`, or undefined when the file doesn't exist there. Without a known base, the
 * template's version replaces the app's, and nothing is removed.
 */
export function planFile({ base, target, app, baseKnown }) {
  if (sameEntry(target, app)) return { action: 'none' };
  if (!baseKnown) return target ? { action: 'take' } : { action: 'none' };
  if (sameEntry(base, target)) return { action: 'none' };

  if (!target) {
    if (sameEntry(app, base)) return { action: 'remove' };
    return { action: 'keep', reason: 'the template deleted it, but this app changed it' };
  }
  if (!app) {
    if (!base) return { action: 'take' };
    return { action: 'keep', reason: 'this app deleted it, and the template changed it since' };
  }
  if (sameEntry(app, base)) return { action: 'take' };
  if (!base) return { action: 'keep', reason: 'this app and the template both added it' };
  const allRegular = [base, target, app].every((entry) => REGULAR_FILE_MODES.has(entry.mode));
  if (allRegular) return { action: 'merge' };
  return { action: 'keep', reason: "both changed it, and links can't be merged" };
}

/** Lists the template-owned files in a commit, or in the index when `commit` is omitted. */
function listEntries(commit) {
  const output = commit
    ? git(['ls-tree', '-r', '-z', commit, '--', ...TEMPLATE_PATHS])
    : git(['ls-files', '-s', '-z', '--', ...TEMPLATE_PATHS]);
  const entries = new Map();
  for (const record of output.split('\0').filter(Boolean)) {
    const tab = record.indexOf('\t');
    const fields = record.slice(0, tab).split(' ');
    // ls-tree prints "mode type oid", ls-files prints "mode oid stage".
    const oid = commit ? fields[2] : fields[1];
    entries.set(record.slice(tab + 1), { mode: fields[0], oid });
  }
  return entries;
}

/** Turns git@github.com:owner/repo.git and https://github.com/owner/repo into owner/repo. */
export function repositoryName(url) {
  const trimmed = url.trim();
  const match = trimmed.match(/github\.com[:/](.+?)(?:\.git)?\/?$/i);
  return (match ? match[1] : trimmed).toLowerCase();
}

function checkWorkingTree() {
  if (gitOrUndefined(['rev-parse', '--verify', '--quiet', 'HEAD']) === undefined) {
    throw new UpdateError('This repository has no commits yet. Commit the app first.');
  }
  if (git(['status', '--porcelain', '--untracked-files=no']).trim() !== '') {
    throw new UpdateError(
      'Commit or stash your changes first, so this update is easy to review and to undo.',
    );
  }
}

function connectTemplate() {
  const origin = gitOrUndefined(['remote', 'get-url', 'origin']);
  let templateUrl = gitOrUndefined(['remote', 'get-url', TEMPLATE_REMOTE]);
  if (origin && repositoryName(origin) === repositoryName(templateUrl ?? TEMPLATE_URL)) {
    throw new UpdateError(
      'This is the template itself. Run this command in an app made from the template.',
    );
  }
  if (!templateUrl) {
    templateUrl = TEMPLATE_URL;
    git(['remote', 'add', TEMPLATE_REMOTE, templateUrl]);
    console.log(`Added the template as the git remote "${TEMPLATE_REMOTE}": ${templateUrl}`);
  }
  if (runGit(['fetch', '--quiet', TEMPLATE_REMOTE, TEMPLATE_BRANCH]).status !== 0) {
    throw new UpdateError(
      `Couldn't download the template from ${templateUrl}. Check your connection and your access to it.`,
    );
  }
  return git(['rev-parse', `${TEMPLATE_REMOTE}/${TEMPLATE_BRANCH}`]).trim();
}

function readRecordedVersion() {
  if (!existsSync(VERSION_FILE)) return undefined;
  return readFileSync(VERSION_FILE, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line !== '' && !line.startsWith('#'));
}

/** Finds the template version this app last took, and says how it was found. */
function findStartingPoint(target) {
  const recorded = readRecordedVersion();
  if (recorded && gitOrUndefined(['cat-file', '-e', `${recorded}^{commit}`]) !== undefined) {
    return { base: recorded, howFound: 'the last update' };
  }
  const shared = gitOrUndefined(['merge-base', 'HEAD', target]);
  if (shared) {
    return { base: shared, howFound: 'the history this app shares with the template' };
  }
  // GitHub's "Use this template" starts the app with a commit holding exactly the template's files.
  const firstTrees = new Set(
    git(['rev-list', '--max-parents=0', 'HEAD'])
      .split('\n')
      .filter(Boolean)
      .map((commit) => git(['rev-parse', `${commit}^{tree}`]).trim()),
  );
  const created = git(['log', '--format=%H %T', target])
    .split('\n')
    .map((line) => line.split(' '))
    .find(([, tree]) => firstTrees.has(tree));
  if (created) {
    return { base: created[0], howFound: 'the template version this app was created from' };
  }
  return { base: undefined, howFound: undefined };
}

function writeRecordedVersion(target) {
  writeFileSync(
    VERSION_FILE,
    `# The template commit this app was last updated from. npm run update-from-template writes this file.\n${target}\n`,
  );
  git(['add', '--', VERSION_FILE]);
}

/** Merges the template's changes into this app's version of a file, without touching git's index. */
function mergeIntoWorkingFile(path, { base, target, app }) {
  const result = spawnSync(
    'git',
    ['merge-file', '--object-id', '-p'].concat(
      ['-L', 'this app', '-L', 'template before', '-L', 'template now'],
      [app.oid, base.oid, target.oid],
    ),
    { maxBuffer: 64 * 1024 * 1024 },
  );
  // git merge-file exits with the number of conflicts, or with a negative number on errors such
  // as binary files.
  if (result.status === null || result.status > 127) return { merged: false };
  // Write next to the file and rename it into place, so a running script is never truncated.
  const temporary = `${path}.update-from-template`;
  writeFileSync(temporary, result.stdout, { mode: app.mode === '100755' ? 0o755 : 0o644 });
  renameSync(temporary, path);
  return { merged: true, conflicts: result.status };
}

function applyPlan(path, plan, versions, target, report) {
  switch (plan.action) {
    case 'take':
      git(['checkout', target, '--', path]);
      (versions.app ? report.updated : report.added).push(path);
      break;
    case 'remove':
      git(['rm', '-q', '--', path]);
      report.removed.push(path);
      break;
    case 'merge': {
      const { merged, conflicts } = mergeIntoWorkingFile(path, versions);
      if (!merged) {
        report.kept.push(`${path}: both changed it, and git can't merge this kind of file`);
      } else if (conflicts > 0) {
        report.conflicts.push(path);
      } else {
        git(['add', '--', path]);
        report.merged.push(path);
      }
      break;
    }
    case 'keep':
      report.kept.push(`${path}: ${plan.reason}`);
      break;
    default:
      break;
  }
}

function addMissingStarterFiles(target, report) {
  for (const path of STARTER_FILES) {
    if (existsSync(path) || gitOrUndefined(['cat-file', '-e', `${target}:${path}`]) === undefined) {
      continue;
    }
    git(['checkout', target, '--', path]);
    report.added.push(path);
  }
}

/** Lists npm scripts the template has that this app's package.json lacks or defines differently. */
function differingNpmScripts(target) {
  const templatePackage = gitOrUndefined(['show', `${target}:package.json`]);
  if (!templatePackage || !existsSync('package.json')) return [];
  const templateScripts = JSON.parse(templatePackage).scripts ?? {};
  const appScripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts ?? {};
  return Object.entries(templateScripts).filter(([name, command]) => appScripts[name] !== command);
}

function printList(title, items) {
  if (items.length === 0) return;
  console.log(`\n${title} (${items.length}):`);
  for (const item of items) console.log(`  ${item}`);
}

function printReport(report, npmScripts) {
  printList('Updated', report.updated);
  printList('Added', report.added);
  printList('Removed', report.removed);
  printList("Merged with this app's changes", report.merged);
  printList("Kept this app's version", report.kept);
  printList('Conflicts to fix: edit the marked lines, then git add each file', report.conflicts);

  if (npmScripts.length > 0) {
    console.log(
      "\nThe template's package.json has npm scripts that this app's doesn't. Copy the ones you want:",
    );
    for (const [name, command] of npmScripts)
      console.log(`  "${name}": ${JSON.stringify(command)}`);
  }
  if (
    [...report.updated, ...report.added, ...report.removed].some((path) =>
      path.startsWith('.agents/'),
    )
  ) {
    console.log('\nSkills changed. Restart your coding agent so it loads them.');
  }
  console.log(`
Next:
  git diff --staged                          review the changes
  git commit -m "Update from the template"   keep them
  git reset --hard                           undo this update`);
}

function main() {
  process.chdir(git(['rev-parse', '--show-toplevel']).trim());
  checkWorkingTree();
  const target = connectTemplate();
  const { base, howFound } = findStartingPoint(target);
  if (base === target) {
    console.log(`Already up to date with the template (${target.slice(0, 7)}).`);
    return 0;
  }

  if (base) {
    console.log(
      `Updating from the template: ${base.slice(0, 7)} to ${target.slice(0, 7)}, found from ${howFound}.`,
    );
  } else {
    console.log(
      "This app doesn't record which template version it came from, so files that differ from the template were replaced with the template's version, and nothing was removed. Review the changes before you commit them.",
    );
  }

  const baseEntries = base ? listEntries(base) : new Map();
  const targetEntries = listEntries(target);
  const appEntries = listEntries();
  const report = { updated: [], added: [], removed: [], merged: [], kept: [], conflicts: [] };
  const paths = [...new Set([...baseEntries.keys(), ...targetEntries.keys()])].sort();
  for (const path of paths) {
    const versions = {
      base: baseEntries.get(path),
      target: targetEntries.get(path),
      app: appEntries.get(path),
    };
    applyPlan(path, planFile({ ...versions, baseKnown: Boolean(base) }), versions, target, report);
  }
  addMissingStarterFiles(target, report);
  writeRecordedVersion(target);
  printReport(report, differingNpmScripts(target));
  return report.conflicts.length > 0 ? 1 : 0;
}

const entryPoint = process.argv[1];
const isEntryPoint =
  entryPoint !== undefined && realpathSync(entryPoint) === fileURLToPath(import.meta.url);
if (isEntryPoint) {
  try {
    process.exitCode = main();
  } catch (error) {
    if (!(error instanceof UpdateError)) throw error;
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
