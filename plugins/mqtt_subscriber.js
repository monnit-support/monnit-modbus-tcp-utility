// plugins/mqtt_subscriber.js
import mqtt from 'mqtt';

class MqttSubscriberPlugin {
    constructor() {
        this.name = 'mqtt_subscriber';
        this.config = {};
        this.deps = null;
        this.client = null;
        this.logs = [];
        this.maxLogs = 100;
    }

    async init(pluginDeps) {
        this.deps = pluginDeps;
        this.deps.pluginLog('MQTT Subscriber', 'Initializing...');
        this.config = await this.getConfig();

        const initialState = { ...this.config, enabled: this.config.enabled, status: 'Disabled' };
        this.deps.updatePluginState(this.name, initialState);

        if (this.config.enabled) {
            this.connect();
        }
    }

    async getConfig() {
        const config = {
            enabled: await this.deps.getSetting('mqttSubEnabled', 'false') === 'true',
            host: await this.deps.getSetting('mqttSubHost', ''),
            port: parseInt(await this.deps.getSetting('mqttSubPort', '1883'), 10),
            topic: await this.deps.getSetting('mqttSubTopic', 'external/+/data'),
            username: await this.deps.getSetting('mqttSubUsername', ''),
            password: await this.deps.getSetting('mqttSubPassword', ''),
            protocol: await this.deps.getSetting('mqttSubProtocol', 'mqtt'), // 'mqtt' or 'websocket'
            tls: await this.deps.getSetting('mqttSubTls', 'false') === 'true',
        };
        config.enabled = config.enabled && !!config.host && !!config.topic;
        return config;
    }

    async saveConfig(config) {
        // FIX: Provide default values to prevent crash if properties are missing from client
        const protocolToSave = config.protocol ?? 'mqtt';
        const tlsToSave = config.tls ?? false;

        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttSubEnabled', config.enabled.toString());
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttSubHost', config.host);
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttSubPort', config.port.toString());
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttSubTopic', config.topic);
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttSubUsername', config.username);
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttSubPassword', config.password);
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttSubProtocol', protocolToSave);
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'mqttSubTls', tlsToSave.toString());

        this.config = await this.getConfig(); // Re-fetch config from DB
        
        // Log status change (this will be suppressed by addLog guard if enabled is false, which is desired)
        this.addLog(`Configuration saved. New State: ${this.config.enabled ? 'Enabled' : 'Disabled'}`);
        
        this.disconnect(true);
        if (this.config.enabled) this.connect();
    }

    connect() {
        if (this.client) this.disconnect(true);

        // Security Check: Do not proceed if disabled
        if (!this.config.enabled) return;

        const baseProtocol = this.config.protocol === 'websocket' ? 'ws' : 'mqtt';
        const protocol = `${baseProtocol}${this.config.tls ? 's' : ''}`;
        const url = `${protocol}://${this.config.host}:${this.config.port}`;
        
        const options = {
            clientId: `monnit-sub-${Date.now()}`,
            username: this.config.username || undefined,
            password: this.config.password || undefined,
            rejectUnauthorized: false,
            connectTimeout: 5000,
        };

        this.deps.pluginLog('MQTT Subscriber', `Connecting to ${url}...`);
        this.addLog(`Connecting to ${url}...`);
        this.deps.updatePluginState(this.name, { status: 'Connecting...' });
        
        this.client = mqtt.connect(url, options);

        this.client.on('connect', () => {
            if (!this.config.enabled) { this.disconnect(); return; } // Double check

            const msg = `Successfully connected to ${url}`;
            this.deps.pluginLog('MQTT Subscriber', msg);
            this.addLog(msg);
            this.deps.updatePluginState(this.name, { status: 'Connected', statusColor: 'var(--success-accent)' });
            this.client.subscribe(this.config.topic, (err) => {
                if (!err) {
                    this.addLog(`Subscribed to ${this.config.topic}`);
                } else {
                    this.addLog(`Failed to subscribe to ${this.config.topic}: ${err.message}`, 'ERROR');
                }
            });
        });

        this.client.on('message', (topic, message) => {
            this.handleMessage(topic, message);
        });

        this.client.on('error', (err) => {
            this.addLog(`Error: ${err.message}`, 'ERROR');
            this.deps.updatePluginState(this.name, { status: `Error: ${err.message}`, statusColor: 'var(--danger-accent)' });
        });
        
        this.client.on('reconnect', () => {
            if (!this.config.enabled) { this.disconnect(); return; }

            const msg = 'Reconnecting to broker...';
            this.deps.pluginLog('MQTT Subscriber', msg);
            this.addLog(msg);
            this.deps.updatePluginState(this.name, { status: 'Reconnecting...', statusColor: 'var(--warning-accent)' });
        });

        this.client.on('close', () => {
            const msg = 'Connection closed.';
            this.deps.pluginLog('MQTT Subscriber', msg);
            // Allow this final log to indicate closure, unless strictly disabled logic prevents it
            this.addLog(msg); 
            if (this.config.enabled) {
                this.deps.updatePluginState(this.name, { status: 'Disconnected', statusColor: 'var(--danger-accent)' });
            }
        });
    }

    async handleMessage(topic, message) {
        // STRICT GUARD: No processing if disabled
        if (!this.config.enabled) return;

        try {
            const data = JSON.parse(message.toString());
            const deviceId = `mqtt-${topic.replace(/\//g, '-')}`;
            const deviceName = `MQTT Device (${topic})`;
            const timestamp = Math.floor(Date.now() / 1000);

            const lastData = {
                topic,
                payload: data
            };
            
            const lastDataString = JSON.stringify(lastData, null, 2);

            // 1. Update the main device table
            await this.deps.db.run(
                `INSERT OR REPLACE INTO external_devices (id, type, name, lastData, lastSeen, isAware)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                deviceId,
                'MQTT Subscriber',
                deviceName,
                lastDataString,
                timestamp,
                1
            );

            // 2. Add to the history table
            await this.deps.db.run(
                `INSERT INTO external_device_history (deviceId, timestamp, data)
                 VALUES (?, ?, ?)`,
                deviceId,
                timestamp,
                lastDataString
            );
            if (this.deps.notifyExternalHistoryUpdate) this.deps.notifyExternalHistoryUpdate(deviceId);

            // 3. Create a default metadata entry if it doesn't exist
            await this.deps.db.run(
                `INSERT OR IGNORE INTO external_device_metadata (id, customName, colorGroup)
                 VALUES (?, ?, ?)`,
                deviceId,
                deviceName, // Use the default name
                null       // No default color
            );

            this.addLog(`Received MQTT message from ${topic}`);
        } catch (err) {
            this.addLog(`Failed to parse MQTT message: ${err.message}`, 'ERROR');
        }
    }

    disconnect(isSaving = false) {
        if (this.client) {
            this.client.end(true);
            this.client.removeAllListeners(); // Prevent zombie listeners
            this.client = null;
            
            if (!isSaving) {
                this.deps.updatePluginState(this.name, { status: 'Disconnected' });
            }
        }
    }

    addLog(msg, level = 'INFO') {
        // STRICT GUARD: If disabled, do not log anything.
        if (this.config && this.config.enabled === false) return;

        const logEntry = { ts: Date.now(), msg: `[${level}] ${msg}` };
        
        // FIX: Use push/shift to maintain chronological order for the frontend prepend-loop
        this.logs.push(logEntry);
        
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        const socket = this.deps.io();
        if (socket) {
            socket.emit('mqttsub-log', this.logs);
        }
    }

    getLogs() { return this.logs; }
}

export const mqttSubscriberPlugin = new MqttSubscriberPlugin();