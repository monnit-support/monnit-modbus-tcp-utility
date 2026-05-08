// plugins/webhook.js
import axios from 'axios';

/**
 * Webhook (Broadcast) Plugin
 * * Pushes sensor data and alerts to a user-defined HTTP endpoint.
 */
class WebhookPlugin {
    constructor() {
        this.name = 'webhooks';
        this.config = {};
        this.deps = null;
        this.logs = []; // <-- FIX: Added log array
        this.maxLogs = 100; // Max logs to keep in memory
    }

    /**
     * Initializes the plugin, loading its configuration.
     * @param {object} pluginDeps - Dependencies injected by PluginManager.
     */
    async init(pluginDeps) {
        this.deps = pluginDeps;
        this.deps.pluginLog('Webhooks', 'Initializing Webhook plugin...');
        this.config = await this.getConfig();
        this.deps.updatePluginState(this.name, {
            ...this.config,
            enabled: this.config.enabled,
            status: this.config.enabled ? 'Active' : 'Disabled'
        });
    }

    /**
     * Retrieves the current configuration from the database.
     * @returns {object} The saved configuration.
     */
    async getConfig() {
        const config = {
            enabled: await this.deps.getSetting('whEnabled', 'false') === 'true',
            baseUrl: await this.deps.getSetting('whBaseUrl', ''),
            auth: await this.deps.getSetting('whAuth', 'false') === 'true',
            username: await this.deps.getSetting('whUsername', ''),
            password: await this.deps.getSetting('whPassword', ''),
        };
        config.enabled = config.enabled && !!config.baseUrl; // Must have a URL to be enabled
        return config;
    }

    /**
     * Saves the configuration to the database.
     * @param {object} config - The new configuration to save.
     */
    async saveConfig(config) {
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'whEnabled', config.enabled.toString());
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'whBaseUrl', config.baseUrl);
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'whAuth', config.auth.toString());
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'whUsername', config.username);
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'whPassword', config.password);
        
        // Update local config
        this.config = config;
        this.config.enabled = config.enabled && !!config.baseUrl;

        // FIX: Add a log entry for saving
        this.addLog(`Configuration saved. Enabled: ${this.config.enabled}`);
        
        // Update the global plugin state
        this.deps.updatePluginState(this.name, { 
            ...this.config, 
            status: this.config.enabled ? 'Active' : 'Disabled',
            statusColor: 'inherit'
        });
    }

    /**
     * Broadcasts sensor data.
     * @param {Array<object>} sensors - Array of sensor data.
     * @param {object} gateway - Gateway information.
     */
    async broadcast(sensors, gateway) {
        if (!this.config.enabled || !this.config.baseUrl) {
            return;
        }

        const payload = {
            type: 'data',
            timestamp: new Date().toISOString(),
            gateway: gateway,
            sensors: sensors
        };

        await this.send(payload);
    }

    /**
     * Broadcasts an alert.
     * @param {string} alertMessage - The formatted alert message.
     * @param {object} sensorReading - The sensor reading that triggered the alert.
     */
    async broadcastAlert(alertMessage, sensorReading) {
        if (!this.config.enabled || !this.config.baseUrl) {
            return;
        }
        
        const payload = {
            type: 'alert',
            timestamp: new Date().toISOString(),
            message: alertMessage,
            sensor: sensorReading
        };

        await this.send(payload);
    }

    /**
     * Helper function to send the payload to the configured endpoint.
     * @param {object} payload - The data to send.
     */
    async send(payload) {
        const options = {
            timeout: 10000, // 10 second timeout
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'MonnitModbusUtility/1.0'
            }
        };

        if (this.config.auth && this.config.username) {
            options.auth = {
                username: this.config.username,
                password: this.config.password
            };
        }

        try {
            const response = await axios.post(this.config.baseUrl, payload, options);
            if (response.status >= 200 && response.status < 300) {
                const msg = `Successfully sent ${payload.type} payload to ${this.config.baseUrl}`;
                this.deps.pluginLog('Webhooks', msg);
                this.addLog(msg); // FIX: Add to internal log
            } else {
                throw new Error(`Received non-success status code: ${response.status}`);
            }
        } catch (error) {
            const msg = `Failed to send payload: ${error.message}`;
            this.deps.pluginLog('Webhooks', msg, 'ERROR');
            this.addLog(msg); // FIX: Add to internal log
            
            // Update status on failure
            this.deps.updatePluginState(this.name, { status: `Error: ${error.message}`, statusColor: 'var(--danger-accent)' });
            throw error; // Re-throw so manager can see it
        }
    }

    // --- FIX: New functions to manage the internal log ---

    /**
     * Adds a new message to the internal log array.
     * @param {string} message - The log message.
     */
    addLog(message) {
        const logEntry = {
            ts: Date.now(),
            msg: message
        };
        
        // FIX: Use push/shift to maintain chronological order for the frontend prepend-loop
        this.logs.push(logEntry);
        
        // Trim the log if it gets too long
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        // Push the new log to connected clients
        const socket = this.deps.io();
        if (socket) {
            socket.emit('webhook-log', this.logs);
        }
    }

    /**
     * Returns the current internal log array.
     * @returns {Array<object>}
     */
    getLogs() {
        return this.logs;
    }
}

// Export a single instance
export const webhookPlugin = new WebhookPlugin();