// Starts Maestro's MCP server (https://docs.maestro.dev) for this repository, so an agent can run
// and write the flows in .maestro/. The agents' MCP configs (.mcp.json, .cursor/mcp.json,
// .antigravity/mcp.json, .vscode/mcp.json) run it as: node scripts/maestro-mcp.mjs
//
// Maestro runs on Java. Homebrew's OpenJDK is keg-only, so it is not on the PATH and the CLI
// fails with "Unable to locate a Java Runtime" unless JAVA_HOME points at it. This sets JAVA_HOME
// when it is unset and a known JDK exists, finds the maestro binary, and serves from the
// repository root whatever directory the agent started in.
//
// Install the CLI with: brew install mobile-dev-inc/tap/maestro (or curl -fsSL
// "https://get.maestro.mobile.dev" | bash, which puts it in ~/.maestro/bin).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const JDK_CANDIDATES = [
  '/opt/homebrew/opt/openjdk',
  '/usr/local/opt/openjdk',
  '/usr/lib/jvm/default-java',
];

function findMaestro() {
  const dirs = [
    ...(process.env.PATH ?? '').split(delimiter).filter(Boolean),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    join(homedir(), '.maestro', 'bin'),
  ];
  for (const dir of dirs) {
    const candidate = join(dir, process.platform === 'win32' ? 'maestro.bat' : 'maestro');
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

const env = { ...process.env };
if (!env.JAVA_HOME) {
  const jdk = JDK_CANDIDATES.find((dir) => existsSync(join(dir, 'bin', 'java')));
  if (jdk) env.JAVA_HOME = jdk;
}

const maestro = findMaestro();
if (!maestro) {
  // stdout carries the MCP protocol, so messages go to stderr.
  console.error(
    'maestro-mcp: the Maestro CLI is not installed. Run: brew install mobile-dev-inc/tap/maestro',
  );
  process.exit(1);
}

const child = spawn(maestro, ['mcp', `--working-dir=${repoRoot}`], {
  cwd: repoRoot,
  env,
  stdio: 'inherit',
});
child.on('error', (error) => {
  console.error(`maestro-mcp: could not start ${maestro}: ${error.message}`);
  process.exit(1);
});
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
