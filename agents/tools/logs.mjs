import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';

// Helper to find the actual project root (where package.json lives)
function findProjectRoot(startDir) {
  let current = startDir;
  while (true) {
    if (existsSync(path.join(current, 'package.json'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      // Reached system root, fallback to CWD
      return startDir; 
    }
    current = parent;
  }
}

const ROOT = findProjectRoot(process.cwd());

export async function search_logs({ pattern, path: rel = 'logs' }) {
  const dir = path.resolve(ROOT, rel);
  const rx = new RegExp(pattern, 'i');
  const out = {};
  
  // Robust check: ensure dir exists
  try {
    await fs.access(dir);
  } catch {
    return { error: `Directory '${rel}' does not exist.` };
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    // FIX: Skip directories to prevent "EISDIR: illegal operation on a directory, read"
    if (!entry.isFile()) continue;

    const file = path.join(dir, entry.name);
    try {
        const text = await fs.readFile(file, 'utf8');
        const lines = text.split('\n').filter(l => rx.test(l)).slice(0, 50);
        if (lines.length) out[entry.name] = lines;
    } catch (e) {
        // Ignore binary files or read errors
    }
  }
  return out;
}