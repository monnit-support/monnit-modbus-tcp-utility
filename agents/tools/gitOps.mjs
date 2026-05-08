import { spawn } from 'node:child_process';
const sh = (cmd, args) => new Promise((resolve) => {
  const c = spawn(cmd, args, { cwd: process.cwd(), env: process.env });
  let out = '', err = '';
  c.stdout.on('data', d => (out += d));
  c.stderr.on('data', d => (err += d));
  c.on('close', code => resolve({ code: code ?? 0, out, err }));
});

export async function git_ops({ branch, message }) {
  const checkout = await sh('git', ['checkout', '-b', branch]);
  const add      = await sh('git', ['add', '.']);
  const commit   = await sh('git', ['commit', '-m', message, '--no-verify']);
  return { checkout, add, commit };
}
