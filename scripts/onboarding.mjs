// Onboarding: asks which type of app this project becomes and saves the answer in
// preferences.json. Coding agents read that file before they build anything (PROJECT.md, "App type").
//
//   npm run onboarding                ask, even when a type is already saved
//   npm run onboarding -- ionic-pwa   save a type without asking
//   npm start, npm run build          ask once, while preferences.json has no type
import { realpathSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

export const APP_TYPES = [
  {
    id: 'spa',
    label: 'Classic Angular SPA: the app runs in the browser',
    nextStep: 'Nothing to set up: the template is already a single-page app.',
  },
  {
    id: 'ssr',
    label: 'Modern SSR: pages render on a server, then hydrate in the browser',
    nextStep: 'Your agent adds it with ng add @angular/ssr, following the angular-ssr skill.',
  },
  {
    id: 'ionic-pwa',
    label: 'PWA with Ionic: a mobile-style app that installs and works offline',
    nextStep:
      'Your agent adds it with ng add @ionic/angular and ng add @angular/pwa, following the ionic-pwa skill.',
  },
  {
    id: 'angular-native',
    label: 'Angular Native: a native iOS and Android app that you open in Expo Go',
    nextStep:
      'Your agent adds it with ng add @ng-native/schematics, following the angular-native skill. Install Expo Go on your phone: https://expo.dev/go',
  },
];

const PREFERENCES_FILE = fileURLToPath(new URL('../preferences.json', import.meta.url));

/** Returns the app type an answer names, by its number in the list or by its id. */
export function parseAppType(answer) {
  const text = answer.trim().toLowerCase();
  if (/^[1-9]$/.test(text)) {
    return APP_TYPES[Number(text) - 1]?.id;
  }
  return APP_TYPES.find((type) => type.id === text)?.id;
}

export async function readPreferences(file = PREFERENCES_FILE) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
  try {
    const preferences = JSON.parse(text);
    if (preferences && typeof preferences === 'object' && !Array.isArray(preferences)) {
      return preferences;
    }
  } catch {
    // Reported below, with the same message as a file that holds something other than an object.
  }
  throw new Error(`${file} is not valid JSON. Fix it, or replace it with: { "appType": "" }`);
}

export async function saveAppType(appType, file = PREFERENCES_FILE) {
  const preferences = await readPreferences(file);
  await writeFile(file, `${JSON.stringify({ ...preferences, appType }, null, 2)}\n`);
}

function isSupported(appType) {
  return APP_TYPES.some((type) => type.id === appType);
}

function describeAppTypes() {
  return APP_TYPES.map((type) => `  ${type.id.padEnd(16)}${type.label}`).join('\n');
}

async function saveAndShowNextStep(appType) {
  await saveAppType(appType);
  const { nextStep } = APP_TYPES.find((type) => type.id === appType);
  process.stdout.write(`Saved "${appType}" in preferences.json.\n${nextStep}\n`);
}

async function askForAppType(currentAppType) {
  process.stdout.write(
    '\nWhich type of app is this project? Your coding agent builds it this way.\n\n',
  );
  if (currentAppType) process.stdout.write(`Saved now: ${currentAppType}\n\n`);
  APP_TYPES.forEach((type, index) => process.stdout.write(`  ${index + 1}. ${type.label}\n`));
  process.stdout.write('\n');

  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  // Ctrl+C stops the command that ran the onboarding, such as npm start.
  prompt.on('SIGINT', () => {
    process.stdout.write('\n');
    process.exit(130);
  });
  try {
    for (;;) {
      const answer = await prompt.question('Type a number, or press Enter to decide later: ');
      if (answer.trim() === '') return undefined;
      const appType = parseAppType(answer);
      if (appType) return appType;
      process.stdout.write(`"${answer.trim()}" isn't one of the options.\n`);
    }
  } catch (error) {
    // Ctrl+D closes the input: decide later, like an empty answer.
    if (error.code === 'ABORT_ERR') return undefined;
    throw error;
  } finally {
    prompt.close();
  }
}

async function main(args) {
  const onlyIfUnset = args.includes('--if-unset');
  const named = args.find((arg) => !arg.startsWith('--'));

  if (named !== undefined) {
    const appType = parseAppType(named);
    if (!appType) {
      process.stderr.write(
        `"${named}" isn't one of the app types this template supports:\n${describeAppTypes()}\n`,
      );
      return 1;
    }
    await saveAndShowNextStep(appType);
    return 0;
  }

  const preferences = await readPreferences();
  if (onlyIfUnset && isSupported(preferences.appType)) return 0;

  // CI, coding agents, and other runs without a terminal can't answer a question.
  if (!process.stdin.isTTY || process.env.CI) {
    if (onlyIfUnset) {
      process.stdout.write(
        'preferences.json has no app type yet. Choose one with npm run onboarding, or tell your coding agent which type of app you want.\n',
      );
      return 0;
    }
    process.stderr.write(
      `Choose an app type: npm run onboarding -- <type>\n${describeAppTypes()}\n`,
    );
    return 1;
  }

  const currentAppType = isSupported(preferences.appType) ? preferences.appType : undefined;
  const appType = await askForAppType(currentAppType);
  if (appType) {
    await saveAndShowNextStep(appType);
  } else if (currentAppType) {
    process.stdout.write(`Kept "${currentAppType}".\n`);
  } else {
    process.stdout.write('Nothing saved. Your coding agent will ask before it builds the app.\n');
  }
  return 0;
}

const entryPoint = process.argv[1];
const isEntryPoint =
  entryPoint !== undefined && realpathSync(entryPoint) === fileURLToPath(import.meta.url);
if (isEntryPoint) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
