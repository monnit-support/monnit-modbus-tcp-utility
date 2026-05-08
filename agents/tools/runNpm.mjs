import { spawn } from 'node:child_process';
const ALLOWED = new Set(['test', 'lint', 'build']); // extend cautiously

export async function run_npm({ script, args = [] }) {
  if (!ALLOWED.has(script)) throw new Error(`Disallowed script: ${script}`);
  return new Promise((resolve) => {
    const cmd = process.platform.startsWith('win') ? 'npm.cmd' : 'npm';
    const child = spawn(cmd, ['run', script, ...args], { cwd: process.cwd(), env: process.env });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => (stdout += d));
    child.stderr.on('data', d => (stderr += d));
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}