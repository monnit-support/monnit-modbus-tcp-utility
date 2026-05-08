// main.js - COMPLETE VERSION with Monnit Attribute Transformation, Auto-Reconnection Lifecycle, and TCP Connection Pool
// Updates:
// 1. Integrated 'auto-downloader.js' and preserved all Plugin Manager hooks.
// 2. FIX: Replicated Monnit-specific dynamic parameter renaming for SNMP, Modbus, Server, LAN, and SNTP.
// 3. FIX: Bidirectional time conversion (Seconds <-> Minutes) for Modbus Timeout, Heartbeat, and SNTP.
// 4. FIX: Replaced "Reboot Timeout" errors with a silent 30s auto-reconnection loop.
// 5. FIX: Corrected broadcast() logging bug that caused "Cannot read properties of undefined (reading 'substring')".
// 6. FIX: Restored 'emit' method to socketWrapper to fix Plugin Manager connectivity and logs.
// 7. RESTORED: 'add-gateways' IPC handler to allow adding multiple gateways from a scan result.
// 8. **NEW: Added alert evaluation logic to polling cycle**
// 9. **NEW: Added TCP Connection Pool to prevent port exhaustion**
// 10. **FIX: Added Sensor History Deduplication (only log on new data/age reset)**
// 11. **FIX: Increased history fetch limit to 5000 records**
// 12. **FIX: Stabilized Polling Loop to prevent overlap and ensure Gateway data is always sent**
// 13. **NEW: Added Persistent Agent History to survive application restarts**
// 14. Preserved all original functionality, database schemas, and IPC handlers (1855+ lines).

import { app, BrowserWindow, ipcMain, Tray, Menu, shell, nativeImage, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import jsmodbus from 'jsmodbus';
import { Socket } from 'net';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { exec } from 'child_process';
import Database from 'better-sqlite3';
import nodemailer from 'nodemailer';
import { createRequire } from 'module';
import os from 'os';
import { promisify } from 'util';
import dns from 'dns';
import AVAHI_BROWSE from 'avahi-browse';
import selfsigned from 'selfsigned';
import electronUpdater from 'electron-updater';

const { autoUpdater } = electronUpdater;

// --- Import Connection Pool ---
import ModbusConnectionPool from './connection-pool.js';

// --- Import Plugin Manager ---
import { pluginManager } from './plugins/plugin_manager.js';
// --- Import Auto Downloader ---
// import { autoDownloader } from './public/js/auto-downloader.js';

const execPromise = promisify(exec);
const dnsReverse = dummyAsync(dns.reverse); // Using dummy for dns.reverse as it may not be available in all envs

function dummyAsync(fn) {
    if (typeof fn === 'function') return promisify(fn);
    return async () => [];
}

// --- Setup ---
dotenv.config();
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sensor parser for alert datum evaluation (.cjs so require works with "type": "module")
const { parseSensorData } = require('./public/sensor-parser.cjs');

// --- Electron Main Window & Tray ---
let mainWindow = null;
let tray = null;
let isQuitting = false;
let downloader = null; // Auto-downloader instance

// --- Cooldown & Connection Lifecycle Tracker ---
const gatewayCooldowns = new Map(); // Stores IP -> Timestamp of last successful save

// --- Sensor History Cache for Deduplication ---
const sensorHistoryCache = new Map(); // sensorId -> { dataAge, dataStr, lastLoggedTimestamp }

// --- Connection Pool for Persistent Modbus TCP Connections ---
let connectionPool = null;

// --- Single Instance Lock ---
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  // --- Configure Auto Updater ---
  autoUpdater.logger = console;
  // FIX: Disable auto-download on Mac to prevent code-sign validation errors
  autoUpdater.autoDownload = process.platform !== 'darwin';
  autoUpdater.verifyCodeSignature = false;
  autoUpdater.forceDevUpdateConfig = false;

  // --- Update State ---
  let updateReadyToInstall = false;
  let macUpdateUrl = 'https://github.com/monnit-support/monnit-modbus-tcp-utility/releases/latest';

// --- Sensor Type to Name Mapping ---
const deviceTypeToName = {
    1: "Analog Voltage", 2: "Temperature", 3: "Dry Contact", 4: "Water Detect", 5: "PIR Motion",
    6: "Magnetic Presence", 9: "Open/Closed", 11: "Button", 12: "Control Unit", 13: "Local Alert",
    15: "Accelerometer", 16: "Humidity", 19: "Activity", 20: "Accelerometer", 21: "Light Meter",
    22: "0-20mA Current", 23: "PIR Motion", 24: "Flex", 26: "Liquid Level 8\"", 27: "Light Presence",
    28: "Compass", 30: "Humidity GPP", 32: "500V Meter", 33: "Vehicle Presence", 34: "CO Gas",
    35: "High Temperature", 36: "Liquid Level 24\"", 39: "Vehicle Detector", 40: "Vehicle Speed",
    42: "Activity Timer", 43: "AC Current Meter", 44: "Serial Data Bridge", 45: "Smart Ranger",
    46: "Low Temperature", 47: "Multi Pulse Counter", 48: "Pulse Counter", 51: "Seat",
    52: "Air Flow", 55: "Power CT1MA", 59: "Battery Health", 64: "AC Voltage Detection",
    65: "Water Temperature", 66: "Asset", 67: "Ultrasonic Ranger", 69: "Dual Input Pulse Counter",
    70: "Resistance", 71: "DC Voltage Detection", 72: "0-5V Measure", 73: "Filtered Pulse Counter",
    74: "0-10V Measure", 75: "Tilt", 76: "Basic Control", 77: "Grid Eye", 78: "Water Area Sensor",
    79: "Pressure 50 PSI", 82: "Pressure 300 PSI", 83: "Pressure Custom", 84: "Duct Temperature",
    85: "Short Range Asset", 86: "Thermocouple", 89: "M1 Current Transducer", 90: "Filtered Pulse Counter 64 bit",
    91: "Motion Temp", 92: "Quad Temperature", 93: "Current Meter 20 Amp", 94: "Current Meter 150 Amp",
    95: "Vibration Meter", 97: "Thermostat", 99: "Resistance Delta", 100: "QTIP Temperature",
    101: "PIR - Alta", 102: "Air Quality", 103: "Differential Pressure", 104: "Vibration800",
    105: "UltrasonicRangerIndustrial", 106: "CO2 Meter", 107: "LightSensor", 108: "ThreePhasePowerMeter",
    109: "ThreePhaseCurrentMeter", 110: "DwellTime", 111: "Advanced Vibration", 113: "Voltage Meter - 200 VDC",
    114: "AirSpeed", 116: "CO Meter", 117: "AssetLocationRepeater", 118: "AssetLocationTag",
    119: "Vehicle Counter-Detection", 120: "Current Meter 500 Amp", 121: "Quartzdyne Pressure",
    122: "Voltage Meter - 500 VAC", 123: "Voltage Detection - 200 VDC", 124: "Propane Tank Monitor",
    126: "G-force - Max & Avg", 127: "Quad Contact", 128: "Handheld Food Probe",
    129: "ThreePhaseCurrentMeter500", 130: "Tilt Detection", 131: "Filtered Quad Temperature",
    132: "Filtered Temperature", 134: "Soot Blower", 135: "Soil Moisture", 136: "Digital Temperature",
    137: "Three Phase 20 Amp Meter", 138: "Motion Plus", 139: "Light Sensor PPFD", 140: "Soot Blower 2",
    142: "Advanced Vibration 2", 143: "Site Survey", 144: "Pressure 750 PSI", 145: "Pressure 3000 PSI",
    150: "Motion Temp Water", 151: "Five Input Dry Contact", 153: "Dual Input Pulse Counter",
    154: "Resistive Bridge"
};

  // --- Database setup ---
  const dbPath = path.join(app.getPath('userData'), 'sensor_data.db');
  console.log(`[DB] Connecting to database at: ${dbPath}`);

  const db = new Database(dbPath);

  // --- Database Schema ---
  const schema = `
  CREATE TABLE IF NOT EXISTS sensor_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensorId INTEGER NOT NULL,
      gatewayId INTEGER NOT NULL,
      deviceType INTEGER NOT NULL,
      voltage REAL NOT NULL,
      rssi INTEGER NOT NULL,
      isAware INTEGER NOT NULL,
      rawData TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      alertTriggered INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS gateway_data (
      gatewayId PRIMARY KEY,
      ip TEXT NOT NULL,
      firmwareVersion TEXT,
      lastSeen INTEGER,
      macAddress TEXT,
      isActive INTEGER DEFAULT 0,
      isUnlocked INTEGER DEFAULT 0,
      isReadOnly INTEGER DEFAULT 0,
      isModbusActive INTEGER DEFAULT 0,
      defaultServerStatus TEXT
  );
  CREATE TABLE IF NOT EXISTS alert_configs (
      sensorId INTEGER PRIMARY KEY,
      isEnabled INTEGER NOT NULL DEFAULT 0,
      condition TEXT NOT NULL DEFAULT 'above',
      threshold REAL NOT NULL DEFAULT 0,
      lastAlertTimestamp INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sensor_metadata (
      sensorId INTEGER PRIMARY KEY,
      customName TEXT,
      colorGroup TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
  );

/* --- EXTERNAL DEVICE TABLES (For Plugins) --- */
CREATE TABLE IF NOT EXISTS external_devices (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT,
    lastData TEXT,
    lastSeen INTEGER,
    isAware INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS external_device_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    data TEXT NOT NULL,
    alertTriggered INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS external_device_metadata (
    id TEXT PRIMARY KEY,
    customName TEXT,
    colorGroup TEXT
);

CREATE INDEX IF NOT EXISTS idx_external_device_history_deviceId ON external_device_history(deviceId);
  `;
  db.exec(schema);
  console.log('[DB] Database tables ensured.');

  // --- Migrations ---
  try {
      const sensorTableInfo = db.prepare("PRAGMA table_info(sensor_data)").all();
      if (!sensorTableInfo.some(col => col.name === 'alertTriggered')) db.exec('ALTER TABLE sensor_data ADD COLUMN alertTriggered INTEGER DEFAULT 0');

      const alertConfigTableInfo = db.prepare("PRAGMA table_info(alert_configs)").all();
      if (!alertConfigTableInfo.some(col => col.name === 'dataIndex')) db.exec('ALTER TABLE alert_configs ADD COLUMN dataIndex INTEGER DEFAULT 0');

      const gatewayTableInfo = db.prepare("PRAGMA table_info(gateway_data)").all();
      if (!gatewayTableInfo.some(col => col.name === 'macAddress')) db.exec('ALTER TABLE gateway_data ADD COLUMN macAddress TEXT');
      if (!gatewayTableInfo.some(col => col.name === 'isActive')) db.exec('ALTER TABLE gateway_data ADD COLUMN isActive INTEGER DEFAULT 0');
      if (!gatewayTableInfo.some(col => col.name === 'isUnlocked')) db.exec('ALTER TABLE gateway_data ADD COLUMN isUnlocked INTEGER DEFAULT 0');
      if (!gatewayTableInfo.some(col => col.name === 'isReadOnly')) db.exec('ALTER TABLE gateway_data ADD COLUMN isReadOnly INTEGER DEFAULT 0');
      if (!gatewayTableInfo.some(col => col.name === 'isModbusActive')) db.exec('ALTER TABLE gateway_data ADD COLUMN isModbusActive INTEGER DEFAULT 0');
      if (!gatewayTableInfo.some(col => col.name === 'defaultServerStatus')) db.exec('ALTER TABLE gateway_data ADD COLUMN defaultServerStatus TEXT');

      const migrationKey = 'meta_fk_removed_v1';
      const migrationCheck = db.prepare('SELECT value FROM settings WHERE key = ?').get(migrationKey);

      if (!migrationCheck) {
          console.log('[DB] Running migration to remove Foreign Key from external_device_metadata...');
          db.transaction(() => {
              db.exec(`
                  CREATE TABLE external_device_metadata (
                      id TEXT PRIMARY KEY,
                      customName TEXT,
                      colorGroup TEXT
                  )
              `);
              db.exec('INSERT INTO external_device_metadata (id, customName, colorGroup) SELECT id, customName, colorGroup FROM external_device_metadata_old');
              db.exec('DROP TABLE external_device_metadata_old');
              db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(migrationKey, 'true');
          })();
          console.log('[DB] Migration complete.');
      }

    // --- Migration: Remove CASCADE DELETE from external_device_history ---
    const migrationKey2 = 'fk_removed_from_external_device_history_v1';
    const migrationCheck2 = db.prepare('SELECT value FROM settings WHERE key = ?').get(migrationKey2);

    if (!migrationCheck2) {
        console.log('[DB] Running migration to remove Foreign Key from external_device_history...');

        // Check if we need to migrate (table might already exist)
        const tableInfo = db.prepare("PRAGMA table_info(external_device_history)").all();
        const hasFk = db.prepare("PRAGMA foreign_key_list(external_device_history)").all();

        if (hasFk.length > 0) {
            db.transaction(() => {
                // Create new table without foreign key
                db.exec(`
                    CREATE TABLE external_device_history_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        deviceId TEXT NOT NULL,
                        timestamp INTEGER NOT NULL,
                        data TEXT NOT NULL,
                        alertTriggered INTEGER DEFAULT 0
                    )
                `);

                // Copy all existing data
                db.exec(`
                    INSERT INTO external_device_history_new (id, deviceId, timestamp, data, alertTriggered)
                    SELECT id, deviceId, timestamp, data, alertTriggered FROM external_device_history
                `);

                // Drop old table
                db.exec('DROP TABLE external_device_history');

                // Rename new table
                db.exec('ALTER TABLE external_device_history_new RENAME TO external_device_history');

                // Create index for performance
                db.exec('CREATE INDEX idx_external_device_history_deviceId ON external_device_history(deviceId)');

                console.log('[DB] Data migrated successfully.');
            })();
        } else {
            // No foreign key exists, just create the index
            db.exec('CREATE INDEX IF NOT EXISTS idx_external_device_history_deviceId ON external_device_history(deviceId)');
            console.log('[DB] Index created, no migration needed.');
        }

        // Mark migration as done
        db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(migrationKey2, 'true');
        console.log('[DB] Migration complete.');
    }

  } catch (error) {
      if (!error.message.includes('no such table')) {
          console.error(`[DB MIGRATION] ${error.message}`);
      }
  }

  // --- Statements (Prepared for Speed) ---
  const insertSensorStmt = db.prepare('INSERT INTO sensor_data (sensorId, gatewayId, deviceType, voltage, rssi, isAware, rawData, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const pruneSensorStmt = db.prepare('DELETE FROM sensor_data WHERE id IN (SELECT id FROM sensor_data WHERE sensorId = ? ORDER BY timestamp ASC LIMIT (SELECT MAX(0, COUNT(*) - ?) FROM sensor_data WHERE sensorId = ?))');
  const insertGatewayStmt = db.prepare('INSERT OR REPLACE INTO gateway_data (gatewayId, ip, firmwareVersion, lastSeen, macAddress, isActive, isUnlocked, isReadOnly, isModbusActive, defaultServerStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const getAlertConfigsStmt = db.prepare('SELECT * FROM alert_configs');
  const getAlertConfigBySensorIdStmt = db.prepare('SELECT * FROM alert_configs WHERE sensorId = ?');
  const saveAlertConfigStmt = db.prepare('INSERT OR REPLACE INTO alert_configs (sensorId, isEnabled, condition, threshold, lastAlertTimestamp, dataIndex) VALUES (?, ?, ?, ?, ?, ?)');
  const getLatestSensorReadingStmt = db.prepare('SELECT * FROM sensor_data WHERE sensorId = ? ORDER BY timestamp DESC LIMIT 1');
  const updateLastAlertTimestampStmt = db.prepare('UPDATE alert_configs SET lastAlertTimestamp = ? WHERE sensorId = ?');
  const updateSensorDataAlertTriggeredStmt = db.prepare('UPDATE sensor_data SET alertTriggered = 1 WHERE id = ?');

  const getSetting = (key, defaultValue = null) => {
      try {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        return row ? row.value : defaultValue;
      } catch (err) {
        console.error(`[DB] Error fetching setting ${key}:`, err);
        return defaultValue;
      }
  };
  const saveSettingStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const saveSetting = (key, value) => {
      saveSettingStmt.run(key, value);
  };

  const deleteGatewayStmt = db.prepare('DELETE FROM gateway_data WHERE gatewayId = ?');
  const deleteSensorDataByGatewayStmt = db.prepare('DELETE FROM sensor_data WHERE gatewayId = ?');
  const deleteAllGatewaysStmt = db.prepare('DELETE FROM gateway_data');
  const deleteAllSensorDataStmt = db.prepare('DELETE FROM sensor_data');
  const deleteAllAlertsStmt = db.prepare('DELETE FROM alert_configs');
  const getActiveGatewayStmt = db.prepare('SELECT * FROM gateway_data WHERE isActive = 1');
  const deactivateAllGatewaysStmt = db.prepare('UPDATE gateway_data SET isActive = 0');
  const activateGatewayStmt = db.prepare('UPDATE gateway_data SET isActive = 1 WHERE gatewayId = ?');
  const getSensorMetadataStmt = db.prepare('SELECT customName, colorGroup FROM sensor_metadata WHERE sensorId = ?');
  const saveSensorMetadataStmt = db.prepare('INSERT OR REPLACE INTO sensor_metadata (sensorId, customName, colorGroup) VALUES (?, ?, ?)');
  const resetColorGroupsStmt = db.prepare('UPDATE sensor_metadata SET colorGroup = NULL');
  const resetSensorNamesStmt = db.prepare('UPDATE sensor_metadata SET customName = NULL');
  const deleteAllSensorMetadataStmt = db.prepare('DELETE FROM sensor_metadata');
  const saveExternalMetadataStmt = db.prepare('INSERT OR REPLACE INTO external_device_metadata (id, customName, colorGroup) VALUES (?, ?, ?)');
  const getAllSensorMetadataStmt = db.prepare('SELECT * FROM sensor_metadata');
  const getAllExternalMetadataStmt = db.prepare('SELECT * FROM external_device_metadata');

  const dbTransaction = db.transaction((sensors, gatewayId) => {
      const maxRecords = parseInt(getSetting('maxRecords', '5000'), 10);
      const pollTimeSec = Math.floor(Date.now() / 1000);
      for (const sensor of sensors) {
          // Data Age = seconds since sensor reported; actual timestamp = poll time - data age
          const dataAgeSec = sensor.dataAge != null ? sensor.dataAge : 0;
          const actualTimestamp = Math.max(0, pollTimeSec - dataAgeSec);
          insertSensorStmt.run(sensor.sensorId, gatewayId, sensor.deviceType, sensor.voltage, sensor.rssi, sensor.isAware ? 1 : 0, JSON.stringify(sensor.data), actualTimestamp);
          pruneSensorStmt.run(sensor.sensorId, maxRecords, sensor.sensorId);
      }
  });

  // --- Helper to save gateway ---
  const saveGatewayToDb = (details) => {
      try {
          const existing = db.prepare('SELECT isActive FROM gateway_data WHERE gatewayId = ?').get(details.gatewayId);
          const isActive = existing ? existing.isActive : 0;

          insertGatewayStmt.run(
              details.gatewayId,
              details.ip,
              details.firmwareVersion,
              Math.floor(Date.now() / 1000),
              details.macAddress,
              isActive,
              details.isUnlocked ? 1 : 0,
              details.isReadOnly ? 1 : 0,
              details.isModbusActive ? 1 : 0,
              details.defaultServerStatus
          );
          return true;
      } catch (err) {
          log('ERROR', `Failed to save gateway ${details.gatewayId}: ${err.message}`);
          return false;
      }
  };

  // --- Connection Pool Initialization ---
  const initConnectionPool = () => {
      connectionPool = new ModbusConnectionPool({
          maxReconnectAttempts: 5,
          baseReconnectDelay: 1000,
          maxReconnectDelay: 30000,
          idleTimeout: 300000, // 5 minutes
          connectionTimeout: 5000,
          heartbeatInterval: 30000
      });

      // Connection pool event handlers
      connectionPool.on('connection_established', ({ ip }) => {
          log('INFO', `[ConnectionPool] Established persistent connection to ${ip}`);
      });

      connectionPool.on('connection_error', ({ ip, error }) => {
          log('WARN', `[ConnectionPool] Connection error for ${ip}: ${error}`);
      });

      connectionPool.on('connection_closed', ({ ip, hadError }) => {
          log('INFO', `[ConnectionPool] Connection closed for ${ip}${hadError ? ' (with error)' : ''}`);
      });

      connectionPool.on('reconnecting', ({ ip, attempt }) => {
          log('INFO', `[ConnectionPool] Reconnecting to ${ip} (attempt ${attempt})`);
      });

      connectionPool.on('connection_idle_timeout', ({ ip }) => {
          log('INFO', `[ConnectionPool] Connection idle timeout for ${ip}`);
      });

      connectionPool.on('max_reconnect_attempts_reached', ({ ip }) => {
          log('ERROR', `[ConnectionPool] Max reconnect attempts reached for ${ip}`);
      });
  };

  // --- Helper: Native PDF Generation ---
  // Uses a hidden window to render HTML content and print to PDF via Electron's engine.
const generatePDF = async (html, outputPath) => {
    log('INFO', `[AutoDownload] Converting HTML to native PDF: ${outputPath}`);
    const tempHtmlPath = path.join(app.getPath('temp'), `temp_export_${Date.now()}.html`);

    try {
        // Write HTML to a temporary file
        fs.writeFileSync(tempHtmlPath, html, 'utf-8');

        // Create offscreen window
        const tempWin = new BrowserWindow({
            show: false,
            webPreferences: {
                offscreen: true,
                contextIsolation: true
            }
        });

        // Load from file:// protocol instead of data URL (fixes ERR_INVALID_URL)
        await tempWin.loadURL(`file://${tempHtmlPath}`);

        // Wait for content to be ready
        await new Promise(resolve => setTimeout(resolve, 500));

        const data = await tempWin.webContents.printToPDF({
            printBackground: true,
            marginsType: 0,
            pageSize: 'A4'
        });

        fs.writeFileSync(outputPath, data);
        tempWin.destroy();

        // Clean up temp file
        try {
            fs.unlinkSync(tempHtmlPath);
        } catch(e) {
            log('WARN', `[AutoDownload] Could not clean up temp file: ${e.message}`);
        }

        return true;
    } catch (err) {
        log('ERROR', `[AutoDownload] Native PDF conversion failed: ${err.message}`);
        // Clean up temp file on error too
        try {
            fs.unlinkSync(tempHtmlPath);
        } catch(e) {}
        return false;
    }
};

  // --- Auto Downloader Init ---
  const initAutoDownloader = () => {
      try {
          // Pass the native PDF generation helper to the downloader module
          //          downloader = autoDownloader(db, log, generatePDF);
          //          downloader.init();
      } catch(e) {
          log('ERROR', `Failed to init auto-downloader: ${e.message}`);
      }
  };

  // --- Database Backup Manager ---
  class DatabaseBackupManager {
      constructor(dbPath, logFunc) {
          this.dbPath = dbPath;
          this.log = logFunc;
          this.backupDir = path.join(app.getPath('userData'), 'backups');
          this.intervalId = null;
          this.init();
      }

      init() {
          // Ensure backup directory exists
          if (!fs.existsSync(this.backupDir)) {
              fs.mkdirSync(this.backupDir, { recursive: true });
              this.log('INFO', `[Backup] Created backup directory: ${this.backupDir}`);
          }
          this.scheduleNextRun();
      }

      scheduleNextRun() {
          if (this.intervalId) clearTimeout(this.intervalId);

          const enabled = getSetting('backupEnabled', 'true') === 'true';
          const frequency = getSetting('backupFrequency', 'daily');

          if (!enabled) {
              this.log('INFO', '[Backup] Automatic backups are disabled.');
              return;
          }

          const now = new Date();
          let nextRun = new Date();

          switch (frequency) {
              case 'hourly':
                  nextRun.setHours(now.getHours() + 1, 0, 0, 0);
                  break;
              case 'daily':
                  nextRun.setDate(now.getDate() + 1);
                  nextRun.setHours(2, 0, 0, 0); // 2 AM daily default
                  break;
              case 'weekly':
                  nextRun.setDate(now.getDate() + 7);
                  nextRun.setHours(2, 0, 0, 0);
                  break;
              case 'monthly':
                  nextRun.setMonth(now.getMonth() + 1, 1);
                  nextRun.setHours(2, 0, 0, 0);
                  break;
          }

          const delay = nextRun.getTime() - now.getTime();
          this.log('INFO', `[Backup] Next backup scheduled for: ${nextRun.toLocaleString()}`);

          this.intervalId = setTimeout(() => {
              this.executeBackup();
              this.scheduleNextRun();
          }, delay);
      }

      executeBackup() {
          try {
              this.log('INFO', 'Starting automatic database backup...');

              const timestamp = new Date().toISOString().replace(/[:.]/g, '-') .slice(0, -1);
              const backupFilename = `sensor_data_${timestamp}.db`;
              const backupPath = path.join(this.backupDir, backupFilename);

              // Copy the database file
              fs.copyFileSync(this.dbPath, backupPath);

              // Update last run timestamp
              saveSetting('backupLastRun', Date.now().toString());

              this.log('INFO', `[Backup] Database backed up to: ${backupPath}`);

              // Prune old backups
              this.pruneOldBackups();

              broadcast('backup-status', {
                  success: true,
                  message: `Backup created: ${backupFilename}`,
                  color: 'var(--success-accent)',
                  lastRun: Date.now()
              });

          } catch (err) {
              this.log('ERROR', `[Backup] Failed to create backup: ${err.message}`);
              broadcast('backup-status', {
                  success: false,
                  message: `Backup failed: ${err.message}`,
                  color: 'var(--danger-accent)'
              });
          }
      }

      pruneOldBackups() {
          try {
              const maxBackups = parseInt(getSetting('maxBackups', '1'), 10);
              const files = fs.readdirSync(this.backupDir)
                  .filter(f => f.startsWith('sensor_data_') && f.endsWith('.db'))
                  .map(f => ({
                      name: f,
                      path: path.join(this.backupDir, f),
                      stat: fs.statSync(path.join(this.backupDir, f))
                  }))
                  .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

              // Keep only the most recent maxBackups
              const toDelete = files.slice(maxBackups);
              toDelete.forEach(file => {
                  fs.unlinkSync(file.path);
                  this.log('INFO', `[Backup] Pruned old backup: ${file.name}`);
              });

          } catch (err) {
              this.log('WARN', `[Backup] Error pruning old backups: ${err.message}`);
          }
      }

      backupNow() {
          // Immediately execute a backup
          clearTimeout(this.intervalId);
          this.executeBackup();
          this.scheduleNextRun();
      }

      reload() {
          this.scheduleNextRun();
      }
  }

  // Initialize backup manager
  let backupManager = null;
  const initBackupManager = () => {
      backupManager = new DatabaseBackupManager(dbPath, log);
  };

  // --- Update Check Logic ---
  const checkForUpdates = () => {
      if (updateReadyToInstall) {
          broadcast('update-downloaded', {});
          const isMac = process.platform === 'darwin';
          broadcast('update-ready', { version: 'Latest', isManual: isMac });
          return;
      }

      const statusChannel = 'update-status';
      broadcast(statusChannel, { message: 'Checking GitHub for updates...', color: 'var(--text-color)' });
      log('INFO', 'Checking for application updates via electron-updater...');

      if (!app.isPackaged) {
          setTimeout(() => {
              const msg = `Dev Mode: App is up to date (v${app.getVersion()}).`;
              broadcast(statusChannel, { message: '✓ ' + msg, color: 'var(--info-accent)' });
              log('INFO', `Update Check (Dev): ${msg}`);
          }, 1500);
          return;
      }

      autoUpdater.checkForUpdates().catch(err => {
          let userMsg = `Update check failed: ${err.message}`;
          broadcast(statusChannel, { message: '⚠ ' + userMsg, color: 'var(--danger-accent)' });
          log('ERROR', userMsg);
      });
  };

  autoUpdater.on('update-available', (info) => {
      if (process.platform === 'darwin') {
          macUpdateUrl = `https://github.com/monnit-support/monnit-modbus-tcp-utility/releases/tag/v${info.version}`;
          const msg = `New version v${info.version} available. Click "Download" to install manually.`;
          broadcast('update-status', { message: '⚠ ' + msg, color: 'var(--warning-accent)' });
          broadcast('update-ready', { version: info.version, isManual: true });
          updateReadyToInstall = true;
          log('INFO', `Mac Update Available: ${msg}`);
      } else {
          const msg = `Update available: v${info.version}. Downloading...`;
          broadcast('update-status', { message: msg, color: 'var(--info-accent)' });
          log('INFO', msg);
      }
  });

  autoUpdater.on('update-not-available', (info) => {
      const msg = 'You are on the latest version.';
      broadcast('update-status', { message: '✓ ' + msg, color: 'var(--success-accent)' });
      log('INFO', msg);
      saveSetting('lastUpdateCheck', Date.now().toString());
  });

  autoUpdater.on('error', (err) => {
      if (process.platform === 'darwin' && err.message.includes('Code signature')) {
           log('WARN', 'MacOS Code Signature Validation Failed. Switching to manual update mode.');
           updateReadyToInstall = true;
           const msg = 'New version available. Click "Download" to install manually.';
           broadcast('update-status', { message: '⚠ ' + msg, color: 'var(--warning-accent)' });
           broadcast('update-ready', { version: 'Manual Download', isManual: true });
           return;
      } else if (process.platform === 'darwin') {
           updateReadyToInstall = true;
           const msg = 'New version available. Click "Download" to install manually.';
           broadcast('update-status', { message: '⚠ ' + msg, color: 'var(--warning-accent)' });
           broadcast('update-ready', { version: 'Manual Download', isManual: true });
           return;
      }

      const msg = `Update Error: ${err.message}`;
      broadcast('update-status', { message: '⚠ Error checking updates.', color: 'var(--danger-accent)' });
      log('ERROR', msg);
  });

  autoUpdater.on('update-downloaded', (info) => {
      updateReadyToInstall = true;
      const msg = 'Update downloaded. Click "Restart & Install" to apply.';
      broadcast('update-status', { message: '✓ ' + msg, color: 'var(--success-accent)' });
      broadcast('update-ready', { version: info.version, isManual: false });
      log('INFO', msg);
  });

  // --- State ---
  let isPolling = false;
  let pollingTimeoutId = null;
  /** Gateway ID currently being polled (aligned with DB active gateway while polling). */
  let pollingTargetGatewayId = null;
  const POLLING_INTERVAL = parseInt(process.env.POLLING_INTERVAL, 10) || 5000;
  const POLL_BATCH_SIZE = 7;
  let fullDeviceList = [];
  let isScanning = false;
  let cancelScanRequest = false;
  let lastSensorDataPayload = null;

  // --- Helper Functions ---
  const broadcast = (channel, data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
          // Diagnostic logging for outgoing IPC messages
          // FIX: Added 'external-devices-data' to exclusion list to prevent console spam
          if (channel !== 'log-message' && channel !== 'modbus-data' && channel !== 'external-devices-data') {
             // FIX: Safe check for data to prevent "substring of undefined" crash
             const stringData = (data !== undefined) ? JSON.stringify(data) : "{}";
             // If stringify returns undefined (rare), fallback to empty object string
          }

          mainWindow.webContents.send(channel, data);
      }
  };

  const log = (level, message) => {
      const timestamp = new Date().toLocaleTimeString();
      if (level !== 'DEBUG' || process.env.DEBUG) {
          console.log(`[${timestamp}][${level}] ${message}`);
      }
      const truncatedMessage = message && message.length > 150 ? message.substring(0, 150) + '...' : (message || "");
      broadcast('log-message', { timestamp, level, message, truncatedMessage });
  };

  const parse32BitValue = (high, low) => (high << 16) | low;

  const calculateBatteryPercentage = (deviceType, voltage) => {
      const ranges = {
          coin: { min: 2.2, max: 2.5 },
          aa: { min: 2.2, max: 2.8 },
          industrial: { min: 2.2, max: 2.8 }
      };
      let range = ranges.aa;
      if (voltage <= range.min) return 0;
      if (voltage >= range.max) return 100;
      const span = range.max - range.min;
      if (span <= 0) return 50; // fallback if range misconfigured
      return Math.round(((voltage - range.min) / span) * 100);
  };

  function toSigned16(value) {
      return (value > 32767) ? value - 65536 : value;
  }

  const getNumericReading = (sensor) => {
      let data;
      if (typeof sensor.rawData === 'string') {
          try { data = JSON.parse(sensor.rawData); } catch (e) { return null; }
      } else if (Array.isArray(sensor.data)) {
          data = sensor.data;
      } else {
          return null;
      }
      if (!data || data.length === 0) return null;

      switch (sensor.deviceType) {
          case 2: case 71: case 35: case 46: case 65: case 84: case 86: case 132: return toSigned16(data[0]) / 10;
          case 16: case 43: return toSigned16(data[1]) / 100;
          case 25: return toSigned16(data[0]) / 10;
          case 41: return (data[0] | (data[1] << 16)) / 1000;
          case 79: case 82: case 83: case 144: case 145: return (data[0] || 0) / 10;
          case 107: return ((data[1] || 0) << 16 | (data[0] || 0)) / 100;
          case 124: return toSigned16(data[0]) / 100;
          default: return null;
      }
  };

  /**
   * Evaluates sensor data against alert configurations and triggers notifications
   * @param {Array} sensors - Array of sensor data objects from current poll
   * @param {number} gatewayId - The gateway ID being polled
   */
  const evaluateAndTriggerAlerts = async (sensors, gatewayId) => {
      // Skip if alerting is disabled globally
      if (getSetting('alertingEnabled', 'false') !== 'true') {
          return;
      }

      const alertConfigs = getAlertConfigsStmt.all();
      const repeatIntervalMinutes = parseInt(getSetting('repeatAlertInterval', '60'), 10);
      const customMessage = getSetting('alertCustomMessage', '');

      for (const sensor of sensors) {
          const config = alertConfigs.find(c => c.sensorId === sensor.sensorId);

          if (!config || config.isEnabled !== 1) {
              continue; // No alert configured or disabled
          }

          // Get value for threshold comparison (use selected datum from parser when available)
          let currentValue = null;
          try {
              const parsed = parseSensorData(sensor);
              const chartableIndex = config.dataIndex ?? 0;
              const datum = parsed.chartableData[chartableIndex];
              if (datum != null && typeof datum.value === 'number') {
                  currentValue = datum.value;
              }
          } catch (_) { /* parser error, fall through */ }
          if (currentValue === null) {
              currentValue = getNumericReading(sensor); // fallback for sensors not in parser
          }
          if (currentValue === null) {
              continue; // Can't evaluate sensors without comparable value
          }

          // Parse threshold (may be string or number)
          const threshold = typeof config.threshold === 'string' ? parseFloat(config.threshold) : config.threshold;
          const thresholdNum = !isNaN(threshold) ? threshold : 0;

          // Check threshold condition
          let conditionMet = false;
          if (config.condition === 'above' && currentValue > thresholdNum) {
              conditionMet = true;
          } else if (config.condition === 'below' && currentValue < thresholdNum) {
              conditionMet = true;
          } else if (config.condition === 'equal' && currentValue === thresholdNum) {
              conditionMet = true;
          } else if (config.condition === 'not_equal' && currentValue !== thresholdNum) {
              conditionMet = true;
          }

          if (!conditionMet) {
              continue; // Condition not met, skip
          }

          // Check repeat interval
          const now = Math.floor(Date.now() / 1000);
          const lastAlert = config.lastAlertTimestamp || 0;
          const secondsSinceLastAlert = now - lastAlert;
          const repeatIntervalSeconds = repeatIntervalMinutes * 60;

          if (repeatIntervalSeconds > 0 && secondsSinceLastAlert < repeatIntervalSeconds) {
              continue; // Not enough time passed since last alert
          }

          // Get sensor name for personalized alert
          const metadata = getSensorMetadataStmt.get(sensor.sensorId);
          const sensorName = metadata?.customName || `Sensor ${sensor.sensorId}`;

          // Build alert message
          const conditionText = config.condition === 'above' ? 'exceeds' : config.condition === 'below' ? 'is below' : config.condition === 'equal' ? 'equals' : 'does not equal';
          const message = `ALERT: ${sensorName} (ID: ${sensor.sensorId}) value ${currentValue} ${conditionText} threshold ${config.threshold}. ${customMessage}`;

          // Send notifications
          if (getSetting('emailAlertsEnabled', 'false') === 'true') {
              await sendEmailAlert(message);
          }
          if (getSetting('smsAlertsEnabled', 'false') === 'true') {
              await sendSmsAlert(message);
          }

          // Update last alert timestamp
          updateLastAlertTimestampStmt.run(now, sensor.sensorId);

          // Mark the sensor data record as having triggered an alert
          try {
              const latestRecord = db.prepare('SELECT id FROM sensor_data WHERE sensorId = ? ORDER BY timestamp DESC LIMIT 1').get(sensor.sensorId);
              if (latestRecord) {
                  updateSensorDataAlertTriggeredStmt.run(latestRecord.id);
              }
          } catch (e) {
              log('ERROR', `Failed to mark alert in sensor_data: ${e.message}`);
          }

          log('INFO', `Alert triggered for sensor ${sensor.sensorId}: ${message}`);
      }
  };

  const openDocumentation = async () => {
      try {
          const candidates = app.isPackaged
              ? [
                    path.join(process.resourcesPath, 'Documentation'),
                    path.join(process.resourcesPath, 'DOCs'),
                ]
              : [path.join(__dirname, 'Documentation'), path.join(__dirname, 'DOCs')];

          let docPath = null;
          for (const p of candidates) {
              if (fs.existsSync(p)) {
                  docPath = p;
                  break;
              }
          }

          if (!docPath) {
              log('ERROR', `Documentation folder not found. Tried: ${candidates.join('; ')}`);
              broadcast('log-message', {
                  timestamp: new Date().toLocaleTimeString(),
                  level: 'ERROR',
                  message: 'Documentation folder missing. Expected "Documentation" or "DOCs" next to the application.',
              });
              return;
          }

          log('INFO', `Opening documentation folder at: ${docPath}`);
          await shell.openPath(docPath);
      } catch (err) {
          log('ERROR', `Failed to open help docs: ${err.message}`);
      }
  };

  // --- Polling & Scraping Logic ---

  const getGatewayUnlockStatus = async (ip) => {
      try {
          const response = await axios.get(`http://${ip}/server.htm`, { timeout: 10000 });
          const $ = cheerio.load(response.data);
          let isUnlocked = false;
          $('h2').each((i, elem) => {
              const h2Text = $(elem).text();
              if (h2Text && h2Text.trim().includes('Default Server Settings - UNLOCKED')) {
                  const style = $(elem).attr('style');
                  if (!style || !style.includes('display:none')) isUnlocked = true;
              }
          });
          return isUnlocked;
      } catch (error) { return false; }
  };

  const getGatewayIdFromMac = (macAddress) => {
      if (!macAddress || typeof macAddress !== 'string') return null;
      const parts = macAddress.split(':');
      if (parts.length < 8) return null;
      const lastFourBytes = parts.slice(4).join('');
      return parseInt(lastFourBytes, 16);
  };

  const getGatewayDetailsFromHttp = async (ip) => {
      try {
          const statusResponse = await axios.get(`http://${ip}/status.htm`, { timeout: 10000 });
          const $ = cheerio.load(statusResponse.data);
          const isReadOnly = $('body').text().includes('Access Restricted - Read Only') || $('.iwarn').text().includes('Access Restricted - Read Only');

          let macAddress = null;
          $('td').each((i, el) => {
              if ($(el).text().trim() === 'Physical Address') macAddress = $(el).next('td').text().trim();
          });

          let firmwareVersion = null;
          $('td').each((i, el) => {
              if ($(el).text().trim().includes('Firmware Version:')) firmwareVersion = $(el).text().replace('Firmware Version:', '').trim();
          });

          let defaultServerStatus = 'Unknown';
          $('td#o').each((i, el) => {
              if ($(el).text().trim().toLowerCase() === 'default server') defaultServerStatus = $(el).next('td#i').text().trim();
          });

          let gatewayId = null;
          if (macAddress) gatewayId = getGatewayIdFromMac(macAddress);

          // Fallback: scrape ID if MAC calc fails
          if (!gatewayId) {
              const titleText = $('title').text();
              const titleMatch = titleText.match(/ID:\s*(\d+)/);
              if (titleMatch && titleMatch[1]) gatewayId = parseInt(titleMatch[1], 10);

              if (!gatewayId) {
                   try {
                      const mainPageResponse = await axios.get(`http://${ip}/`, { timeout: 10000 });
                      const $main = cheerio.load(mainPageResponse.data);
                      const titleTextMain = $main('title').text();
                      const titleMatchMain = titleTextMain.match(/ID:\s*(\d+)/);
                      if (titleMatchMain && titleMatchMain[1]) gatewayId = parseInt(titleMatchMain[1], 10);
                   } catch(e) {}
              }
          }

          if (!macAddress && gatewayId) macAddress = 'Unknown (HTTP only)';
          if (!gatewayId) return null;

          const isUnlocked = await getGatewayUnlockStatus(ip);

          return { gatewayId, ip, firmwareVersion, macAddress, isUnlocked, isReadOnly, defaultServerStatus };
      } catch (error) { return null; }
  };

  const getGatewayAllDetails = async (ip) => {
    // FIXED: Add timeout wrapper to prevent hanging
    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
            log('WARN', `[Scan] Timeout reached for ${ip}`);
            resolve(null);
        }, 8000); // 8 second timeout per IP
    });

    const detailsPromise = (async () => {
        try {
            // FIXED: Try HTTP first (faster and more reliable for scanning)
            let httpDetails = null;
            try {
                httpDetails = await getGatewayDetailsFromHttp(ip);
                if (httpDetails) {
                    // FIXED: Check Modbus connection separately with shorter timeout
                    const isModbusActive = await Promise.race([
                        verifyModbusConnection(ip),
                        new Promise(resolve => setTimeout(() => resolve(false), 3000))
                    ]);
                    return { ...httpDetails, isModbusActive };
                }
            } catch (error) {
                log('DEBUG', `[Scan] HTTP check failed for ${ip}: ${error.message}`);
            }

            // FIXED: If HTTP fails, try Modbus-only detection
            if (!httpDetails) {
                const isModbusActive = await Promise.race([
                    verifyModbusConnection(ip),
                    new Promise(resolve => setTimeout(() => resolve(false), 3000))
                ]);

                if (isModbusActive) {
                    try {
                        const modbusDetails = await Promise.race([
                            pollGateway(ip),
                            new Promise(resolve => setTimeout(() => resolve(null), 3000))
                        ]);

                        if (modbusDetails && modbusDetails.gatewayId) {
                            return {
                                gatewayId: modbusDetails.gatewayId,
                                ip: ip,
                                firmwareVersion: modbusDetails.firmwareVersion,
                                macAddress: 'Unknown (MODBUS only)',
                                isUnlocked: false,
                                isReadOnly: false,
                                isModbusActive: true,
                                defaultServerStatus: 'Unknown',
                            };
                        }
                    } catch (error) {
                        log('DEBUG', `[Scan] Modbus poll failed for ${ip}: ${error.message}`);
                    }
                }
            }

            return null;
        } catch (error) {
            log('DEBUG', `[Scan] Unexpected error for ${ip}: ${error.message}`);
            return null;
        }
    })();

    // FIXED: Race between details collection and timeout
    return Promise.race([detailsPromise, timeoutPromise]);
};

  const verifyModbusConnection = async (ip) => {
    // FIXED: Add multiple layers of timeout protection
    const connectionTimeout = 4000; // 4 seconds total timeout

    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
            log('DEBUG', `[Scan] Connection verification timeout for ${ip}`);
            resolve(false);
        }, connectionTimeout);
    });

    const connectionPromise = (async () => {
        try {
            // FIXED: Try to get connection with short timeout
            const connection = await connectionPool.getConnection(ip);

            // FIXED: Quick heartbeat with timeout
            const heartbeatPromise = connectionPool.performHeartbeat(connection);
            const heartbeatTimeout = new Promise((resolve) => {
                setTimeout(() => resolve(false), 2000);
            });

            const heartbeatResult = await Promise.race([heartbeatPromise, heartbeatTimeout]);

            // FIXED: Always release connection
            connectionPool.releaseConnection(ip);

            return heartbeatResult === undefined ? true : false;

        } catch (error) {
            // FIXED: Always release connection on error
            try {
                connectionPool.releaseConnection(ip);
            } catch (releaseError) {
                // Ignore release errors
            }

            if (error.message.includes('Connection pool is shutting down')) {
                log('DEBUG', `[Scan] Connection pool shutting down during scan`);
            } else if (error.message.includes('timeout')) {
                log('DEBUG', `[Scan] Connection timeout for ${ip}`);
            } else {
                log('DEBUG', `[Scan] Connection failed for ${ip}: ${error.message}`);
            }
            return false;
        }
    })();

    return Promise.race([connectionPromise, timeoutPromise]);
};

  // FIXED: Use connection pool instead of creating new sockets
  const pollGateway = async (ip) => {
      try {
          const connection = await connectionPool.getConnection(ip);

          const resp = await connection.client.readHoldingRegisters(0, 5);
          const buffer = resp.response.body.values;
          const gatewayId = parse32BitValue(buffer[0], buffer[1]);
          const firmwareVersion = `${buffer[2] >> 8}.${buffer[2] & 0xFF}`;
          const sensorCount = buffer[4];

          // Release connection back to pool
          connectionPool.releaseConnection(ip);

          return { gatewayId, firmwareVersion, sensorCount };
      } catch (error) {
          // Release connection even on error
          connectionPool.releaseConnection(ip);
          throw error;
      }
  };

  // FIXED: Use connection pool instead of creating new sockets
  const pollSensorBatch = async (ip, startSlot, batchSize) => {
       return new Promise(async (resolve, reject) => {
          try {
              const connection = await connectionPool.getConnection(ip);

              const startRegister = 100 + (startSlot - 1) * 16;
              const registerCount = batchSize * 16;

              const resp = await connection.client.readHoldingRegisters(startRegister, registerCount);
              const buffer = resp.response.body.values;
              const sensors = [];

              for (let i = 0; i < batchSize; i++) {
                  const offset = i * 16;
                  const sensorData = buffer.slice(offset, offset + 16);
                  const sensorId = parse32BitValue(sensorData[0], sensorData[1]);

                  if (sensorId !== 0 && sensorData[4] === 1) {
                      const voltage = sensorData[6] / 100;
                      const metadata = getSensorMetadataStmt.get(sensorId);

                      sensors.push({
                          slot: startSlot + i,
                          sensorId: sensorId,
                          deviceType: sensorData[2],
                          dataAge: sensorData[3],
                          isAware: sensorData[5] === 1,
                          voltage: voltage,
                          batteryPercentage: calculateBatteryPercentage(sensorData[2], voltage),
                          rssi: sensorData[7],
                          data: sensorData.slice(8),
                          lastCheckin: new Date().toISOString(),
                          customName: metadata ? metadata.customName : null,
                          colorGroup: metadata ? metadata.colorGroup : null
                      });
                  }
              }

              // Release connection back to pool
              connectionPool.releaseConnection(ip);

              resolve(sensors);
          } catch (error) {
              // Release connection even on error
              connectionPool.releaseConnection(ip);
              reject(error);
          }
      });
  };

  const scrapeGatewayDeviceList = async (ip) => {
      try {
          const response = await axios.get(`http://${ip}/status.htm`, { timeout: 5000 });
          const $ = cheerio.load(response.data);
          const devices = [];
          $('#cts > div:nth-child(3) table#t tr').slice(1).each((i, el) => {
              devices.push({
                  slot: $(el).find('td').eq(0).text().trim(),
                  deviceId: $(el).find('td').eq(1).text().trim(),
              });
          });
          return devices;
      } catch (error) { throw error; }
  };

  /** Stops the Modbus poll loop and syncs renderer status (use for stop IPC, timeouts, gateway removal, etc.). */
  const stopPollingAndIdleUpdate = (logMsg) => {
      clearTimeout(pollingTimeoutId);
      pollingTimeoutId = null;
      isPolling = false;
      pollingTargetGatewayId = null;
      if (logMsg) log('INFO', logMsg);
      broadcast('polling-status', false);
      broadcast('polling-state-change', { state: 'idle' });
      const ag = getActiveGatewayStmt.get();
      if (ag) {
          broadcast('system-status-update', { gatewayStatus: `Idle (ID ${ag.gatewayId})` });
      } else {
          broadcast('system-status-update', { gatewayStatus: 'No Gateway Selected' });
      }
  };

  /** Each cycle reads the active gateway from DB so switching gateways cannot leave polling stuck on a stale IP. */
  const startPollingCycle = async () => {
      if (!isPolling) return;

      const activeGateway = getActiveGatewayStmt.get();
      if (!activeGateway) {
          stopPollingAndIdleUpdate('[POLL] No active gateway during poll cycle.');
          broadcast('no-active-gateway');
          return;
      }

      const ip = activeGateway.ip && String(activeGateway.ip).trim();
      if (!ip) {
          log('ERROR', `[POLL] Active gateway ID ${activeGateway.gatewayId} has no IP in the database. Re-save the gateway or remove it.`);
          stopPollingAndIdleUpdate('[POLL] Stopped: active gateway IP missing.');
          return;
      }

      try {
          let gatewayInfo;
          try {
              gatewayInfo = await pollGateway(ip);
              log('INFO', `Successfully polled gateway ${gatewayInfo.gatewayId}`);
          } catch (error) {
              // FIX: Detailed error logging — gateway unreachable/timeouts stop polling on main (do not schedule retry)
              const msg = (error.message || '').toLowerCase();
              const isTimeout =
                  error.code === 'ETIMEDOUT' ||
                  error.code === 'ESOCKETTIMEDOUT' ||
                  msg.includes('timeout') ||
                  msg.includes('timed out') ||
                  msg.includes('connection establishment timeout');
              log('ERROR', `Gateway Poll Error (${ip}): ${error.message} ${isTimeout ? '(Timeout)' : ''}`);

              if (isTimeout) {
                  broadcast('gateway-timeout', { ip, gatewayId: activeGateway.gatewayId });
                  stopPollingAndIdleUpdate(null);
                  return;
              }
              throw error;
          }

          let allSensors = [];
          const totalSensors = gatewayInfo.sensorCount;
          let activeSensorCount = 0;

          broadcast('polling-state-change', { state: 'detecting' });
          broadcast('system-status-update', { gatewayStatus: `ID ${gatewayInfo.gatewayId} Active` });

          if (fullDeviceList.length === 0) {
               try {
                  fullDeviceList = await scrapeGatewayDeviceList(ip);
               } catch(e) { /* ignore scrape errors */ }
          }

          // FIX: Promisified batch polling to prevent overlap
          const pollNextBatch = async (startSlot) => {
              if (!isPolling) return; // Exit if stopped

              if (startSlot > totalSensors) {
                  log('INFO', `Polling cycle complete. Found ${activeSensorCount} active sensors.`);

                  const activeSensorIds = allSensors.map(s => s.sensorId.toString());
                  const inactiveSensors = fullDeviceList.filter(d => !activeSensorIds.includes(d.deviceId));

                  // --- Cache Data & Broadcast ---
                  // FIX: Always include full gatewayInfo
                  lastSensorDataPayload = { gateway: gatewayInfo, sensors: allSensors, inactiveSensors: inactiveSensors };
                  broadcast('modbus-data', lastSensorDataPayload);

                  broadcast('polling-state-change', { state: 'polling', activeSensors: activeSensorCount, totalSensors: fullDeviceList.length });
                  broadcast('system-status-update', { sensorsStatus: `${activeSensorCount}/${fullDeviceList.length} Active` });

                  // --- PLUGIN HOOK: Broadcast Data ---
                  if (allSensors.length > 0) {
                      pluginManager.broadcastData(allSensors, gatewayInfo);
                  }

                  return; // End of this cycle
              }

              let currentBatchSize = Math.min(POLL_BATCH_SIZE, totalSensors - startSlot + 1);
              const MODBUS_MAX_REGISTERS = 125;
              const FALLBACK_BATCH_SIZE = Math.floor(MODBUS_MAX_REGISTERS / 16);

              try {
                  let batchResult;
                  try {
                      batchResult = await pollSensorBatch(ip, startSlot, currentBatchSize);
                  } catch (batchErr) {
                      if (currentBatchSize > FALLBACK_BATCH_SIZE) {
                          log('WARN', `Polling batch of ${currentBatchSize} sensors failed (${currentBatchSize * 16} registers may exceed gateway limit). Retrying with ${FALLBACK_BATCH_SIZE} sensors.`);
                          currentBatchSize = Math.min(FALLBACK_BATCH_SIZE, totalSensors - startSlot + 1);
                          batchResult = await pollSensorBatch(ip, startSlot, currentBatchSize);
                      } else {
                          throw batchErr;
                      }
                  }
                  if (batchResult.length > 0) {
                      allSensors = allSensors.concat(batchResult);
                      activeSensorCount += batchResult.length;

                      // --- HISTORY DEDUPLICATION LOGIC ---
                      // Only log when Data Age has been confirmed to RESET (decreased).
                      // Sensors can retransmit "logged data" when reconnecting; that must NOT be logged as new.
                      const sensorsToLog = [];
                      const pollTimeSec = Math.floor(Date.now() / 1000);
                      for (const sensor of batchResult) {
                          const lastState = sensorHistoryCache.get(sensor.sensorId);
                          const currentDataStr = JSON.stringify(sensor.data);
                          const dataAgeSec = sensor.dataAge != null ? sensor.dataAge : 0;
                          const actualTimestamp = Math.max(0, pollTimeSec - dataAgeSec);

                          let shouldLog = false;

                          // 1. First time: bootstrap cache only, do NOT log (could be retransmitted logged data)
                          if (!lastState) {
                              shouldLog = false;
                          }
                          // 2. Data Age decreased = confirmed reset = new message from sensor
                          else if (sensor.dataAge < lastState.dataAge) {
                              shouldLog = true;
                          }

                          if (shouldLog) {
                              sensorsToLog.push(sensor);
                              sensorHistoryCache.set(sensor.sensorId, {
                                  dataAge: sensor.dataAge,
                                  dataStr: currentDataStr,
                                  lastLoggedTimestamp: actualTimestamp
                              });
                          } else {
                              // Always update cache with current state so we can detect future dataAge resets
                              sensorHistoryCache.set(sensor.sensorId, {
                                  dataAge: sensor.dataAge,
                                  dataStr: currentDataStr,
                                  lastLoggedTimestamp: lastState?.lastLoggedTimestamp ?? null
                              });
                          }
                      }

                      if (sensorsToLog.length > 0) {
                          dbTransaction(sensorsToLog, gatewayInfo.gatewayId);
                          // Only trigger alerts on new data to prevent spam
                          await evaluateAndTriggerAlerts(sensorsToLog, gatewayInfo.gatewayId);
                          log('DEBUG', `Logged ${sensorsToLog.length} new sensor records.`);
                          const maxRecords = parseInt(getSetting('maxRecords', '5000'), 10) || 5000;
                          for (const sensor of sensorsToLog) {
                              try {
                                  const records = db.prepare('SELECT * FROM sensor_data WHERE sensorId = ? ORDER BY timestamp DESC LIMIT ?').all(sensor.sensorId, maxRecords);
                                  broadcast('device-history-data', { deviceId: sensor.sensorId, isGateway: false, records });
                              } catch (e) { /* ignore */ }
                          }
                      }
                  }
              } catch (error) {
                   log('ERROR', `Polling batch failed (Slot ${startSlot}): ${error.message}`);
              }

              // Chain next batch
              await new Promise(r => setTimeout(r, 200)); // Small delay between batches
              await pollNextBatch(startSlot + currentBatchSize);
          };

          await pollNextBatch(1);

      } catch (err) {
          log('WARN', `Polling cycle interrupted: ${err.message}`);
      } finally {
          // FIX: Only schedule next poll after current one finishes (success or fail)
          if (isPolling) {
              pollingTimeoutId = setTimeout(() => startPollingCycle(), POLLING_INTERVAL);
          }
      }
  };

  // FIX: State variable for external devices deduplication
  let lastExternalDevicesStr = '';
  let externalDeviceIntervalId = null;

  const getAlertingStatusText = () => {
      const enabled = getSetting('alertingEnabled', 'false') === 'true';
      if (!enabled) return 'Inactive';
      const emailOn = getSetting('emailAlertsEnabled', 'false') === 'true';
      const smsOn = getSetting('smsAlertsEnabled', 'false') === 'true';
      const hasEmail = !!(getSetting('smtpServer') && getSetting('smtpPort') && getSetting('recipientEmail'));
      const hasSms = !!(getSetting('textbeltApiKey') && getSetting('recipientSms'));
      const emailReady = emailOn && hasEmail;
      const smsReady = smsOn && hasSms;
      if (emailReady && smsReady) return 'Email + SMS';
      if (emailReady) return 'Email';
      if (smsReady) return 'SMS';
      return 'Not Configured';
  };

  // Map external device type (from DB) to plugin ID for enabled-check
  const deviceTypeToPluginId = (type) => {
      if (!type) return null;
      const t = String(type);
      if (t === 'MQTT Subscriber') return 'mqtt_subscriber';
      if (t.startsWith('SNMP')) return 'snmptrap';
      if (t === 'LoRaWAN') return 'lorawan';
      if (t === 'BACnet Subscriber') return 'bacnet_subscriber';
      if (t === 'MODBUS Poller') return 'modbus_poller';
      return null;
  };

  const filterExternalDevicesByPluginState = (devices) => {
      if (!devices || !Array.isArray(devices)) return [];
      return devices.filter(d => {
          const pluginId = deviceTypeToPluginId(d.type);
          if (!pluginId) return true; // Unknown type: show (legacy/custom)
          const plugin = pluginManager.plugins[pluginId];
          const state = pluginManager.pluginStates[pluginId];
          const enabled = (plugin?.config?.enabled) ?? (state?.enabled) ?? false;
          return enabled;
      });
  };

  const fetchAndBroadcastExternalDevices = () => {
      if (!mainWindow) return;
      try {
          const all = db.prepare('SELECT * FROM external_devices ORDER BY lastSeen DESC').all();
          const filtered = filterExternalDevicesByPluginState(all);
          const currentStr = JSON.stringify(filtered);
          if (currentStr !== lastExternalDevicesStr) {
              lastExternalDevicesStr = currentStr;
              broadcast('external-devices-data', filtered);
          }
      } catch (err) { log('ERROR', `[ExternalDeviceLoop] ${err.message}`); }
  };

  const startExternalDeviceLoop = () => {
      log('INFO', 'Starting external device loop...');
      fetchAndBroadcastExternalDevices();
      externalDeviceIntervalId = setInterval(fetchAndBroadcastExternalDevices, 5000);
  };

  // --- Email / SMS Alerts ---
  const sendEmailAlert = async (message) => {
      if (getSetting('emailAlertsEnabled', 'false') !== 'true') return;
      const config = {
          server: getSetting('smtpServer'), port: getSetting('smtpPort'), username: getSetting('smtpUsername'),
          password: getSetting('smtpPassword'), fromName: getSetting('smtpFromName'), fromEmail: getSetting('smtpFromEmail'),
          to: getSetting('recipientEmail')
      };
      if (!config.server || !config.port || !config.to) return;
      try {
          const transporter = nodemailer.createTransport({
              host: config.server, port: config.port, secure: config.port == 465,
              auth: { user: config.username, pass: config.password },
          });
          await transporter.sendMail({
              from: `"${config.fromName}" <${config.fromEmail}>`, to: config.to,
               subject: "Monnit Utility - SENSOR ALERT", text: message,
          });
          log('INFO', `Sent email alert to ${config.to}`);
      } catch (error) { log('ERROR', `Failed to send email alert: ${error.message}`); }
  };

  // Replace the sendSmsAlert function with this improved version:
const sendSmsAlert = async (message) => {
    if (getSetting('smsAlertsEnabled', 'false') !== 'true') return;
    const apiKey = getSetting('textbeltApiKey');
    const recipientSms = getSetting('recipientSms');
    if (!apiKey || !recipientSms) return;
    try {
        const payload = new URLSearchParams({
            phone: recipientSms,
            message: message.substring(0, 160), // Textbelt limit
            key: apiKey,
        }).toString();

        const response = await axios.post('https://textbelt.com/text', payload, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        // Check if Textbelt actually accepted it
        if (response.data && response.data.success) {
            log('INFO', `Sent SMS alert to ${recipientSms}`);
        } else {
            log('ERROR', `SMS failed: ${response.data?.error || 'Invalid key or no quota'}`);
        }
    } catch (error) {
        log('ERROR', `Failed to send SMS alert: ${error.message}`);
    }
};

  const PORT = 7001;

  // --- Electron Window Creation ---
  const createWindow = async () => {
      mainWindow = new BrowserWindow({
          width: 1400,
          height: 900,
          webPreferences: {
              preload: path.join(__dirname, 'preload.js'),
              contextIsolation: true,
              nodeIntegration: false,
          },
      });

      let loadFile = 'setup.html';
      try {
          if (fs.existsSync(path.join(app.getPath('userData'), 'setup.lock'))) {
              loadFile = 'index.html';
          }
      } catch (err) {}

      mainWindow.loadFile(path.join(__dirname, 'public', loadFile));

      // --- Application Menu with Help > Documentation ---
      const menuTemplate = [
        ...(process.platform === 'darwin' ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
        {
            label: 'File',
            submenu: [
                process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Open Documentation',
                    click: async () => {
                        await openDocumentation();
                    }
                }
            ]
        }
      ];
      const menu = Menu.buildFromTemplate(menuTemplate);
      Menu.setApplicationMenu(menu);

      if (!app.isPackaged) {
          mainWindow.webContents.openDevTools();
      }

      try {
          let iconPath;
          // Define search paths based on environment
          const searchPaths = app.isPackaged
            ? [
                path.join(process.resourcesPath, 'tray-icon.png'),
                path.join(process.resourcesPath, 'tray-icon.ico'),
                path.join(process.resourcesPath, 'favicon.ico')
              ]
            : [
                path.join(__dirname, 'public', 'tray-icon.png'),
                path.join(__dirname, 'public', 'tray-icon.ico'),
                path.join(__dirname, 'public', 'favicon.ico')
              ];

          // Find the first icon that exists
          for (const p of searchPaths) {
              if (fs.existsSync(p)) {
                  iconPath = p;
                  break;
              }
          }

          if (iconPath) {
              let trayIcon = nativeImage.createFromPath(iconPath);

              // Mac-specific processing
              if (process.platform === 'darwin') {
                  // Resize to 16x16 points (logical pixels) for Mac Menu Bar
                  // Use resize({ height: 16 }) to maintain aspect ratio if width != height
                  trayIcon = trayIcon.resize({ height: 16 });
                  trayIcon.setTemplateImage(true);
              }

              tray = new Tray(trayIcon);
              const contextMenu = Menu.buildFromTemplate([
                  { label: 'Show App', click: () => mainWindow.show() },
                  { label: 'Documentation', click: () => openDocumentation() },
                  { label: 'Quit', click: () => { isQuitting = true; app.quit(); }}
              ]);
              tray.setToolTip('Monnit ALTA MODBUS TCP Utility');
              tray.setContextMenu(contextMenu);
              tray.on('click', () => {
                  if (mainWindow.isVisible()) mainWindow.hide(); else mainWindow.show();
              });
              console.log(`[Tray] Initialized successfully using: ${iconPath}`);
          } else {
              console.error(`[Tray] Failed to find any icon. Searched: ${JSON.stringify(searchPaths)}`);
          }
      } catch (e) { console.error("Failed to initialize tray:", e); }

      mainWindow.on('close', (event) => {
          if (!isQuitting) {
              event.preventDefault();
              mainWindow.hide();
              return false;
          }
          return true;
      });

      // Compatibility Wrappers
      const dbWrapper = {
          get: (sql, ...args) => {
              if (args.length > 0 && typeof args[args.length - 1] === 'function') {
                  const cb = args.pop();
                  try {
                      const result = db.prepare(sql).get(...args);
                      cb(null, result);
                      return result;
                  } catch (err) {
                      cb(err);
                  }
              } else {
                  return db.prepare(sql).get(...args);
              }
          },
          all: (sql, ...args) => {
              if (args.length > 0 && typeof args[args.length - 1] === 'function') {
                  const cb = args.pop();
                  try {
                      const result = db.prepare(sql).all(...args);
                      cb(null, result);
                      return result;
                  } catch (err) {
                      cb(err);
                  }
              } else {
                  return db.prepare(sql).all(...args);
              }
          },
          run: (sql, ...args) => {
              if (args.length > 0 && typeof args[args.length - 1] === 'function') {
                  const cb = args.pop();
                  try {
                      const result = db.prepare(sql).run(...args);
                      cb.call(result, null);
                      return result;
                  } catch (err) {
                      cb(err);
                  }
              } else {
                  return db.prepare(sql).run(...args);
              }
          },
          exec: (sql, cb) => {
               try {
                   db.exec(sql);
                   if (cb) cb(null);
               } catch(err) {
                   if (cb) cb(err);
               }
          }
      };

      const socketWrapper = {
          on: (channel, callback) => { ipcMain.on(channel, (event, ...args) => callback(...args)); },
          // RESTORED: Plugins depend on '.emit()' to broadcast logs and config data to UI
          emit: (channel, data) => { broadcast(channel, data); },
          broadcast: (channel, data) => { broadcast(channel, data); }
      };

      const pruneExternalDeviceHistoryStmt = db.prepare(
          'DELETE FROM external_device_history WHERE id IN (SELECT id FROM external_device_history WHERE deviceId = ? ORDER BY timestamp ASC LIMIT (SELECT MAX(0, COUNT(*) - ?) FROM external_device_history WHERE deviceId = ?))'
      );

      const pruneExternalDeviceHistory = (deviceId) => {
          if (!deviceId) return;
          try {
              const maxRecords = parseInt(getSetting('maxRecords', '5000'), 10) || 5000;
              pruneExternalDeviceHistoryStmt.run(deviceId, maxRecords, deviceId);
          } catch (e) { /* ignore */ }
      };

      const notifyExternalHistoryUpdate = (deviceId) => {
          if (!mainWindow || !deviceId) return;
          try {
              const maxRecords = parseInt(getSetting('maxRecords', '5000'), 10) || 5000;
              const records = db.prepare('SELECT * FROM external_device_history WHERE deviceId = ? ORDER BY timestamp DESC LIMIT ?').all(deviceId, maxRecords);
              broadcast('external-device-history-data', { deviceId, records });
          } catch (e) { /* ignore */ }
      };

      const pluginDeps = {
          db: dbWrapper,
          log,
          io: () => socketWrapper,
          getSetting,
          getNumericReading,
          deviceTypeToName,
          notifyExternalHistoryUpdate,
          pruneExternalDeviceHistory
      };

      try {
          await pluginManager.init(pluginDeps);
          pluginManager.registerSocketHandlers(socketWrapper);
          // --- Init Auto Downloader ---
          // //          initAutoDownloader();

          log('INFO', 'Plugins and Auto-Downloader initialized.');
      } catch (err) {
          log('ERROR', `Plugin init failed: ${err.message}`);
      }

      // Initialize connection pool
      initConnectionPool();

      // --- IPC Listeners ---

      ipcMain.on('client-ready', (event) => {
          log('INFO', 'Client connected (Renderer Ready).');
          broadcast('system-status-update', { serverStatus: 'Active', alertingStatus: getAlertingStatusText() });
          broadcast('polling-status', isPolling);

          if (isPolling && lastSensorDataPayload) {
               broadcast('modbus-data', lastSensorDataPayload);
               const activeCount = lastSensorDataPayload.sensors ? lastSensorDataPayload.sensors.length : 0;
               const totalCount = fullDeviceList.length || activeCount;
               broadcast('polling-state-change', { state: 'polling', activeSensors: activeCount, totalSensors: totalCount });
          } else {
               // Update status if idle
               const activeGateway = getActiveGatewayStmt.get();
               if (activeGateway) {
                   broadcast('system-status-update', { gatewayStatus: `Idle (ID ${activeGateway.gatewayId})` });
               } else {
                   broadcast('system-status-update', { gatewayStatus: 'No Gateway Selected' });
               }
          }

          const gateways = db.prepare('SELECT * FROM gateway_data ORDER BY isActive DESC, gatewayId ASC').all();
          broadcast('known-gateways', gateways);

          const activeGw = getActiveGatewayStmt.get();
          if (activeGw?.ip) {
              getGatewayAllDetails(activeGw.ip).then(details => {
                  if (details) {
                      saveGatewayToDb(details);
                      const gws = db.prepare('SELECT * FROM gateway_data ORDER BY isActive DESC, gatewayId ASC').all();
                      broadcast('known-gateways', gws);
                  }
              }).catch(() => {});
          }

          const alertConfigs = getAlertConfigsStmt.all();
          broadcast('alert-configs-data', alertConfigs);

          const sensorMeta = {};
          getAllSensorMetadataStmt.all().forEach(row => {
              sensorMeta[row.sensorId] = { customName: row.customName, colorGroup: row.colorGroup };
          });
          broadcast('all-sensor-metadata', sensorMeta);

          const externalMeta = {};
          getAllExternalMetadataStmt.all().forEach(row => {
              externalMeta[row.id] = { customName: row.customName, colorGroup: row.colorGroup };
          });
          broadcast('all-external-metadata', externalMeta);

          fetchAndBroadcastExternalDevices();

          // FIX: Ensure all settings have valid default strings to prevent 'undefined' in frontend inputs
          // FIX: Fetch FRESH data from DB to avoid staleness on reload
              const settings = {
                    // FIX: Use same helper to fetch updated values from DB
                    port: getSetting('port', '7001'),
                    maxRecords: getSetting('maxRecords', '5000') || '5000',
                    alertingEnabled: getSetting('alertingEnabled') === 'true',
                    emailAlertsEnabled: getSetting('emailAlertsEnabled') === 'true',
                    smsAlertsEnabled: getSetting('smsAlertsEnabled') === 'true',
                    repeatAlertInterval: getSetting('repeatAlertInterval') || '60',
                    smtpServer: getSetting('smtpServer') || '',
                    smtpPort: getSetting('smtpPort') || '',
                    smtpUsername: getSetting('smtpUsername') || '',
                    smtpPassword: getSetting('smtpPassword') || '',
                    smtpFromName: getSetting('smtpFromName') || '',
                    smtpFromEmail: getSetting('smtpFromEmail') || '',
                    recipientEmail: getSetting('recipientEmail') || '',
                    textbeltApiKey: getSetting('textbeltApiKey') || '',
                    recipientSms: getSetting('recipientSms') || '',
                    alertCustomMessage: getSetting('alertCustomMessage') || '',
                    autoUpdateEnabled: process.platform === 'darwin' ? false : getSetting('autoUpdateEnabled') === 'true',
                    autoDownloadEnabled: getSetting('autoDownloadEnabled') === 'true',
                    autoDownloadFormat: getSetting('autoDownloadFormat') || 'csv',
                    autoDownloadFrequency: getSetting('autoDownloadFrequency') || 'daily',
                    autoDownloadTime: getSetting('autoDownloadTime') || '00:00',
                    // ADD THESE THREE LINES:
                    backupEnabled: getSetting('backupEnabled') === 'true',
                    backupFrequency: getSetting('backupFrequency') || 'daily',
                    maxBackups: getSetting('maxBackups') || '1',
                    platform: process.platform,
                    appVersion: app.getVersion()
              };
          broadcast('current-settings', settings);

          if (pluginManager && pluginManager.broadcastStatus) {
               pluginManager.broadcastStatus();
          }

          const autoUpdate = getSetting('autoUpdateEnabled', 'true') === 'true';
          const lastCheck = parseInt(getSetting('lastUpdateCheck') || '0', 10);
          const WEEK = 7 * 24 * 60 * 60 * 1000;

          if (autoUpdate && (Date.now() - lastCheck > WEEK)) {
              log('INFO', 'Weekly auto-update check triggered.');
              checkForUpdates();
          }
      });

      // --- IPC Handlers ---

      // === Gemini Agent: Fix Bug (lazy-load ESM with Persistent History) ===
      let agentHistory = []; // Global history state for this session

      ipcMain.handle('agent:fix-bug', async (_event, { bugReport }) => {
          try {
              // Lazy load the agent
              const { fixBug } = await import('./agents/orchestrator.mjs');

              // --- PERSISTENCE: Reload history from DB if in-memory is empty ---
              if (agentHistory.length === 0) {
                  try {
                      const savedHistory = getSetting('agentHistory');
                      if (savedHistory) {
                          agentHistory = JSON.parse(savedHistory);
                          console.log(`[Agent] Reloaded conversation history from database (${agentHistory.length} turns).`);
                      }
                  } catch (loadErr) {
                      console.error("[Agent] Failed to load history from DB:", loadErr.message);
                  }
              }

              // Pass the persistent history to the agent and update it with the result
              const result = await fixBug(bugReport || '', agentHistory);
              agentHistory = result.history;

              // --- PERSISTENCE: Save updated history to DB ---
              try {
                  saveSetting('agentHistory', JSON.stringify(agentHistory));
              } catch (saveErr) {
                  console.error("[Agent] Failed to save history to DB:", saveErr.message);
              }

              // Log to main terminal so the user can always see what the agent decided
              console.log("\n=== Gemini Agent Final Response ===\n");
              console.log(result.summary);
              console.log("\n====================================\n");

              return { ok: true, summary: result.summary };
          } catch (e) {
              console.error("[Agent Error]", e);
              return { ok: false, error: e?.message || String(e) };
          }
      });

      ipcMain.on('check-for-updates', () => {
          if (process.platform === 'darwin') {
              // On Mac: immediately open GitHub latest release (DMG download) in browser
              log('INFO', 'User triggered manual download for Mac. Opening GitHub releases.');
              broadcast('update-status', { message: 'Opening GitHub releases...', color: 'var(--info-accent)' });
              shell.openExternal(macUpdateUrl);
              return;
          }
          if (updateReadyToInstall) {
              log('INFO', 'User triggered update install.');
              autoUpdater.quitAndInstall();
              return;
          }
          log('INFO', 'User triggered manual update check.');
          checkForUpdates();
      });


      ipcMain.on('set-auto-update', (event, isEnabled) => {
          if (process.platform === 'darwin') {
            return;
          }
          saveSetting('autoUpdateEnabled', isEnabled.toString());
          log('INFO', `Automatic updates set to: ${isEnabled}`);
          log('INFO', `Automatic updates set to: ${isEnabled}`);

          // Provide user feedback
          broadcast('update-status', {
              message: `Auto-update ${isEnabled ? 'enabled' : 'disabled'}.`,
              color: 'var(--success-accent)'
          });
      });

      // --- New Auto Download Handlers ---
      ipcMain.on('save-auto-download-settings', (event, config) => {
          try {
              saveSetting('autoDownloadEnabled', config.enabled.toString());
              saveSetting('autoDownloadFormat', config.format);
              saveSetting('autoDownloadFrequency', config.frequency);
              saveSetting('autoDownloadTime', config.time);

              // Reload downloader config immediately
              if (downloader) downloader.reload();

              broadcast('auto-download-saved', 'Auto-download settings saved.');
          } catch(err) {
              log('ERROR', `Failed to save auto-download settings: ${err.message}`);
          }
      });

// --- Database Backup IPC Handlers ---
ipcMain.on('save-backup-settings', (event, config) => {
    try {
        saveSetting('backupEnabled', config.enabled.toString());
        saveSetting('backupFrequency', config.frequency);
        saveSetting('maxBackups', config.maxBackups.toString());

        if (backupManager) {
            backupManager.reload();
        }

        broadcast('backup-settings-saved', 'Backup settings saved successfully.');
    } catch (err) {
        log('ERROR', `Failed to save backup settings: ${err.message}`);
        broadcast('backup-status', {
            success: false,
            message: `Save failed: ${err.message}`,
            color: 'var(--danger-accent)'
        });
    }
});

ipcMain.on('backup-now', () => {
    if (backupManager) {
        backupManager.backupNow();
    } else {
        broadcast('backup-status', {
            success: false,
            message: 'Backup manager not initialized.',
            color: 'var(--danger-accent)'
        });
    }
});

// Initialize backup manager after DB is ready
initBackupManager();

      ipcMain.on('open-documents-folder', async () => {
          const docsPath = app.getPath('documents');
          const exportPath = path.join(docsPath, 'Monnit_Data_Export');
          if (!fs.existsSync(exportPath)) {
              fs.mkdirSync(exportPath, { recursive: true });
          }
          await shell.openPath(exportPath);
      });

// --- Database Backup Folder Opener ---
ipcMain.on('open-backups-folder', async () => {
    try {
        const backupDir = path.join(app.getPath('userData'), 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        await shell.openPath(backupDir);
        log('INFO', `Opened backups folder: ${backupDir}`);
    } catch (err) {
        log('ERROR', `Failed to open backups folder: ${err.message}`);
    }
});

      ipcMain.on('reset-all-gateways', () => {
          try {
              if (isPolling || pollingTimeoutId) {
                  stopPollingAndIdleUpdate('[POLL] Stopped polling — all gateways reset.');
              }
              deleteAllGatewaysStmt.run();
              deleteAllSensorDataStmt.run();
              log('INFO', 'All gateways and sensor data reset by user.');
              broadcast('gateways-reset-success');
              fullDeviceList = [];
              lastSensorDataPayload = null;
          } catch (err) {
              log('ERROR', `Failed to reset gateways: ${err.message}`);
          }
      });

      ipcMain.on('remove-gateway', (event, gatewayId) => {
          try {
              const activeBefore = getActiveGatewayStmt.get();
              const removingActive = activeBefore && Number(activeBefore.gatewayId) === Number(gatewayId);
              deleteGatewayStmt.run(gatewayId);
              deleteSensorDataByGatewayStmt.run(gatewayId);
              log('INFO', `Gateway ${gatewayId} removed by user.`);
              if (removingActive && (isPolling || pollingTimeoutId)) {
                  stopPollingAndIdleUpdate('[POLL] Stopped polling — active gateway was removed.');
                  lastSensorDataPayload = null;
              }
              const gateways = db.prepare('SELECT * FROM gateway_data ORDER BY isActive DESC, gatewayId ASC').all();
              broadcast('known-gateways', gateways);
          } catch (err) {
              log('ERROR', `Failed to remove gateway ${gatewayId}: ${err.message}`);
          }
      });

      ipcMain.on('reset-all-alerts', () => {
          try {
              deleteAllAlertsStmt.run();
              log('INFO', 'All alert configurations reset by user.');
              const alertConfigs = getAlertConfigsStmt.all();
              broadcast('alert-configs-data', alertConfigs);
          } catch (err) {
              log('ERROR', `Failed to reset alerts: ${err.message}`);
          }
      });

      ipcMain.on('reset-color-groups', () => {
          try {
              resetColorGroupsStmt.run();
              log('INFO', 'All sensor color groups reset by user.');
              broadcast('color-groups-reset-success');
              const sensorMeta = {};
              getAllSensorMetadataStmt.all().forEach(row => {
                  sensorMeta[row.sensorId] = { customName: row.customName, colorGroup: row.colorGroup };
              });
              broadcast('all-sensor-metadata', sensorMeta);
          } catch (err) {
              log('ERROR', `Failed to reset color groups: ${err.message}`);
          }
      });

      ipcMain.on('reset-sensor-names', () => {
          try {
              resetSensorNamesStmt.run();
              log('INFO', 'All custom sensor names reset by user.');
              broadcast('sensor-names-reset-success');
              const sensorMeta = {};
              getAllSensorMetadataStmt.all().forEach(row => {
                  sensorMeta[row.sensorId] = { customName: row.customName, colorGroup: row.colorGroup };
              });
              broadcast('all-sensor-metadata', sensorMeta);
          } catch (err) {
              log('ERROR', `Failed to reset sensor names: ${err.message}`);
          }
      });

      ipcMain.on('find-gateway-mac', async (event, mac) => {
          broadcast('gateway-find-result', { success: true, message: `Searching for MAC ${mac}...` });
          const existing = db.prepare('SELECT * FROM gateway_data WHERE macAddress LIKE ?').get(`%${mac}%`);
          if (existing) {
               broadcast('gateway-find-result', { success: true, message: `Found known Gateway ${existing.gatewayId} at ${existing.ip}` });
               return;
          }
          broadcast('gateway-find-result', { success: false, message: `Could not find MAC ${mac} in known devices. Please use "Scan Network" or enter IP.` });
      });

      // FIX: Add event as the first parameter
      ipcMain.on('update-settings', (event, settings) => {
          log('INFO', `Received settings update: ${JSON.stringify(settings)}`);

          try {
              // FIX: FORCE string conversion to ensure compatibility with TEXT column
              if (settings.port !== undefined) saveSetting('port', String(settings.port));
              if (settings.maxRecords !== undefined) saveSetting('maxRecords', String(settings.maxRecords));
              if (settings.repeatAlertInterval !== undefined) saveSetting('repeatAlertInterval', String(settings.repeatAlertInterval));

              broadcast('settings-updated', 'Settings saved successfully.');

              const currentSettings = {
                    // FIX: Use same helper to fetch updated values from DB
                    port: getSetting('port', '7001'),
                    maxRecords: getSetting('maxRecords', '5000') || '5000',
                    alertingEnabled: getSetting('alertingEnabled') === 'true',
                    emailAlertsEnabled: getSetting('emailAlertsEnabled') === 'true',
                    smsAlertsEnabled: getSetting('smsAlertsEnabled') === 'true',
                    repeatAlertInterval: getSetting('repeatAlertInterval') || '60',
                    smtpServer: getSetting('smtpServer') || '',
                    smtpPort: getSetting('smtpPort') || '',
                    smtpUsername: getSetting('smtpUsername') || '',
                    smtpPassword: getSetting('smtpPassword') || '',
                    smtpFromName: getSetting('smtpFromName') || '',
                    smtpFromEmail: getSetting('smtpFromEmail') || '',
                    recipientEmail: getSetting('recipientEmail') || '',
                    textbeltApiKey: getSetting('textbeltApiKey') || '',
                    recipientSms: getSetting('recipientSms') || '',
                    alertCustomMessage: getSetting('alertCustomMessage') || '',
                    autoUpdateEnabled: getSetting('autoUpdateEnabled') === 'true',
                    // --- New Auto Download Settings ---
                    autoDownloadEnabled: getSetting('autoDownloadEnabled') === 'true',
                    autoDownloadFormat: getSetting('autoDownloadFormat') || 'csv',
                    autoDownloadFrequency: getSetting('autoDownloadFrequency') || 'daily',
                    autoDownloadTime: getSetting('autoDownloadTime') || '00:00',
                    // ADD THESE THREE LINES:
                    backupEnabled: getSetting('backupEnabled') === 'true',
                    backupFrequency: getSetting('backupFrequency') || 'daily',
                    maxBackups: getSetting('maxBackups') || '1',
                    platform: process.platform
              };
              broadcast('current-settings', currentSettings);
          } catch (err) {
              log('ERROR', `Failed to save settings: ${err.message}`);
              broadcast('log-message', { level: 'ERROR', message: 'Failed to save settings.' });
          }
      });

      // FIX: Add event as the first parameter
      ipcMain.on('update-alerting-status', (event, status) => {
          // FIX: Add safety checks to prevent crashes if status is malformed
          log('INFO', `Updating alert status: ${JSON.stringify(status)}`);
          try {
              if (status && typeof status.main !== 'undefined') {
                  saveSetting('alertingEnabled', String(status.main));
              }
              if (status && typeof status.email !== 'undefined') {
                  saveSetting('emailAlertsEnabled', String(status.email));
              }
              if (status && typeof status.sms !== 'undefined') {
                  saveSetting('smsAlertsEnabled', String(status.sms));
              }
              broadcast('system-status-update', { alertingStatus: getAlertingStatusText() });
          } catch(e) {
              log('ERROR', `Failed to update alert status: ${e.message}`);
          }
      });

      // FIX: Add event as the first parameter
      ipcMain.on('save-email-settings', (event, config) => {
          saveSetting('smtpServer', config.server);
          saveSetting('smtpPort', config.port);
          saveSetting('smtpUsername', config.username);
          saveSetting('smtpPassword', config.password);
          saveSetting('smtpFromName', config.fromName);
          saveSetting('smtpFromEmail', config.fromEmail);
          saveSetting('recipientEmail', config.recipientEmail);
          broadcast('email-settings-saved', 'Email settings saved.');
          broadcast('system-status-update', { alertingStatus: getAlertingStatusText() });
      });

      ipcMain.on('send-test-email', async (event, config) => {
          try {
              const transporter = nodemailer.createTransport({
                  host: config.server,
                  port: config.port,
                  secure: config.port == 465,
                  auth: { user: config.username, pass: config.password },
              });
              await transporter.sendMail({
                  from: `"${config.fromName}" <${config.fromEmail}>`,
                  to: config.to,
                  subject: "Monnit Utility - Test Email",
                  text: "This is a test email from the Monnit MODBUS TCP Utility. If you are reading this, your email configuration is correct.",
              });
              broadcast('email-test-status', { success: true, message: 'Test email sent successfully.' });
          } catch (error) {
              broadcast('email-test-status', { success: false, message: `Failed: ${error.message}` });
          }
      });

      // FIX: Add event as the first parameter
      ipcMain.on('save-sms-settings', (event, config) => {
          saveSetting('textbeltApiKey', config.apiKey);
          saveSetting('recipientSms', config.recipientSms);
          broadcast('sms-settings-saved', 'SMS settings saved.');
          broadcast('system-status-update', { alertingStatus: getAlertingStatusText() });
      });

      ipcMain.on('send-test-sms', async (event, data) => {
    const apiKey = getSetting('textbeltApiKey');
    if (!apiKey) {
        broadcast('sms-test-status', { success: false, message: 'API Key missing. Save settings first.' });
        return;
    }
    try {
        const payload = new URLSearchParams({
            phone: data.phone,  // Now correctly accessible
            message: 'Monnit Utility Test SMS',
            key: apiKey,
        }).toString();
        await axios.post('https://textbelt.com/text', payload, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        broadcast('sms-test-status', { success: true, message: 'Test SMS sent (check quota).' });
    } catch (error) {
        broadcast('sms-test-status', { success: false, message: `Failed: ${error.message}` });
    }
});

      // FIX: Add event as the first parameter
      ipcMain.on('save-alert-message', (event, message) => {
          saveSetting('alertCustomMessage', message);
          broadcast('alert-message-saved', 'Custom alert message saved.');
      });

      // FIX: Add event as the first parameter
      ipcMain.on('save-alert-config', (event, { sensorId, isEnabled, condition, threshold, dataIndex }) => {
          const current = getAlertConfigBySensorIdStmt.get(sensorId) || {};
          const newIsEnabled = isEnabled !== undefined ? (isEnabled ? 1 : 0) : (current.isEnabled ?? 0);
          const newCondition = condition || current.condition || 'above';
          const newThreshold = threshold !== undefined ? threshold : (current.threshold || 0);
          const newDataIndex = dataIndex !== undefined ? dataIndex : (current.dataIndex ?? 0);

          saveAlertConfigStmt.run(sensorId, newIsEnabled, newCondition, newThreshold, current.lastAlertTimestamp || 0, newDataIndex);

          const alertConfigs = getAlertConfigsStmt.all();
          broadcast('alert-configs-data', alertConfigs);
      });

      // --- FIX: Correct transformation logic for MODBUS TCP Interface activation ---
      ipcMain.on('setup-enable-modbus', async (event, ip) => {
          log('INFO', `[Setup] Attempting to enable MODBUS TCP on gateway at ${ip}`);
          try {
              const params = new URLSearchParams();
              params.append('$$4f06', '1'); // Obfuscated Monnit key for enabling Modbus
              params.append('$$4f00', 'Save Changes'); // Required submit parameter for processing

              await axios.post(`http://${ip}/modbus.htm`, params, {
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  timeout: 10000
              });
              log('INFO', `[Setup] MODBUS enable command accepted.`);
              broadcast('setup-modbus-enabled-success');
          } catch (err) {
              // Reboots sever the connection. If we get a reset/timeout, it likely worked.
              if (err.code === 'ECONNRESET' || err.message.includes('timeout')) {
                  log('INFO', `[Setup] Connection reset during MODBUS enable. Assuming reboot started.`);
                  broadcast('setup-modbus-enabled-success');
              } else {
                  log('ERROR', `[Setup] Failed to enable MODBUS: ${err.message}`);
                  // FIX: Send as object for setup.js compatibility
                  broadcast('setup-modbus-enabled-fail', { message: err.message || "Unknown communication error" });
              }
          }
      });

      ipcMain.on('start-polling', async (event, ip) => {
          log('INFO', '[POLL] start-polling received in Main.');
          const activeGateway = getActiveGatewayStmt.get();
          if (!activeGateway) {
              log('WARN', '[POLL] No active gateway selected in DB.');
              broadcast('no-active-gateway');
              return;
          }

          const sameGatewayPolling =
              isPolling && pollingTargetGatewayId != null && Number(pollingTargetGatewayId) === Number(activeGateway.gatewayId);
          if (sameGatewayPolling) {
              log('INFO', '[POLL] Already polling the current active gateway.');
              broadcast('polling-status', true);
              return;
          }

          // Switching gateways or cold start: tear down any existing poll loop first (fixes stale IP / wrong gateway).
          if (isPolling || pollingTimeoutId) {
              stopPollingAndIdleUpdate('[POLL] Restarting polling for the active gateway.');
          }

          try {
              const details = await getGatewayAllDetails(activeGateway.ip);
              if (details) {
                  saveGatewayToDb(details);
                  const gateways = db.prepare('SELECT * FROM gateway_data ORDER BY isActive DESC, gatewayId ASC').all();
                  broadcast('known-gateways', gateways);
                  if (!details.isModbusActive) {
                      log('WARN', `[POLL] Gateway ${activeGateway.gatewayId} has MODBUS TCP disabled. Blocking start.`);
                      broadcast('modbus-disabled-blocking-start', { ip: activeGateway.ip, gatewayId: activeGateway.gatewayId });
                      return;
                  }
              }
          } catch (e) {
              log('DEBUG', `[POLL] Could not refresh gateway status before start: ${e.message}`);
          }

          log('INFO', `[POLL] Active Gateway found: ID ${activeGateway.gatewayId} at ${activeGateway.ip}. Starting cycle...`);
          isPolling = true;
          pollingTargetGatewayId = activeGateway.gatewayId;
          broadcast('polling-status', true);
          try {
              fullDeviceList = [];
              fullDeviceList = await scrapeGatewayDeviceList(activeGateway.ip);
              startPollingCycle();
          } catch (e) {
              log('ERROR', `[POLL] Discovery scrape failed: ${e.message}`);
              isPolling = false;
              pollingTargetGatewayId = null;
              broadcast('polling-status', false);
          }
      });

      ipcMain.on('stop-polling', () => {
          stopPollingAndIdleUpdate('[POLL] stop-polling received in Main.');
      });

      ipcMain.on('cancel-scan', () => {
          cancelScanRequest = true;
      });

      ipcMain.on('scan-for-gateways', async () => {
    if (isScanning) return;
    isScanning = true;
    cancelScanRequest = false;
    log('INFO', 'Starting network scan for Monnit Gateways...');
    broadcast('scan-status-update', 'Scanning network interfaces...');

    const foundGateways = [];
    const interfaces = os.networkInterfaces();

    // Build list of all IPs to scan
    const allIPs = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                const baseIpStr = iface.address.substring(0, iface.address.lastIndexOf('.'));
                for (let i = 1; i < 255; i++) {
                    allIPs.push(`${baseIpStr}.${i}`);
                }
            }
        }
    }

    const batchSize = 50;

    for (let i = 0; i < allIPs.length; i += batchSize) {
        if (cancelScanRequest) break;

        const batchIPs = allIPs.slice(i, i + batchSize);
        const batchNum = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(allIPs.length / batchSize);

        broadcast('scan-status-update', `Scanning batch ${batchNum}/${totalBatches} (${batchIPs[0]} - ${batchIPs[batchIPs.length-1]})...`);

        // FIXED: Create promises for this batch with proper async/await
        const batchPromises = batchIPs.map(async (ip) => {
            try {
                // FIXED: Properly await the async getGatewayAllDetails function
                const details = await getGatewayAllDetails(ip);
                if (details) {
                    log('INFO', `Found gateway at ${ip}`);
                    return details;
                }
                return null;
            } catch (error) {
                // FIXED: Handle connection pool errors gracefully
                if (error.message.includes('Connection pool is shutting down')) {
                    log('WARN', `[Scan] Connection pool shutting down during scan`);
                }
                return null; // Return null for failed connections
            }
        });

        // FIXED: Use Promise.allSettled to handle individual failures gracefully
        const batchResults = await Promise.allSettled(batchPromises);

        // Filter out null results and add to found gateways
        batchResults.forEach(result => {
            if (result.status === 'fulfilled' && result.value !== null) {
                foundGateways.push(result.value);
                broadcast('scan-status-update', `Found Gateway ID ${result.value.gatewayId} at ${result.value.ip}`);
            }
        });

        // FIXED: Add small delay between batches to prevent connection pool exhaustion
        if (i + batchSize < allIPs.length && !cancelScanRequest) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    isScanning = false;

    if (cancelScanRequest) {
        log('WARN', 'Scan cancelled by user.');
        broadcast('scan-status-update', 'Scan cancelled.');
    } else {
        log('INFO', `Scan complete. Found ${foundGateways.length} gateways.`);
        broadcast('scan-results', foundGateways);
    }
});

      // RESTORED: IPC handler to add multiple gateways at once
      ipcMain.on('add-gateways', (event, gateways) => {
          if (!Array.isArray(gateways)) return;
          try {
              gateways.forEach(g => saveGatewayToDb(g));
              log('INFO', `Successfully added ${gateways.length} gateways from scan.`);
              broadcast('gateways-added-success'); // Confirmation event for setup redirect
              const allGateways = db.prepare('SELECT * FROM gateway_data ORDER BY isActive DESC, gatewayId ASC').all();
              broadcast('known-gateways', allGateways);
          } catch (err) {
              log('ERROR', `Failed to add gateways: ${err.message}`);
          }
      });

      ipcMain.on('setup-complete', () => {
          try {
              const lockPath = path.join(app.getPath('userData'), 'setup.lock');
              fs.writeFileSync(lockPath, 'Setup Completed');
              log('INFO', 'Setup complete. Lock file created.');
              if (mainWindow) {
                  mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));
              }
          } catch (error) {
              log('ERROR', `Failed to complete setup: ${error.message}`);
          }
      });

      ipcMain.on('find-gateway-ip', async (event, ip) => {
          broadcast('gateway-find-result', { success: true, message: `Searching for ${ip}...` });
          const details = await getGatewayAllDetails(ip);
          if (details) {
              saveGatewayToDb(details);
              broadcast('scan-results', [details]);
              broadcast('gateway-find-result', { success: true, message: `Found Gateway ID ${details.gatewayId} at ${ip}` });
              const gateways = db.prepare('SELECT * FROM gateway_data ORDER BY isActive DESC, gatewayId ASC').all();
              broadcast('known-gateways', gateways);
          } else {
              broadcast('gateway-find-result', { success: false, message: `No gateway found at ${ip}` });
          }
      });

      ipcMain.on('get-gateway-setup-details', async (event, ip) => {
           const details = await getGatewayAllDetails(ip);
           if (details) {
               saveGatewayToDb(details);
               broadcast('gateway-setup-details', { success: true, data: details });
           } else {
               broadcast('gateway-setup-details', { success: false, message: "Could not reach gateway." });
           }
      });

      ipcMain.on('refresh-gateway-status', async (event, ip) => {
          try {
              const details = await getGatewayAllDetails(ip);
              if (details) {
                  saveGatewayToDb(details);
              }
          } catch (err) {
              log('DEBUG', `[Refresh] Could not re-fetch gateway at ${ip}: ${err.message}`);
          }
          const gateways = db.prepare('SELECT * FROM gateway_data ORDER BY isActive DESC, gatewayId ASC').all();
          broadcast('known-gateways', gateways);
      });

// --- Gateway Settings Retrieval (FIXED: Automatic Reconnection Loop and UI Mapping) ---
ipcMain.on('gateway-get-settings', async (event, { ip, page }) => {
    // --- 30-Second Cooldown Logic ---
    const lastSaveTime = gatewayCooldowns.get(ip) || 0;
    const timeSinceLastSave = (Date.now() - lastSaveTime) / 1000;

    if (timeSinceLastSave < 30) {
        const waitRemaining = Math.ceil(30 - timeSinceLastSave);
        log('INFO', `[Scraper] Cooldown active for ${ip}. Waiting ${waitRemaining}s before refresh.`);
        broadcast('gateway-reconnecting', { attempt: 0, maxRetries: 30, message: `Applying changes... (${waitRemaining}s)` });

        setTimeout(() => {
            ipcMain.emit('gateway-get-settings', event, { ip, page });
        }, waitRemaining * 1000);
        return;
    }

    log('INFO', `[Scraper] Initiating fetch for page "${page}" at IP: ${ip}`);

    const maxRetries = 30;
    let attempt = 0;

    const fetchPage = async () => {
        try {
            let urlPart = '';
            switch (page) {
                case 'lan': urlPart = 'lan.htm'; break;
                case 'wsn': urlPart = 'wsn.htm'; break;
                case 'server': urlPart = 'server.htm'; break;
                case 'modbus': urlPart = 'modbus.htm'; break;
                case 'snmp': urlPart = 'snmp.htm'; break;
                case 'misc': urlPart = 'misc.htm'; break;
                case 'status': urlPart = 'status.htm'; break;
                default: urlPart = 'index.htm';
            }

            const url = `http://${ip}/${urlPart}`;
            const response = await axios.get(url, { timeout: 3000 });
            const $ = cheerio.load(response.data);

            if (page === 'status') {
                const data = {
                    lan: {},
                    services: {},
                    wireless: { devices: [] },
                    firmware: ''
                };

                const getText = (label) => {
                    let val = '';
                    $('td').each((i, el) => {
                        if ($(el).text().trim() === label)
                            val = $(el).next('td').text().trim();
                    });
                    return val;
                };

                data.lan.physicalAddress = getText('Physical Address');
                data.lan.ipAddress = getText('IP Address');
                data.lan.subnetMask = getText('Subnet Mask');
                data.lan.defaultGateway = getText('Default Gateway');
                data.lan.dnsServer = getText('DNS Server');
                data.services.defaultServer = 'Unknown';

                $('td#o').each((i, el) => {
                    if ($(el).text().trim() === 'Default Server')
                        data.services.defaultServer = $(el).next('td#i').text().trim();
                });

                data.services.sntp = getText('SNTP');
                data.services.modbusTcp = getText('Modbus TCP');
                data.services.snmp = getText('SNMP');

                $('#cts > div:nth-child(2) table tr').each((i, row) => {
                    const label = $(row).find('td').first().text().trim();
                    const val = $(row).find('td').last().text().trim();
                    if (label.includes('Data cache used'))
                        data.wireless.dataCacheUsed = val;
                    if (label.includes('Total wireless devices'))
                        data.wireless.totalWirelessDevices = val;
                });

                $('td').each((i, el) => {
                    if ($(el).text().trim().includes('Firmware Version:'))
                        data.firmware = $(el).text().replace('Firmware Version:', '').trim();
                });

                $('#cts > div:nth-child(3) table#t tr').slice(1).each((i, el) => {
                    data.wireless.devices.push({
                        slot: $(el).find('td').eq(0).text().trim(),
                        deviceId: $(el).find('td').eq(1).text().trim()
                    });
                });

                broadcast('gateway-status-data', { success: true, data });
            } else {
                const settings = {};
                const foundInputs = [];

                // 1. Capture checked radios first
                const radioGroups = {};
                $('input[type="radio"]:checked').each((i, el) => {
                    const name = $(el).attr('name');
                    const value = $(el).val();
                    if (name) {
                        radioGroups[name] = value;
                        settings[name] = value;
                        foundInputs.push({ name, type: 'radio', value, source: 'checked' });
                    }
                });

                // 2. Capture other inputs
                $('input, select, textarea').each((i, el) => {
                    const name = $(el).attr('name');
                    const id = $(el).attr('id');
                    const type = $(el).attr('type');
                    const tagName = $(el).get(0).tagName.toLowerCase();

                    if (name && !settings[name]) {
                        let value = $(el).val();

                        if (tagName === 'select') {
                            const selectedOpt = $(el).find('option:selected');
                            value = selectedOpt.attr('value') !== undefined ? selectedOpt.attr('value') : selectedOpt.text().trim();
                        }
                        if (type === 'checkbox') value = $(el).is(':checked') ? '1' : '0';

                        settings[name] = value;
                        foundInputs.push({ name, id: id || 'N/A', tagName, type: type || 'N/A', value });
                    }
                });

                // 3. Special-case HTTP Interface radios
                if (!settings['a'] || settings['a'] === '') {
                    const httpEnable = $('#httpe').is(':checked');
                    const httpDisable = $('#nhttpe').is(':checked');
                    if (httpEnable) settings['a'] = '1';
                    if (httpDisable) settings['a'] = '0';
                }

                // 4. Ensure timeout dropdown is captured
                const cpSelect = $('#cp');
                if (cpSelect.length) settings['$$1219'] = cpSelect.val();

                // 5. Reverse time mapping (seconds → minutes)
                if (page === 'modbus' && settings['$$124a']) settings['$$124a'] = (parseFloat(settings['$$124a']) / 60).toString();
                if (page === 'misc' && settings['$$1219']) settings['$$1219'] = (parseFloat(settings['$$1219']) / 60).toString();
                if (page === 'server' && settings['$$113f']) settings['$$113f'] = (parseFloat(settings['$$113f']) / 60).toString();

                console.log(`[Scraper:SUMMARY] Page "${page}" loaded. Found ${Object.keys(settings).length} settings.`);
                console.table(foundInputs);

                if (page === 'lan') {
                    console.log('[Scraper:HTTP] HTTP Interface settings:', {
                        'a': settings['a'],
                        '$$1219': settings['$$1219'],
                        httpEnableChecked: $('#httpe').is(':checked'),
                        httpDisableChecked: $('#nhttpe').is(':checked')
                    });
                }

                /* ---------- LAN page specials ---------- */
                if (page === 'lan') {
                    // Configuration Timeout dropdown – gateway sets it via ld() on load
                    const cpSel = $('#cp')[0];
                    if (cpSel) {
                        let c = '65535';                       // gateway default
                        const m = response.data.match(/var\s+c\s*=\s*"(\d+)";/);
                        if (m) c = m[1];                       // value injected by ld()
                        settings['$$1219'] = c;
                        console.log('[Scraper:LAN] Configuration Timeout resolved to', c);
                    }
                }

                /* ---------- SERVER page specials ---------- */
if (page === 'server') {
    // Default Server toggle (name="o" ids: dse / ndse)
    if (!settings['o'] || settings['o'] === '') {
        const dsEnable = $('#dse').is(':checked');
        const dsDisable = $('#ndse').is(':checked');
        if (dsEnable) settings['o'] = '1';
        if (dsDisable) settings['o'] = '0';
    }
    // Heartbeat minutes → seconds (from settings object first)
    if (settings['$$113f']) {
        settings['$$113f'] = (parseFloat(settings['$$113f']) / 60).toString();
    }
    // Heartbeat – gateway stores seconds, HTML shows minutes
    // FIX: Use Cheerio's attr() method instead of getAttribute()
    const hbmInput = $('#hbm');
    if (hbmInput.length > 0) {
        const seconds = hbmInput.attr('value') || hbmInput.val() || hbmInput.text();
        if (seconds && !isNaN(parseFloat(seconds))) {
            settings['$$113f'] = (parseFloat(seconds) / 60).toString();
        }
    }
}

/* ---------- MODBUS page specials ---------- */
if (page === 'modbus') {
    // Modbus TCP Interface (name="o" ids: modbe / nmodbe)
    if (!settings['o'] || settings['o'] === '') {
        const modbusEnable = $('#modbe').is(':checked');
        const modbusDisable = $('#nmodbe').is(':checked');
        if (modbusEnable) settings['o'] = '1';
        if (modbusDisable) settings['o'] = '0';
    }
    // TCP Timeout – gateway stores seconds, HTML shows minutes
    // FIX: Use Cheerio's attr() method
    const ttmInput = $('#ttm');
    if (ttmInput.length > 0) {
        const seconds = ttmInput.attr('value') || ttmInput.val() || ttmInput.text();
        if (seconds && !isNaN(parseFloat(seconds))) {
            settings['$$124a'] = (parseFloat(seconds) / 60).toString();
        }
    }
}

/* ---------- MISC page specials ---------- */
if (page === 'misc') {
    // SNTP Interface (name="b" ids: sntpe / nsntpe)
    if (!settings['b'] || settings['b'] === '') {
        const sntpEnable = $('#sntpe').is(':checked');
        const sntpDisable = $('#nsntpe').is(':checked');
        if (sntpEnable) settings['b'] = '1';
        if (sntpDisable) settings['b'] = '0';
    }
    // SNTP Update Interval – gateway stores seconds, HTML shows minutes
    // FIX: Use Cheerio's attr() method
    const uimInput = $('#uim');
    if (uimInput.length > 0) {
        const seconds = uimInput.attr('value') || uimInput.val() || uimInput.text();
        if (seconds && !isNaN(parseFloat(seconds))) {
            settings['$$1237'] = (parseFloat(seconds) / 60).toString();
        }
    }
}

                /* ---------- SNMP page specials ---------- */
                if (page === 'snmp') {
                    // SNMP Interface (name="o" ids: snmpe / nsnmpe)
                    if (!settings['o'] || settings['o'] === '') {
                        const snmpEnable = $('#snmpe').is(':checked');
                        const snmpDisable = $('#nsnmpe').is(':checked');
                        if (snmpEnable) settings['o'] = '1';
                        if (snmpDisable) settings['o'] = '0';
                    }
                    // Trap master switch
                    const trapSel = $('#ca')[0];
                    if (trapSel) settings['$$1356'] = trapSel.value;

                    // Pre-fill the four hidden trap sub-selects so they are not lost
                    ['cb', 'cc', 'cd'].forEach(id => {
                        const sel = $(`#${id}`)[0];
                        if (sel) settings[sel.name] = sel.value;
                    });
                    // Trap-Interface toggle (name="$$1355" values 1/0)
                    const trapSelect = $('#ca');
                    if (trapSelect.length) settings['$$1355'] = trapSelect.val(); // 0=Disable 1=Enable
                }

                broadcast('gateway-settings-data', { success: true, page, settings });
            }
        } catch (err) {
            if (attempt < maxRetries) {
                attempt++;
                log('INFO', `[Scraper] Gateway at ${ip} unreachable (attempt ${attempt}/${maxRetries}). Retrying...`);
                broadcast('gateway-reconnecting', { attempt, maxRetries, message: "Gateway rebooting... Reconnecting." });
                setTimeout(fetchPage, 2000);
            } else {
                log('ERROR', `[Scraper] Permanent fetch failure for ${page}: ${err.message}`);
                broadcast('gateway-settings-data', { success: false, message: "Gateway timed out after 60 seconds." });
            }
        }
    };
    fetchPage();
});

      // --- Gateway Settings Save (FIXED: Replicates Monnit dynamic attribute renaming and Time conversion) ---
ipcMain.on('gateway-save-settings', async (event, { ip, page, formData }) => {
    log('INFO', `[Poster] Saving page "${page}" for IP: ${ip}`);

    // Check if this is a sensor operation (add/remove device)
    const isSensorOperation = page === 'wsn' && (formData['$$2120'] || formData['remove-device-id']);

    if (isSensorOperation) {
        log('INFO', `[Poster] Sensor operation detected on WSN page, applying without reboot.`);
    }

    try {
        let urlPart = '';
        switch(page) {
            case 'lan': urlPart = 'lan.htm'; break;
            case 'wsn': urlPart = 'wsn.htm'; break;
            case 'server': urlPart = 'server.htm'; break;
            case 'modbus': urlPart = 'modbus.htm'; break;
            case 'snmp': urlPart = 'snmp.htm'; break;
            case 'misc': urlPart = 'misc.htm'; break;
            default: throw new Error("Invalid page for save");
        }

        const params = new URLSearchParams();
        const payloadLog = [];

        // --- Monnit dynamic parameter transformation ---
        for (const key in formData) {
            let finalKey = key;
            let value = formData[key];

            // Handle "Interface" Toggle transformations (o/a -> $$4fXX)
            if (key === 'o' || key === 'a' || key === 'sntpe' || key === 'snmpe' || key === '$$1355') {
                // Modbus TCP
                if (page === 'modbus' && key === 'o') {
                    finalKey = (value === '1' ? '$$4f06' : '$$4f05');
                }
                // LAN / HTTP
                if (page === 'lan' && key === 'a') {
                    finalKey = (value === '1' ? '$$4f0c' : '$$4f0b');
                }
                // Misc / SNTP
                if (page === 'misc' && key === 'o') {
                    finalKey = (value === '1' ? '$$4f0a' : '$$4f09');
                }
                // SNMP Interface Toggle
                if (page === 'snmp' && key === 'o') {
                    finalKey = (value === '1' ? '$$4f0e' : '$$4f0d');
                }
                // SNMP Trap Interface Toggle
                if (page === 'snmp' && key === '$$1355') {
                    finalKey = (value === '1' ? '$$4f10' : '$$4f0f');
                }
                // Default Server Toggle
                if (page === 'server' && key === 'o') {
                    finalKey = (value === '1' ? '$$4f08' : '$$4f07');
                }
            }

            // Save Time Conversion (Minutes -> Seconds)
            if (page === 'modbus' && key === '$$124a') {
                value = Math.round(parseFloat(value) * 60); // Min to Sec
            }
            if (page === 'misc' && key === '$$1219') {
                value = Math.round(parseFloat(value) * 60); // Min to Sec
            }
            if (page === 'server' && key === '$$113f') {
                value = Math.round(parseFloat(value) * 60); // Min to Sec
            }

            params.append(finalKey, value);
            payloadLog.push({ original: key, transformed: finalKey, value: value });
        }

        // Monnit gateways require the Submit button value to actually process configuration changes.
        if (!params.has('$$4f00')) {
            const submitText = formData['$$4f00'] || 'Save Changes';
            params.append('$$4f00', submitText);
            payloadLog.push({ original: 'None', transformed: '$$4f00', value: submitText });
        }

        console.log(`[Poster:PAYLOAD] Transforming parameter names...`);
        console.table(payloadLog);

        await axios.post(`http://${ip}/${urlPart}`, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: isSensorOperation ? 15000 : 10000  // Longer timeout for sensor ops
        });

        // For sensor operations, don't show reboot modal
        if (isSensorOperation) {
            gatewayCooldowns.set(ip, Date.now());
            const successMessage = formData['$$2120'] ? 'SUCCESS: Device Added' : 'SUCCESS: Device Removed';
            broadcast('gateway-save-status', { success: true, message: successMessage });
            return; // Exit early, skip reboot logic
        }

        // Success: Set cooldown to block scraper interference while rebooting
        gatewayCooldowns.set(ip, Date.now());
        log('INFO', `[Poster] Save complete. 30s Cooldown started for ${ip}.`);
        broadcast('gateway-save-status', { success: true });

    } catch (err) {
        // Handle errors with special case for sensor operations
        if (isSensorOperation && (err.code === 'ECONNRESET' || err.message.includes('timeout'))) {
            // For sensor operations, connection reset might be normal
            gatewayCooldowns.set(ip, Date.now());
            const successMessage = formData['$$2120'] ? 'SUCCESS: Device Added' : 'SUCCESS: Device Removed';
            broadcast('gateway-save-status', { success: true, message: successMessage });
            return;
        }

        // Reboots sever the connection. Treat as success if it resets/timeouts.
        if (err.code === 'ECONNRESET' || err.message.includes('timeout')) {
            gatewayCooldowns.set(ip, Date.now());
            log('INFO', `[Poster] Gateway rebooting to apply changes. Reconnection loop starting.`);
            broadcast('gateway-save-status', { success: true, rebooting: true });
        } else {
            log('ERROR', `[Poster] Save failed: ${err.message}`);
            broadcast('gateway-save-status', { success: false, message: err.message });
        }
    }
});

      ipcMain.on('gateway-reboot', async (event, { ip }) => {
          try {
              await axios.post(`http://${ip}/boot.htm`, {}, { timeout: 5000 });
              broadcast('gateway-reboot-status', { success: true, ip });
          } catch (err) {
              if (err.code === 'ECONNRESET' || err.message.includes('timeout')) {
                   broadcast('gateway-reboot-status', { success: true, ip });
              } else {
                   broadcast('gateway-reboot-status', { success: false, message: err.message });
              }
          }
      });

      // FIXED: Use connection pool for modbus register reads
      ipcMain.on('get-modbus-registers', async (event, { ip, start, count }) => {
          const addr = ip && String(ip).trim();
          if (!addr) {
              broadcast('modbus-register-data', {
                  success: false,
                  message: 'No gateway IP provided. Select an active gateway or start polling.'
              });
              return;
          }
          try {
              const connection = await connectionPool.getConnection(addr);

              const resp = await connection.client.readHoldingRegisters(start, count);

              // Release connection back to pool
              connectionPool.releaseConnection(addr);

              broadcast('modbus-register-data', {
                  success: true,
                  registers: resp.response.body.values,
                  start: start
              });
          } catch (error) {
              // Release connection even on error
              connectionPool.releaseConnection(addr);

              broadcast('modbus-register-data', {
                  success: false,
                  message: error.message
              });
          }
      });

      ipcMain.on('set-active-gateway', async (event, gatewayId, autoStart) => {
          try {
              deactivateAllGatewaysStmt.run();
              if (gatewayId) {
                  activateGatewayStmt.run(gatewayId);
              }
              const activeGateway = getActiveGatewayStmt.get();

              // If Modbus polling no longer matches DB active gateway (switch or cleared), stop immediately.
              if (
                  isPolling &&
                  (!activeGateway ||
                      pollingTargetGatewayId == null ||
                      Number(activeGateway.gatewayId) !== Number(pollingTargetGatewayId))
              ) {
                  stopPollingAndIdleUpdate('[POLL] Active gateway changed — stopping previous poll loop.');
              }

              if (!activeGateway) {
                  const gateways = db.prepare('SELECT * FROM gateway_data ORDER BY isActive DESC, gatewayId ASC').all();
                  broadcast('known-gateways', gateways);
                  broadcast('active-gateway-applied');
                  return;
              }

              let willRequestPollStart = false;
              if (autoStart === true || autoStart === 'true') {
                  try {
                      const details = await getGatewayAllDetails(activeGateway.ip);
                      if (details) {
                          saveGatewayToDb(details);
                          if (!details.isModbusActive) {
                              const gateways = db.prepare('SELECT * FROM gateway_data ORDER BY isActive DESC, gatewayId ASC').all();
                              broadcast('known-gateways', gateways);
                              broadcast('modbus-disabled-blocking-start', { ip: activeGateway.ip, gatewayId: activeGateway.gatewayId });
                              broadcast('active-gateway-applied');
                              return;
                          }
                      }
                  } catch (e) {
                      log('DEBUG', `[SetActive] Could not refresh gateway status: ${e.message}`);
                  }
                  broadcast('request-poll-start');
                  willRequestPollStart = true;
              }
              const gateways = db.prepare('SELECT * FROM gateway_data ORDER BY isActive DESC, gatewayId ASC').all();
              broadcast('known-gateways', gateways);
              // Do not signal "applied" yet if a poll start follows — renderer clears busy on polling-status.
              if (!willRequestPollStart) {
                  broadcast('active-gateway-applied');
              }
          } catch (err) {
              broadcast('set-active-failed', { message: err.message });
              broadcast('active-gateway-applied');
          }
      });

      ipcMain.on('save-sensor-metadata', (event, { sensorId, customName, colorGroup }) => {
          try {
              const current = getSensorMetadataStmt.get(sensorId) || {};
              const newName = customName !== undefined ? customName : current.customName;
              const newGroup = colorGroup !== undefined ? colorGroup : current.colorGroup;
              saveSensorMetadataStmt.run(sensorId, newName, newGroup);
              broadcast('sensor-metadata-updated', { sensorId, customName: newName, colorGroup: newGroup });
          } catch (e) {
              log('ERROR', `Failed to save sensor metadata: ${e.message}`);
          }
      });

      ipcMain.on('save-external-device-metadata', (event, { deviceId, customName, colorGroup }) => {
          try {
               const current = db.prepare('SELECT customName, colorGroup FROM external_device_metadata WHERE id = ?').get(deviceId) || {};
               const newName = customName !== undefined ? customName : current.customName;
               const newGroup = colorGroup !== undefined ? colorGroup : current.colorGroup;

              saveExternalMetadataStmt.run(deviceId, newName, newGroup);
              broadcast('external-metadata-updated', { deviceId, customName: newName, colorGroup: newGroup });

              const devices = db.prepare('SELECT * FROM external_devices ORDER BY lastSeen DESC').all();
              const filtered = filterExternalDevicesByPluginState(devices);
              lastExternalDevicesStr = JSON.stringify(filtered);
              broadcast('external-devices-data', filtered);

          } catch (e) {
              log('ERROR', `Failed to save external metadata: ${e.message}`);
          }
      });

      ipcMain.on('get-device-history', (event, { deviceId, isGateway }) => {
          try {
              if (isGateway) {
                  const records = db.prepare('SELECT * FROM sensor_data WHERE gatewayId = ? ORDER BY timestamp DESC LIMIT 100').all(deviceId);
                  broadcast('device-history-data', { deviceId, isGateway: true, records });
              } else {
                  const maxRecords = parseInt(getSetting('maxRecords', '5000'), 10) || 5000;
                  const records = db.prepare('SELECT * FROM sensor_data WHERE sensorId = ? ORDER BY timestamp DESC LIMIT ?').all(deviceId, maxRecords);
                  broadcast('device-history-data', { deviceId, isGateway: false, records });
              }
          } catch (err) {
               log('ERROR', `Failed to get device history: ${err.message}`);
               broadcast('device-history-data', { deviceId, records: [] });
          }
      });

      ipcMain.on('get-external-device-history', (event, deviceId) => {
          try {
              const maxRecords = parseInt(getSetting('maxRecords', '5000'), 10) || 5000;
              const records = db.prepare('SELECT * FROM external_device_history WHERE deviceId = ? ORDER BY timestamp DESC LIMIT ?').all(deviceId, maxRecords);
              broadcast('external-device-history-data', { deviceId, records });
          } catch (err) {
               log('ERROR', `Failed to get external history: ${err.message}`);
               broadcast('external-device-history-data', { deviceId, records: [] });
          }
      });

      const pluginConfigMap = {
          'save-webhooks-config': 'webhooks',
          'save-mqtt-config': 'mqtt',
          'save-bacnet-config': 'bacnet',
          'save-snmptrap-config': 'snmptrap',
          'save-mqttsub-config': 'mqtt_subscriber',
          'save-bacnetsub-config': 'bacnet_subscriber',
          'save-lorawan-config': 'lorawan',
          'save-mbpoller-config': 'modbus_poller'
      };

      const externalDevicePlugins = new Set(['mqtt_subscriber', 'snmptrap', 'lorawan', 'bacnet_subscriber', 'modbus_poller']);

      Object.keys(pluginConfigMap).forEach(channel => {
          ipcMain.on(channel, async (event, config) => {
              try {
                  const pluginId = pluginConfigMap[channel];
                  await pluginManager.updatePluginConfig(pluginId, config);
                  broadcast('save-status', { plugin: pluginId, msg: 'Saved.' });
                  if (externalDevicePlugins.has(pluginId)) {
                      fetchAndBroadcastExternalDevices();
                  }
              } catch (err) {
                  log('ERROR', `Failed to save config for ${channel}: ${err.message}`);
              }
          });
      });

      ipcMain.on('get-plugin-configs', async () => {
          const plugins = [
              'webhooks', 'mqtt', 'bacnet', 'snmptrap',
              'mqtt_subscriber', 'bacnet_subscriber', 'lorawan', 'modbus_poller'
          ];

          for (const pluginId of plugins) {
              try {
                  const config = await pluginManager.getPluginConfig(pluginId);
                  let channel = '';
                  switch(pluginId) {
                      case 'webhooks': channel = 'webhooks-config'; break;
                      case 'mqtt': channel = 'mqtt-config'; break;
                      case 'bacnet': channel = 'bacnet-config'; break;
                      case 'snmptrap': channel = 'snmptrap-config'; break;
                      case 'mqtt_subscriber': channel = 'mqttsub-config'; break;
                      case 'bacnet_subscriber': channel = 'bacnetsub-config'; break;
                      case 'lorawan': channel = 'lorawan-config'; break;
                      case 'modbus_poller': channel = 'mbpoller-config'; break;
                  }
                  if (channel) broadcast(channel, config);
              } catch (e) {}
          }

          if (pluginManager.broadcastStatus) {
               pluginManager.broadcastStatus();
          }
      });

      startExternalDeviceLoop();
  };

  // --- Open Help Documentation Handler ---
  ipcMain.on('open-help-docs', async () => {
      // IPC call delegates to our helper function
      await openDocumentation();
  });

ipcMain.on('save-csv-file', async (event, { content, defaultName }) => {
    try {
        // FIXED: Use 'downloads' (plural) not 'download'
        const downloadPath = app.getPath('downloads');
        console.log(`[CSV Export] Using downloads path: ${downloadPath}`);

        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            defaultPath: path.join(downloadPath, defaultName),
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        });

        if (filePath) {
            fs.writeFileSync(filePath, content);
            // Return just the filename for security and clean UI
            const fileName = path.basename(filePath);
            broadcast('save-csv-response', { success: true, fileName });
        }
    } catch (error) {
        console.error(`[CSV Export] Error: ${error.message}`);
        broadcast('save-csv-response', { success: false, message: error.message });
    }
});

  app.whenReady().then(() => {
      createWindow();
      app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  // FIXED: Add graceful shutdown for connection pool
  app.on('before-quit', async (event) => {
      if (externalDeviceIntervalId) {
          clearInterval(externalDeviceIntervalId);
          externalDeviceIntervalId = null;
      }
      if (connectionPool && !connectionPool.isShuttingDown) {
          event.preventDefault();
          isQuitting = true;

          log('INFO', 'Shutting down connection pool...');
          await connectionPool.shutdown();

          app.quit();
      }
  });

  app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
          db.close();
          app.quit();
      }
  });
}