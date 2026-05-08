// plugins/snmptrap.js
import dgram from 'dgram';
import snmp from 'net-snmp';

/**
 * SNMP Trap (Receive) Plugin
 * * Listens for SNMP v1 traps on port 162.
 * * Creates a new "External Device" for each source IP.
 * * Saves trap data to the external device history.
 */
class SnmpTrapPlugin {
    constructor() {
        this.name = 'snmptrap';
        this.config = {};
        this.deps = null;
        this.server = null; // This will be the dgram socket
        this.receiver = null; // This will be the snmp.Receiver
        this.logs = [];
        this.maxLogs = 100;
        this.knownVarbinds = {
            '1.3.6.1.2.1.1.3.0': 'sysUpTimeInstance',
            '1.3.6.1.6.3.1.1.4.1.0': 'snmpTrapOID',
            '1.3.6.1.6.3.18.1.3.0': 'snmpTrapAddress',
            '1.3.6.1.6.3.1.1.4.3.0': 'snmpTrapEnterprise',
            // Add more known OIDs here for better parsing
        };
    }

    /**
     * Initializes the plugin, loading its configuration.
     * @param {object} pluginDeps - Dependencies injected by PluginManager.
     */
    async init(pluginDeps) {
        this.deps = pluginDeps;
        this.deps.pluginLog('SNMP Trap', 'Initializing SNMP Trap plugin...');
        this.config = await this.getConfig();
        
        const initialState = { ...this.config, enabled: this.config.enabled, status: 'Disabled' };
        this.deps.updatePluginState(this.name, initialState);

        // Start the listener on init *regardless* of enable state.
        // This is a common pattern for "listener" plugins so they
        // can start up with the app. The saveConfig logic will
        // start/stop it if the user changes settings.
        try {
            this.startListener();
        } catch (error) {
            this.deps.pluginLog('SNMP Trap', `Failed to start listener on init: ${error.message}`, 'ERROR');
        }
    }

    /**
     * Retrieves the current configuration from the database.
     * @returns {object} The saved configuration.
     */
    async getConfig() {
        const config = {
            enabled: await this.deps.getSetting('snmptrapEnabled', 'false') === 'true',
            port: parseInt(await this.deps.getSetting('snmptrapPort', '162'), 10),
            community: await this.deps.getSetting('snmptrapCommunity', 'public'),
        };
        return config;
    }

    /**
     * Saves the configuration to the database.
     * @param {object} config - The new configuration to save.
     */
    async saveConfig(config) {
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'snmptrapEnabled', config.enabled.toString());
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'snmptrapPort', config.port.toString());
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'snmptrapCommunity', config.community);

        const oldPort = this.config.port;
        this.config = config;
        
        this.addLog(`Configuration saved. Enabled: ${this.config.enabled}`);

        // Restart listener if port changed or was just enabled
        if (config.port !== oldPort) {
            this.stopListener();
        }
        
        // The startListener function will handle the "enabled" check
        this.startListener();
    }
    
    /**
     * Stops the SNMP trap listener.
     */
    stopListener() {
        if (this.receiver) {
            this.receiver.close();
            this.receiver = null;
            this.addLog('Trap receiver stopped.');
            this.deps.updatePluginState(this.name, { enabled: false, status: 'Disabled' });
        }
    }

    /**
     * Starts the SNMP trap listener.
     */
    startListener() {
        if (this.receiver) {
            this.addLog('Listener is already running.');
            if (this.config.enabled) {
                this.deps.updatePluginState(this.name, { enabled: true, status: 'Listening', statusColor: 'var(--success-accent)' });
            } else {
                 this.deps.updatePluginState(this.name, { enabled: false, status: 'Disabled' });
            }
            return;
        }

        if (!this.config.enabled) {
            this.addLog('Listener is disabled in config, not starting.');
            this.deps.updatePluginState(this.name, { enabled: false, status: 'Disabled' });
            return;
        }

        const options = {
            port: this.config.port,
            disableAuthorization: true, // We do our own community check
        };

        // FIX: The callback signature is (error, packet) where packet = {pdu, rinfo}
        const callback = (error, packet) => {
            if (error) {
                this.addLog(`Receiver error: ${error.message}`, 'ERROR');
                return;
            }

            // FIX: Destructure pdu and rinfo from the packet object
            const { pdu, rinfo } = packet;

            // Check if rinfo or pdu is valid
            if (!rinfo || !rinfo.address || !pdu) {
                this.addLog(`Received trap with invalid/missing info. rinfo: ${JSON.stringify(rinfo)}, pdu: ${JSON.stringify(pdu)}`, 'WARN');
                return; // Stop processing
            }

            // Check community string
            if (pdu.community && pdu.community.toString() !== this.config.community) {
                this.addLog(`Received trap with invalid community string from ${rinfo.address}.`, 'WARN');
                return;
            }

            // Only process if the plugin is fully enabled
            if (!this.config.enabled) {
                return;
            }
            
            this.processTrap(pdu, rinfo);
        };

        try {
            this.receiver = snmp.createReceiver(options, callback);
            const msg = `Listening for traps on 0.0.0.0:${this.config.port}`;
            this.deps.pluginLog('SNMP Trap', msg);
            this.addLog(msg);
            this.deps.updatePluginState(this.name, { enabled: true, status: 'Listening', statusColor: 'var(--success-accent)' });

        } catch (err) {
            const msg = `Failed to create listener: ${err.message}`;
            this.deps.pluginLog('SNMP Trap', msg, 'ERROR');
            this.addLog(msg);
            this.deps.updatePluginState(this.name, { enabled: false, status: `Error: ${err.message}`, statusColor: 'var(--danger-accent)' });
        }
    }

    /**
     * --- NEW: Process and Save Trap ---
     * Parses the PDU and saves it to the external_devices DB.
     * @param {object} pdu - The Protocol Data Unit (trap data).
     * @param {object} rinfo - Remote info (source address).
     */
    async processTrap(pdu, rinfo) {
        if (!rinfo || !rinfo.address) {
            this.addLog(`Received a trap with invalid/missing remote info. Skipping.`, 'WARN');
            return;
        }
    
        const deviceId = `snmp-${rinfo.address}`;
        const deviceName = `SNMP Device at ${rinfo.address}`;
        const timestamp = Math.floor(Date.now() / 1000);
    
        // Parse varbinds into readable key-value pairs
        const parsedData = {};
        if (pdu.varbinds) { // Ensure varbinds exist
            pdu.varbinds.forEach(vb => {
                const name = this.knownVarbinds[vb.oid] || vb.oid;
                let value = vb.value;
        
                // Handle Buffer types
                if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
                    value = Buffer.from(value.data).toString('utf-8');
                }
        
                parsedData[name] = value;
            });
        }
    
        const lastData = {
            type: `SNMP v${pdu.version || 1} Trap`,
            source: rinfo.address,
            enterprise: pdu.enterprise,
            generic: pdu.generic,
            specific: pdu.specific,
            uptime: pdu.upTime,
            varbinds: parsedData
        };
    
        const lastDataString = JSON.stringify(lastData, null, 2);
    
        try {
            // 1. Update the main device table
            await this.deps.db.run(
                `INSERT OR REPLACE INTO external_devices (id, type, name, lastData, lastSeen, isAware)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                deviceId,
                'SNMP Trap',
                deviceName,
                lastDataString,
                timestamp,
                1 // isAware = true
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

            this.addLog(`Saved SNMP trap from ${rinfo.address} as device ${deviceId}`);
        } catch (error) {
            this.addLog(`DB error saving SNMP trap: ${error.message}`, 'ERROR');
        }
    }
    
    /**
     * Broadcasts sensor data (not used by this plugin).
     */
    async broadcast(sensors, gateway) {
        // This is a "Receive" plugin, so this method is not used.
    }

    /**
     * Broadcasts an alert (not used by this plugin).
     */
    async broadcastAlert(alertMessage, sensorReading) {
        // This is a "Receive" plugin, so this method is not used.
    }

    // --- Log Management ---
    
    /**
     * Adds a new message to the internal log array.
     * @param {string} message - The log message.
     */
    addLog(message) {
        const logEntry = { ts: Date.now(), msg: message };
        // FIX: Use push/shift to maintain chronological order for the frontend prepend-loop
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) this.logs.shift();
        
        const socket = this.deps.io();
        if (socket) {
            socket.emit('snmptrap-log', this.logs);
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
export const snmpTrapPlugin = new SnmpTrapPlugin();