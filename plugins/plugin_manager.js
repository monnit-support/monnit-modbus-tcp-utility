// plugins/plugin_manager.js
import { webhookPlugin } from './webhook.js';
import { mqttPlugin } from './mqtt.js';
import { bacnetPlugin } from './bacnet.js';
import { snmpTrapPlugin } from './snmptrap.js';
import { mqttSubscriberPlugin } from './mqtt_subscriber.js';
import { bacnetSubscriberPlugin } from './bacnet_subscriber.js';
import { lorawanPlugin } from './lorawan.js';
import { modbusPollerPlugin } from './modbus_poller.js';

/**
 * Manages all plugins, acting as the central hub.
 * - Initializes plugins
 * - Holds their state
 * - Provides dependencies (db, log, io)
 * - Routes data (broadcastData, broadcastAlert)
 * - Handles socket events
 */
class PluginManager {
    constructor() {
        this.plugins = {}; // Holds the plugin instances
        this.deps = null;  // Holds all dependencies
        this.log = (level, message) => console.log(`[${level}] ${message}`); // Default logger
        
        // This is the single source of truth for plugin state
        this.pluginStates = {
            webhooks: { enabled: false, status: 'Disabled' },
            mqtt: { enabled: false, status: 'Disabled' },
            bacnet: { enabled: false, status: 'Disabled' },
            snmptrap: { enabled: false, status: 'Disabled' },
            mqtt_subscriber: { enabled: false, status: 'Disabled' },
            bacnet_subscriber: { enabled: false, status: 'Disabled' },
            lorawan: { enabled: false, status: 'Disabled' },
            modbus_poller: { enabled: false, status: 'Disabled' },
        };
    }

    /**
     * A namespaced logger for plugins to use.
     * @param {string} pluginName - The name of the plugin.
     * @param {string} message - The log message.
     * @param {string} [level='INFO'] - The log level (INFO, WARN, ERROR).
     */
    pluginLog(pluginName, message, level = 'INFO') {
        if (this.deps && this.deps.log) {
            this.deps.log(level, `[${pluginName}] ${message}`);
        } else {
            console.log(`[${level}] [${pluginName}] ${message}`);
        }
    }

    /**
     * A callback for plugins to update their global state.
     * @param {string} pluginName - The name of the plugin.
     * @param {object} newState - The state object to merge.
     */
    updatePluginState(pluginName, newState) {
        if (this.pluginStates[pluginName]) {
            this.pluginStates[pluginName] = {
                ...this.pluginStates[pluginName],
                ...newState
            };
            // Broadcast the new status to all connected clients
            this.broadcastPluginStatus();
        }
    }

    /**
     * Initializes the manager and all plugins.
     * @param {object} pluginDeps - Dependencies from app.js (db, log, io, etc.)
     */
    async init(pluginDeps) {
        this.deps = pluginDeps;
        this.log = this.deps.log; // Use the main app logger
        this.log('INFO', '[PluginManager] Initializing Plugin Manager...');

        try {
            // Inject the logger and state updater into the dependencies object
            this.deps.pluginLog = this.pluginLog.bind(this);
            this.deps.updatePluginState = this.updatePluginState.bind(this);

            // Store plugin instances in the `this.plugins` object
            this.plugins = {
                'webhooks': webhookPlugin,
                'mqtt': mqttPlugin,
                'bacnet': bacnetPlugin,
                'snmptrap': snmpTrapPlugin,
                'mqtt_subscriber': mqttSubscriberPlugin,
                'bacnet_subscriber': bacnetSubscriberPlugin,
                'lorawan': lorawanPlugin,
                'modbus_poller': modbusPollerPlugin
            };

            for (const [name, plugin] of Object.entries(this.plugins)) {
                if (typeof plugin.init === 'function') {
                    await plugin.init(this.deps); // Pass all dependencies
                } else {
                    this.log('WARN', `[PluginManager] Plugin ${name} has no init function.`);
                }
            }
            this.log('INFO', '[PluginManager] All plugins initialized.');
            this.log('INFO', '[PluginManager] Plugin Manager initialized successfully.');
        } catch (error) {
            this.log('ERROR', `[PluginManager] FAILED to initialize Plugin Manager: ${error.message}`);
        }
    }

    /**
     * Broadcasts the general plugin status (count, latest log) to clients.
     * @param {object} [socket] - Optional socket to send to, otherwise broadcasts to all.
     */
    broadcastPluginStatus(socket) {
        const target = socket || this.deps.io();
        if (!target) return;

        // FIX: Calculate enabled count based on the CONFIG, not the STATE.
        let enabledCount = 0;
        for (const p of Object.values(this.plugins)) {
            if (p.config && p.config.enabled) enabledCount++;
        }

        // Get the latest log entry from ALL plugins
        let allLogs = [];
        if (this.plugins.webhooks) allLogs.push(...this.plugins.webhooks.getLogs());
        if (this.plugins.mqtt) allLogs.push(...this.plugins.mqtt.getLogs());
        if (this.plugins.bacnet) allLogs.push(...this.plugins.bacnet.getLogs());
        if (this.plugins.snmptrap) allLogs.push(...this.plugins.snmptrap.getLogs());
        if (this.plugins.mqtt_subscriber) allLogs.push(...this.plugins.mqtt_subscriber.getLogs());
        if (this.plugins.bacnet_subscriber) allLogs.push(...this.plugins.bacnet_subscriber.getLogs());
        if (this.plugins.lorawan) allLogs.push(...this.plugins.lorawan.getLogs());
        if (this.plugins.modbus_poller) allLogs.push(...this.plugins.modbus_poller.getLogs());

        // Sort by timestamp descending
        allLogs.sort((a, b) => b.ts - a.ts);
        
        const latestLog = allLogs[0] || { msg: '-' };

        const latestLogMessage = latestLog.msg || '-';
        let firstLine = latestLogMessage.split('\n')[0].trim();

        const maxPreviewLength = 100; // Max 100 chars for the preview
        if (firstLine.length > maxPreviewLength) {
            firstLine = firstLine.substring(0, maxPreviewLength) + '...';
        }

        target.emit('plugin-status', {
            enabledCount: enabledCount,
            latestLog: firstLine // Send the truncated first line
        });
    }

    /**
     * Broadcasts sensor data to all enabled plugins.
     * @param {Array<object>} sensors - Array of sensor data.
     * @param {object} gateway - Gateway information.
     */
    async broadcastData(sensors, gateway) {
        for (const [name, plugin] of Object.entries(this.plugins)) {
            if (this.pluginStates[name].enabled && typeof plugin.broadcast === 'function') {
                try {
                    await plugin.broadcast(sensors, gateway);
                } catch (error) {
                    this.log('ERROR', `[PluginManager] Error in ${name} plugin broadcast: ${error.message}`);
                }
            }
        }
    }

    /**
     * Broadcasts an alert to all enabled plugins.
     * @param {string} alertMessage - The formatted alert message.
     * @param {object} sensorReading - The sensor reading that triggered the alert.
     */
    async broadcastAlert(alertMessage, sensorReading) {
        for (const [name, plugin] of Object.entries(this.plugins)) {
            if (this.pluginStates[name].enabled && typeof plugin.broadcastAlert === 'function') {
                try {
                    await plugin.broadcastAlert(alertMessage, sensorReading);
                } catch (error) {
                    this.log('ERROR', `[PluginManager] Error in ${name} plugin alert: ${error.message}`);
                }
            }
        }
    }

    /**
     * Updates a plugin's config (used by IPC/save flow).
     * @param {string} pluginId - The plugin ID (e.g. 'mqtt_subscriber').
     * @param {object} config - The new config to save.
     */
    async updatePluginConfig(pluginId, config) {
        const plugin = this.plugins[pluginId];
        if (!plugin || typeof plugin.saveConfig !== 'function') {
            throw new Error(`Plugin ${pluginId} has no saveConfig`);
        }
        await plugin.saveConfig(config);
    }

    /**
     * Registers all socket event handlers for plugins.
     * @param {object} socket - The client socket instance.
     */
    registerSocketHandlers(socket) {
        this.log('INFO', `[PluginManager] Registering socket handlers for client ${socket.id}`);

        // Send initial status on connect
        this.broadcastPluginStatus(socket);

        socket.on('get-plugin-configs', () => {
            try {
                // FIX: Merging order flipped.
                // The CONFIG ({...this.plugins.X.config}) must come LAST to override the stale STATE.
                // This ensures the UI reflects what is saved in the DB.
                socket.emit('webhooks-config', { ...this.plugins.webhooks.config, ...this.pluginStates.webhooks });
                socket.emit('mqtt-config', { ...this.plugins.mqtt.config, ...this.pluginStates.mqtt });
                socket.emit('bacnet-config', { ...this.plugins.bacnet.config, ...this.pluginStates.bacnet });
                socket.emit('snmptrap-config', { ...this.plugins.snmptrap.config, ...this.pluginStates.snmptrap });
                socket.emit('mqttsub-config', { ...this.plugins.mqtt_subscriber.config, ...this.pluginStates.mqtt_subscriber });
                socket.emit('bacnetsub-config', { ...this.plugins.bacnet_subscriber.config, ...this.pluginStates.bacnet_subscriber });
                socket.emit('lorawan-config', { ...this.plugins.lorawan.config, ...this.pluginStates.lorawan });
                socket.emit('mbpoller-config', { ...this.plugins.modbus_poller.config, ...this.pluginStates.modbus_poller });
            
                // Send all logs
                socket.emit('webhook-log', this.plugins.webhooks.getLogs());
                socket.emit('mqtt-log', this.plugins.mqtt.getLogs());
                socket.emit('bacnet-log', this.plugins.bacnet.getLogs());
                socket.emit('snmptrap-log', this.plugins.snmptrap.getLogs());
                socket.emit('mqttsub-log', this.plugins.mqtt_subscriber.getLogs());
                socket.emit('bacnetsub-log', this.plugins.bacnet_subscriber.getLogs());
                socket.emit('lorawan-log', this.plugins.lorawan.getLogs());
                socket.emit('mbpoller-log', this.plugins.modbus_poller.getLogs());

            } catch (error) {
                this.log('ERROR', `[PluginManager] Failed to get plugin configs for socket ${socket.id}: ${error.message}`);
            }
        });

        // --- Webhooks ---
        socket.on('save-webhooks-config', async (cfg) => {
            try {
                await this.plugins.webhooks.saveConfig(cfg);  // WAIT for save to complete
                // NOW emit the updated config (which includes the new state)
                socket.emit('webhooks-config', { 
                    ...this.plugins.webhooks.config,  // This now has the updated values
                    ...this.pluginStates.webhooks 
                });
                socket.emit('save-status', { plugin: 'webhooks', msg: 'Saved.' });
            } catch (error) {
                this.log('ERROR', `[PluginManager] Failed to save Webhooks config: ${error.message}`);
                socket.emit('save-status', { plugin: 'webhooks', msg: `Error: ${error.message}` });
            }
        });

        // --- MQTT ---
        socket.on('save-mqtt-config', async (cfg) => {
            try {
                await this.plugins.mqtt.saveConfig(cfg);  // WAIT for save to complete
                // NOW emit the updated config (which includes the new state)
                socket.emit('mqtt-config', { 
                    ...this.plugins.mqtt.config,  // This now has the updated values
                    ...this.pluginStates.mqtt 
                });
                socket.emit('save-status', { plugin: 'mqtt', msg: 'Saved.' });
            } catch (error) {
                this.log('ERROR', `[PluginManager] Failed to save MQTT config: ${error.message}`);
                socket.emit('save-status', { plugin: 'mqtt', msg: `Error: ${error.message}` });
            }
        });

        // --- BACnet ---
        socket.on('save-bacnet-config', async (cfg) => {
            try {
                await this.plugins.bacnet.saveConfig(cfg);  // WAIT for save to complete
                // NOW emit the updated config (which includes the new state)
                socket.emit('bacnet-config', { 
                    ...this.plugins.bacnet.config,  // This now has the updated values
                    ...this.pluginStates.bacnet 
                });
                socket.emit('save-status', { plugin: 'bacnet', msg: 'Saved.' });
            } catch (error) {
                this.log('ERROR', `[PluginManager] Failed to save BACnet config: ${error.message}`);
                socket.emit('save-status', { plugin: 'bacnet', msg: `Error: ${error.message}` });
            }
        });

        // --- New: SNMP Trap ---
        socket.on('save-snmptrap-config', async (cfg) => {
            try {
                await this.plugins.snmptrap.saveConfig(cfg);  // WAIT for save to complete
                // NOW emit the updated config (which includes the new state)
                socket.emit('snmptrap-config', { 
                    ...this.plugins.snmptrap.config,  // This now has the updated values
                    ...this.pluginStates.snmptrap 
                });
                socket.emit('save-status', { plugin: 'snmptrap', msg: 'Saved.' });
            } catch (error) {
                this.log('ERROR', `[PluginManager] Failed to save SNMP Trap config: ${error.message}`);
                socket.emit('save-status', { plugin: 'snmptrap', msg: `Error: ${error.message}` });
            }
        });

        // --- New: MQTT Subscriber ---
        socket.on('save-mqttsub-config', async (cfg) => {
            try {
                await this.plugins.mqtt_subscriber.saveConfig(cfg);  // WAIT for save to complete
                // NOW emit the updated config (which includes the new state)
                socket.emit('mqttsub-config', { 
                    ...this.plugins.mqtt_subscriber.config,  // This now has the updated values
                    ...this.pluginStates.mqtt_subscriber 
                });
                socket.emit('save-status', { plugin: 'mqtt_subscriber', msg: 'Saved.' });
            } catch (error) {
                this.log('ERROR', `[PluginManager] Failed to save MQTT Subscriber config: ${error.message}`);
                socket.emit('save-status', { plugin: 'mqtt_subscriber', msg: `Error: ${error.message}` });
            }
        });

        // --- New: BACnet Subscriber ---
        socket.on('save-bacnetsub-config', async (cfg) => {
            try {
                await this.plugins.bacnet_subscriber.saveConfig(cfg);  // WAIT for save to complete
                // NOW emit the updated config (which includes the new state)
                socket.emit('bacnetsub-config', { 
                    ...this.plugins.bacnet_subscriber.config,  // This now has the updated values
                    ...this.pluginStates.bacnet_subscriber 
                });
                socket.emit('save-status', { plugin: 'bacnet_subscriber', msg: 'Saved.' });
            } catch (error) {
                this.log('ERROR', `[PluginManager] Failed to save BACnet Subscriber config: ${error.message}`);
                socket.emit('save-status', { plugin: 'bacnet_subscriber', msg: `Error: ${error.message}` });
            }
        });
        
        // --- New: LoRaWAN ---
        socket.on('save-lorawan-config', async (cfg) => {
            try {
                await this.plugins.lorawan.saveConfig(cfg);  // WAIT for save to complete
                // NOW emit the updated config (which includes the new state)
                socket.emit('lorawan-config', { 
                    ...this.plugins.lorawan.config,  // This now has the updated values
                    ...this.pluginStates.lorawan 
                });
                socket.emit('save-status', { plugin: 'lorawan', msg: 'Saved.' });
            } catch (error) {
                this.log('ERROR', `[PluginManager] Failed to save LoRaWAN config: ${error.message}`);
                socket.emit('save-status', { plugin: 'lorawan', msg: `Error: ${error.message}` });
            }
        });

        // --- New: MODBUS Poller ---
        socket.on('save-mbpoller-config', async (cfg) => {
            try {
                await this.plugins.modbus_poller.saveConfig(cfg);  // WAIT for save to complete
                // NOW emit the updated config (which includes the new state)
                socket.emit('mbpoller-config', { 
                    ...this.plugins.modbus_poller.config,  // This now has the updated values
                    ...this.pluginStates.modbus_poller 
                });
                socket.emit('save-status', { plugin: 'modbus_poller', msg: 'Saved.' });
            } catch (error) {
                this.log('ERROR', `[PluginManager] Failed to save MODBUS Poller config: ${error.message}`);
                socket.emit('save-status', { plugin: 'modbus_poller', msg: `Error: ${error.message}` });
            }
        });
    }
}

// Export a single instance
export const pluginManager = new PluginManager();