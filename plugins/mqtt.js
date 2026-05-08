// plugins/mqtt.js
import mqtt from 'mqtt';

/**
 * MQTT (Broadcast) Plugin
 * * Pushes sensor data and alerts to a user-defined MQTT broker.
 */
class MqttPlugin {
    constructor() {
        this.name = 'mqtt';
        this.config = {};
        this.deps = null;
        this.client = null;
        this.logs = [];
        this.maxLogs = 100;
    }

    /**
     * Initializes the plugin, loading its configuration.
     * @param {object} pluginDeps - Dependencies injected by PluginManager.
     */
    async init(pluginDeps) {
        this.deps = pluginDeps;
        this.deps.pluginLog('MQTT', 'Initializing MQTT plugin...');
        this.config = await this.getConfig();
        
        const initialState = { ...this.config, enabled: this.config.enabled, status: 'Disabled' };
        this.deps.updatePluginState(this.name, initialState);

        if (this.config.enabled) {
            this.connect();
        }
    }

    /**
     * Retrieves the current configuration from the database.
     * @returns {object} The saved configuration.
     */
    async getConfig() {
        const config = {
            enabled: await this.deps.getSetting('mqttEnabled', 'false') === 'true',
            host: await this.deps.getSetting('mqttHost', ''),
            port: parseInt(await this.deps.getSetting('mqttPort', '1883'), 10),
            clientId: await this.deps.getSetting('mqttClientId', `monnit-utility-${Date.now()}`),
            topic: await this.deps.getSetting('mqttTopic', 'monnit/sensors'),
            username: await this.deps.getSetting('mqttUsername', ''),
            password: await this.deps.getSetting('mqttPassword', ''),
            protocol: await this.deps.getSetting('mqttProtocol', 'mqtt'), // 'mqtt' or 'websocket'
            tls: await this.deps.getSetting('mqttTls', 'false') === 'true',
        };
        config.enabled = config.enabled && !!config.host && !!config.topic;
        return config;
    }

    /**
     * Saves the configuration to the database.
     * @param {object} config - The new configuration to save.
     */
    async saveConfig(config) {
        // FIX: Provide default values to prevent crash if properties are missing from client
        const protocolToSave = config.protocol ?? 'mqtt';
        const tlsToSave = config.tls ?? false;
        
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttEnabled', config.enabled.toString());
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttHost', config.host);
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttPort', config.port.toString());
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttClientId', config.clientId);
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttTopic', config.topic);
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttUsername', config.username);
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttPassword', config.password);
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttProtocol', protocolToSave);
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttTls', tlsToSave.toString());

        // Update local config
        this.config = await this.getConfig();
        
        this.addLog(`Configuration saved. Enabled: ${this.config.enabled}`);

        // Disconnect and reconnect with new settings
        this.disconnect(true);
        if (this.config.enabled) {
            this.connect();
        }
    }
    
    disconnect(isSaving = false) {
        if (this.client) {
            this.client.end(true, () => {
                const msg = 'Disconnected from broker.';
                this.deps.pluginLog('MQTT', msg);
                this.addLog(msg);
            });
            this.client = null;
            
            if (!isSaving) {
                this.deps.updatePluginState(this.name, { status: 'Disabled' });
            }
        }
    }

    connect() {
        if (this.client) {
            this.deps.pluginLog('MQTT', 'Connection already active, disconnecting first.');
            this.disconnect(true);
        }

        const baseProtocol = this.config.protocol === 'websocket' ? 'ws' : 'mqtt';
        const protocol = `${baseProtocol}${this.config.tls ? 's' : ''}`;
        const url = `${protocol}://${this.config.host}:${this.config.port}`;

        const options = {
            clientId: this.config.clientId,
            username: this.config.username || undefined,
            password: this.config.password || undefined,
            rejectUnauthorized: false,
            connectTimeout: 5000,
        };

        const msg = `Attempting to connect to ${url}...`;
        this.deps.pluginLog('MQTT', msg);
        this.addLog(msg);
        this.deps.updatePluginState(this.name, { status: 'Connecting...' });

        try {
            this.client = mqtt.connect(url, options);

            this.client.on('connect', () => {
                const msg = `Successfully connected to ${url}`;
                this.deps.pluginLog('MQTT', msg);
                this.addLog(msg);
                this.deps.updatePluginState(this.name, { status: 'Connected', statusColor: 'var(--success-accent)' });
            });

            this.client.on('error', (error) => {
                const msg = `Connection error: ${error.message}`;
                this.deps.pluginLog('MQTT', msg, 'ERROR');
                this.addLog(msg);
                this.deps.updatePluginState(this.name, { status: `Error: ${error.message}`, statusColor: 'var(--danger-accent)' });
            });

            this.client.on('reconnect', () => {
                const msg = 'Reconnecting to broker...';
                this.deps.pluginLog('MQTT', msg);
                this.addLog(msg);
                this.deps.updatePluginState(this.name, { status: 'Reconnecting...', statusColor: 'var(--warning-accent)' });
            });

            this.client.on('close', () => {
                const msg = 'Connection closed.';
                this.deps.pluginLog('MQTT', msg);
                this.addLog(msg);
                if (this.config.enabled) {
                    this.deps.updatePluginState(this.name, { status: 'Disconnected', statusColor: 'var(--danger-accent)' });
                }
            });

        } catch (error) {
            const msg = `Failed to create client: ${error.message}`;
            this.deps.pluginLog('MQTT', msg, 'ERROR');
            this.addLog(msg);
            this.deps.updatePluginState(this.name, { status: `Error: ${msg}`, statusColor: 'var(--danger-accent)' });
        }
    }

    /**
     * Broadcasts sensor data.
     * @param {Array<object>} sensors - Array of sensor data.
     * @param {object} gateway - Gateway information.
     */
    async broadcast(sensors) {
        if (!this.client || !this.client.connected || !this.config.enabled) {
            return;
        }

        const baseTopic = this.config.topic;
        for (const sensor of sensors) {
            const topic = `${baseTopic}/${sensor.sensorId}`;
            const payload = JSON.stringify(sensor);
            this.client.publish(topic, payload, { qos: 0, retain: true }, (err) => {
                if (err) {
                    const msg = `Failed to publish to ${topic}: ${err.message}`;
                    this.deps.pluginLog('MQTT', msg, 'ERROR');
                    this.addLog(msg);
                }
            });
        }
        const msg = `Published data for ${sensors.length} sensors to ${baseTopic}/...`;
        this.deps.pluginLog('MQTT', msg);
        this.addLog(msg);
    }

    /**
     * Broadcasts an alert.
     * @param {string} alertMessage - The formatted alert message.
     * @param {object} sensorReading - The sensor reading that triggered the alert.
     */
    async broadcastAlert(alertMessage, sensorReading) {
        if (!this.client || !this.client.connected || !this.config.enabled) {
            return;
        }

        const baseTopic = this.config.topic;
        const topic = `${baseTopic}/alerts/${sensorReading.sensorId}`;
        const payload = JSON.stringify({
            message: alertMessage,
            sensor: sensorReading
        });

        this.client.publish(topic, payload, { qos: 1, retain: false }, (err) => {
            if (err) {
                const msg = `Failed to publish alert to ${topic}: ${err.message}`;
                this.deps.pluginLog('MQTT', msg, 'ERROR');
                this.addLog(msg);
            } else {
                const msg = `Published alert for ${sensorReading.sensorId} to ${topic}`;
                this.deps.pluginLog('MQTT', msg);
                this.addLog(msg);
            }
        });
    }

    addLog(message) {
        const logEntry = { ts: Date.now(), msg: message };
        
        // FIX: Use push/shift to maintain chronological order for the frontend prepend-loop
        this.logs.push(logEntry);
        
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        const socket = this.deps.io();
        if (socket) {
            socket.emit('mqtt-log', this.logs);
        }
    }

    getLogs() {
        return this.logs;
    }
}

// Export a single instance
export const mqttPlugin = new MqttPlugin();