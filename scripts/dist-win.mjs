/**
 * Spawn electron-builder after clearing cert-related env vars so optional empty-string
 * WIN_CSC_LINK does not trigger importCertificate / signing / winCodeSign download.
 */
import { execSync, spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

/** Run electron-builder via Node so Windows does not need shell:true for .cmd shims. */
const ebCli = path.join(root, 'node_modules', 'electron-builder', 'cli.js');

/**
 * User-level GH_TOKEN / GITHUB_TOKEN (System Properties → Environment Variables) are not
 * visible to processes that were already running (e.g. Cursor) until restart. Pull from
 * Windows User/Machine store when publish runs and env is missing.
 */
function windowsStoredEnv(name, scope) {
    try {
        const ps = `[Environment]::GetEnvironmentVariable('${name}', '${scope}')`;
        const out = execSync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, {
            encoding: 'utf8',
            windowsHide: true,
        }).trim();
        return out || '';
    } catch {
        return '';
    }
}

function ensureGitHubTokenForPublish() {
    const has =
        (process.env.GH_TOKEN && process.env.GH_TOKEN.trim()) ||
        (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim());
    if (has || process.platform !== 'win32') {
        return;
    }
    const scopes = ['User', 'Machine'];
    const names = ['GH_TOKEN', 'GITHUB_TOKEN'];
    for (const scope of scopes) {
        for (const name of names) {
            const v = windowsStoredEnv(name, scope);
            if (v) {
                process.env.GH_TOKEN = v;
                return;
            }
        }
    }
}

for (const key of ['WIN_CSC_LINK', 'CSC_LINK', 'CSC_NAME', 'CSC_FOR_PULL_REQUEST']) {
    delete process.env[key];
}
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';

ensureGitHubTokenForPublish();

const args = process.argv.slice(2);
if (args.length === 0) {
    args.push('--win', '-p', 'never');
}

const r = spawnSync(process.execPath, [ebCli, ...args], {
    stdio: 'inherit',
    cwd: root,
    env: process.env,
});

if (r.error) {
    console.error(r.error);
    process.exit(1);
}

process.exit(r.status ?? 1);
