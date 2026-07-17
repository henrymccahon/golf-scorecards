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
  [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
  { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }
);

let serverOutput = '';
let serverExitCode = null;
let serverReportedReady = false;
function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function captureServerOutput(chunk) {
  const text = chunk.toString();
  serverOutput += text;
  if (stripAnsi(serverOutput).includes('http://127.0.0.1:5173/')) {
    serverReportedReady = true;
  }
}

server.stdout.on('data', (chunk) => {
  captureServerOutput(chunk);
});
server.stderr.on('data', (chunk) => {
  captureServerOutput(chunk);
});
server.on('exit', (code) => {
  serverExitCode = code ?? 1;
});

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (serverExitCode !== null) {
      throw new Error(`Vite dev server exited before E2E could start (code ${serverExitCode}).\n${serverOutput}`);
    }

    if (serverReportedReady) {
      try {
        const response = await fetch(url);
        if (response.ok) return;
      } catch {
        // Vite reported readiness, but the socket is not accepting yet.
      }
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
