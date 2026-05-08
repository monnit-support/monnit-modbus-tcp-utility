// scripts/fix-bug.mjs
import { fixBug } from '../agents/orchestrator.mjs';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load environment variables (GEMINI_API_KEY)
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Terminal Spinner Utility
 */
class TerminalSpinner {
    constructor() {
        this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        this.interval = null;
        this.currentFrame = 0;
    }

    start(message = "Agent investigating") {
        this.stop(); // Ensure no double-spinners
        process.stdout.write('\x1B[?25l'); // Hide cursor
        this.interval = setInterval(() => {
            const frame = this.frames[this.currentFrame % this.frames.length];
            process.stdout.write(`\r\x1b[36m${frame} ${message}...\x1b[0m`);
            this.currentFrame++;
        }, 80);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            process.stdout.write('\r\x1b[K'); // Clear line
            process.stdout.write('\x1B[?25h'); // Show cursor
        }
    }
}

const spinner = new TerminalSpinner();

/**
 * Robust helper to locate the SQLite database path.
 * Checks standard system paths AND local project directories for dev mode.
 */
const getDbPath = () => {
    const home = os.homedir();
    const appName = 'monnit-modbus-tcp-utility';
    const dbName = 'sensor_data.db';
    
    const paths = [];

    // 1. Check local data directory (if running in dev mode via npm start)
    if (process.platform === 'darwin') {
        paths.push(path.join(home, 'Library', 'Application Support', 'Electron', dbName));
    }

    // 2. Check the App-specific Application Support folder
    if (process.platform === 'darwin') {
        paths.push(path.join(home, 'Library', 'Application Support', appName, dbName));
    } else if (process.platform === 'win32') {
        paths.push(path.join(process.env.APPDATA, appName, dbName));
    } else {
        paths.push(path.join(home, '.config', appName, dbName));
    }

    // 3. Check for a local "data" folder in the project root
    const root = path.resolve(__dirname, '..');
    paths.push(path.join(root, dbName));
    paths.push(path.join(root, 'data', dbName));

    // Return the first path that actually exists
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    
    // Default to the standard system path if none found
    return paths[1]; 
};

async function main() {
    const bugReport = process.argv.slice(2).join(' ');

    if (!bugReport) {
        console.error('\x1b[31mError: Please provide a bug report or query.\x1b[0m');
        console.log('Usage: npm run fix:bug -- "The scan progress modal is not showing up"');
        process.exit(1);
    }

    console.log(`\x1b[36m[Terminal Agent] Starting investigation...\x1b[0m`);

    let history = [];
    let db = null;
    const dbPath = getDbPath();

    console.log(`\x1b[90m[Terminal Agent] Checking database at: ${dbPath}\x1b[0m`);

    // Try to load existing conversation history from the database
    try {
        if (fs.existsSync(dbPath)) {
            // FIX: Open as readonly so we can read history while the main app is running
            db = new Database(dbPath, { readonly: true });
            
            // Check if settings table exists
            const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'").get();
            
            if (tableCheck) {
                const row = db.prepare("SELECT value FROM settings WHERE key = 'agentHistory'").get();
                if (row && row.value) {
                    history = JSON.parse(row.value);
                    console.log(`\x1b[32m[Terminal Agent] Context Loaded: ${history.length} turns retrieved.\x1b[0m`);
                } else {
                    console.log(`\x1b[33m[Terminal Agent] No previous history found in database.\x1b[0m`);
                }
            } else {
                console.log(`\x1b[33m[Terminal Agent] Settings table not found. App might not have saved history yet.\x1b[0m`);
            }
            db.close();
            db = null;
        } else {
            console.warn(`\x1b[33m[Terminal Agent] Database file not found on disk. Starting fresh.\x1b[0m`);
        }
    } catch (err) {
        console.warn(`\x1b[33m[Terminal Agent] Warning: Could not read history (${err.message}). Starting fresh.\x1b[0m`);
    }

    try {
        // Start the spinner before calling the AI
        spinner.start("Agent is thinking and applying fixes");

        const result = await fixBug(bugReport, history);

        // Stop the spinner once we have the results
        spinner.stop();

        // Persist the updated history back to the database (Write Mode)
        try {
            // Re-open in write mode to save
            db = new Database(dbPath);
            db.exec("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('agentHistory', ?)")
              .run(JSON.stringify(result.history));
            console.log(`\x1b[32m[Terminal Agent] History saved to database.\x1b[0m`);
        } catch (saveErr) {
            // If the app is running, this might fail, which is okay for the bug fix itself
            console.warn(`\x1b[33m[Terminal Agent] Note: Could not save history to DB while app is running (${saveErr.message}).\x1b[0m`);
        }

        console.log('\n\x1b[1m=== Agent Final Response ===\x1b[0m\n');
        console.log(result.summary);
        console.log('\n\x1b[1m============================\x1b[0m\n');

    } catch (error) {
        spinner.stop();
        console.error(`\x1b[31m[Agent Error] ${error.message}\x1b[0m`);
        process.exit(1);
    } finally {
        if (db) {
            try { db.close(); } catch(e) {}
        }
    }
}

main();