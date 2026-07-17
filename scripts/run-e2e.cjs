const { spawn } = require('node:child_process');
const path = require('node:path');

const root = process.cwd();
const env = {
  ...process.env,
  PLAYWRIGHT_BROWSERS_PATH: path.join(root, '.ms-playwright'),
  PLAYWRIGHT_SKIP_WEB_SERVER: '1'
};

const server = spawn(
  process.execPath,
  [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '5173'],
  { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
);

let serverOutput = '';
server.stdout.on('data', (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverOutput += chunk.toString();
});

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}\n${serverOutput}`);
}

function stopServer() {
  if (!server.killed) {
    server.kill();
  }
}

async function main() {
  try {
    await waitForServer('http://127.0.0.1:5173', 30_000);
    const result = await new Promise((resolve) => {
      const test = spawn(
        process.execPath,
        [path.join(root, 'node_modules', '@playwright', 'test', 'cli.js'), 'test'],
        { cwd: root, env, stdio: 'inherit', windowsHide: true }
      );
      test.on('exit', (code) => resolve(code ?? 1));
    });
    process.exitCode = result;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    stopServer();
  }
}

main();
