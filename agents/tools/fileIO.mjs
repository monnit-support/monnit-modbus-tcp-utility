// agents/tools/fileIO.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const ROOT = process.cwd();

/**
 * Validates that a resolved path is within the project root.
 * Prevents directory traversal attacks (e.g., ../../../etc/passwd).
 */
function isSafePath(resolvedPath) {
    return resolvedPath.startsWith(ROOT);
}

export async function read_file(args) {
    try {
        if (!args.path) throw new Error("Missing 'path' argument.");
        const targetPath = path.resolve(ROOT, args.path);
        
        if (!isSafePath(targetPath)) {
             throw new Error("Security Error: Attempted to access files outside the project root.");
        }

        const stats = await fs.stat(targetPath);
        if (stats.isDirectory()) {
             throw new Error("Path is a directory. Use list_files instead.");
        }

        const content = await fs.readFile(targetPath, 'utf8');
        // Truncate extremely large files to prevent context window overflow
        if (content.length > 200000) {
            return { 
                path: args.path, 
                content: content.substring(0, 200000) + "\n\n... [TRUNCATED FOR LENGTH] ...",
                warning: "File was too large and was truncated."
            };
        }
        return { path: args.path, content };
    } catch (e) {
        return { error: e.message };
    }
}

export async function list_files(args) {
    try {
        if (!args.path) throw new Error("Missing 'path' argument.");
        const targetPath = path.resolve(ROOT, args.path);
        
        if (!isSafePath(targetPath)) {
             throw new Error("Security Error: Attempted to access files outside the project root.");
        }

        const entries = await fs.readdir(targetPath, { withFileTypes: true });
        
        // Filter out common noise directories to save tokens
        const filteredEntries = entries.filter(ent => 
            !ent.name.startsWith('.') && 
            ent.name !== 'node_modules' && 
            ent.name !== 'dist' && 
            ent.name !== 'build'
        );

        const files = filteredEntries.map(ent => ({
            name: ent.name,
            type: ent.isDirectory() ? 'directory' : 'file'
        }));
        return { path: args.path, files };
    } catch (e) {
        return { error: e.message };
    }
}

export async function write_file(args) {
    try {
        if (!args.path) throw new Error("Missing 'path' argument.");
        if (!args.content) throw new Error("Missing 'content' argument.");
        
        const targetPath = path.resolve(ROOT, args.path);
        
        if (!isSafePath(targetPath)) {
             throw new Error("Security Error: Attempted to write files outside the project root.");
        }

        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, args.content, 'utf8');
        return { success: true, path: args.path, message: "File created/overwritten successfully." };
    } catch (e) {
        return { error: e.message };
    }
}

export async function delete_file(args) {
    try {
        if (!args.path) throw new Error("Missing 'path' argument.");
        const targetPath = path.resolve(ROOT, args.path);
        
        if (!isSafePath(targetPath)) {
             throw new Error("Security Error: Attempted to delete files outside the project root.");
        }

        await fs.unlink(targetPath);
        return { success: true, path: args.path, message: "File deleted." };
    } catch (e) {
        return { error: e.message };
    }
}

/**
 * Applies a Unified Diff (Git Patch) to the codebase.
 * This replaces the fragile string-replacement approach.
 */
export async function apply_patch(args) {
    try {
        if (!args.patch_content) throw new Error("Missing 'patch_content' argument.");
        
        const patchContent = args.patch_content;
        const tempPatchPath = path.resolve(ROOT, `.temp_${Date.now()}.patch`);

        // 1. Write the patch string to a temporary file
        await fs.writeFile(tempPatchPath, patchContent, 'utf8');

        try {
            // 2. Execute git apply
            // --allow-empty prevents failure if the patch is accidentally blank
            // --reject creates .rej files if it partially fails (we don't want this for autonomous agents, so we omit it to force a clean pass/fail)
            const { stdout, stderr } = await execAsync(`git apply "${tempPatchPath}"`, { cwd: ROOT });
            
            // 3. Clean up the temp file
            await fs.unlink(tempPatchPath);

            return { 
                success: true, 
                message: "Patch applied successfully via git apply.",
                stdout: stdout || "No standard output."
            };

        } catch (execError) {
             // Clean up temp file even if git apply fails
             try { await fs.unlink(tempPatchPath); } catch (cleanupErr) {}
             
             throw new Error(`Git apply failed. The patch was likely malformed or the context lines didn't match the current file state. Git Error: ${execError.stderr || execError.message}`);
        }

    } catch (e) {
        return { error: e.message };
    }
}