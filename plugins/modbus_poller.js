// plugins/modbus_poller.js
import jsmodbus from 'jsmodbus';
import { Socket } from 'net';

/**
 * MODBUS Poller (Receive) Plugin
 * * Actively polls a target MODBUS TCP device.
 * * Ingests the read registers as an "External Device".
 */
class ModbusPollerPlugin {
    constructor() {
        this.name = 'modbus_poller';
        this.config = {};
        this.deps = null;
        this.logs = [];
        this.maxLogs = 100;
        this.pollInterval = null;
    }

    /**
     * Initializes the plugin.
     */
    async init(pluginDeps) {
        this.deps = pluginDeps;
        this.deps.pluginLog('MODBUS Poller', 'Initializing...');
        this.config = await this.getConfig();
        
        const initialState = { ...this.config, enabled: this.config.enabled, status: 'Disabled' };
        this.deps.updatePluginState(this.name, initialState);

        if (this.config.enabled) {
            this.startPolling();
        }
    }

    /**
     * Retrieves configuration from the database.
     */
    async getConfig() {
        const config = {
            enabled: await this.deps.getSetting('mbPollerEnabled', 'false') === 'true',
            ip: await this.deps.getSetting('mbPollerIp', ''),
            port: parseInt(await this.deps.getSetting('mbPollerPort', '502'), 10),
            unitId: parseInt(await this.deps.getSetting('mbPollerUnitId', '1'), 10),
            startRegister: parseInt(await this.deps.getSetting('mbPollerStartReg', '0'), 10),
            count: parseInt(await this.deps.getSetting('mbPollerCount', '10'), 10),
            interval: parseInt(await this.deps.getSetting('mbPollerInterval', '60'), 10), // Seconds
        };
        // Validate config
        config.enabled = config.enabled && !!config.ip && config.count > 0 && config.interval >= 5;
        return config;
    }

    /**
     * Saves configuration to the database.
     */
    async saveConfig(config) {
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mbPollerEnabled', config.enabled.toString());
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mbPollerIp', config.ip);
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mbPollerPort', config.port.toString());
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mbPollerUnitId', config.unitId.toString());
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mbPollerStartReg', config.startRegister.toString());
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mbPollerCount', config.count.toString());
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mbPollerInterval', config.interval.toString());

        this.config = await this.getConfig();
        this.addLog(`Configuration saved. Enabled: ${this.config.enabled}`);

        this.stopPolling();
        if (this.config.enabled) {
            this.startPolling();
        }
    }

    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
            this.deps.updatePluginState(this.name, { status: 'Disabled' });
        }
    }

    startPolling() {
        this.stopPolling();
        
        if (!this.config.enabled) {
             this.deps.updatePluginState(this.name, { status: 'Disabled' });
             return;
        }

        this.addLog(`Starting polling for ${this.config.ip} every ${this.config.interval}s`);
        this.deps.updatePluginState(this.name, { enabled: true, status: 'Polling', statusColor: 'var(--success-accent)' });
        
        // Initial poll
        this.pollDevice();

        // Start interval
        this.pollInterval = setInterval(() => {
            this.pollDevice();
        }, this.config.interval * 1000);
    }

    pollDevice() {
        const socket = new Socket();
        const client = new jsmodbus.client.TCP(socket, this.config.unitId);
        const options = {
            host: this.config.ip,
            port: this.config.port,
            timeout: 5000
        };

        socket.on('connect', () => {
            client.readHoldingRegisters(this.config.startRegister, this.config.count)
                .then(async (resp) => {
                    const values = resp.response.body.values;
                    await this.saveData(values);
                    socket.end();
                })
                .catch((err) => {
                    this.addLog(`Read Error: ${err.message}`, 'ERROR');
                    this.deps.updatePluginState(this.name, { status: `Read Error: ${err.message}`, statusColor: 'var(--danger-accent)' });
                    socket.end();
                });
        });

        socket.on('error', (err) => {
            this.addLog(`Connection Error: ${err.message}`, 'ERROR');
             this.deps.updatePluginState(this.name, { status: `Conn Error: ${err.message}`, statusColor: 'var(--danger-accent)' });
        });

        socket.on('timeout', () => {
             this.addLog(`Connection Timed Out`, 'WARN');
             socket.end();
        });

        socket.connect(options);
    }

    async saveData(values) {
        const deviceId = `modbus-${this.config.ip}-${this.config.unitId}`;
        const deviceName = `MODBUS Device (${this.config.ip})`;
        const timestamp = Math.floor(Date.now() / 1000);

        // Convert array of values to a simple object map "Register X": Value
        const payload = {};
        values.forEach((val, idx) => {
            payload[`Register ${this.config.startRegister + idx}`] = val;
        });

        const lastData = {
            ip: this.config.ip,
            unitId: this.config.unitId,
            payload: payload
        };
        
        const lastDataString = JSON.stringify(lastData, null, 2);

        try {
            await this.deps.db.run(
                `INSERT OR REPLACE INTO external_devices (id, type, name, lastData, lastSeen, isAware)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                deviceId,
                'MODBUS Poller',
                deviceName,
                lastDataString,
                timestamp,
                0
            );

            await this.deps.db.run(
                `INSERT INTO external_device_history (deviceId, timestamp, data)
                 VALUES (?, ?, ?)`,
                deviceId,
                timestamp,
                lastDataString
            );
            if (this.deps.notifyExternalHistoryUpdate) this.deps.notifyExternalHistoryUpdate(deviceId);

             await this.deps.db.run(
                `INSERT OR IGNORE INTO external_device_metadata (id, customName, colorGroup)
                 VALUES (?, ?, ?)`,
                deviceId,
                deviceName, 
                null
            );

            this.addLog(`Polled ${values.length} registers from ${this.config.ip}`);
            // Restore "Polling" status if it was in error
            this.deps.updatePluginState(this.name, { status: 'Polling', statusColor: 'var(--success-accent)' });
            
        } catch (error) {
            this.addLog(`DB Save Error: ${error.message}`, 'ERROR');
        }
    }

    addLog(message, level = 'INFO') {
        const logEntry = { ts: Date.now(), msg: `[${level}] ${message}` };
        
        // FIX: Use push/shift to maintain chronological order for the frontend prepend-loop
        this.logs.push(logEntry);
        
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        const socket = this.deps.io();
        if (socket) {
            socket.emit('mbpoller-log', this.logs);
        }
    }

    getLogs() {
        return this.logs;
    }
}

export const modbusPollerPlugin = new ModbusPollerPlugin();