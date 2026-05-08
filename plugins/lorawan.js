// plugins/lorawan.js
import dgram from 'dgram';
// lora-packet is a CJS module, so we must import it this way
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const loraPacket = require('lora-packet');

/**
 * LoRaWAN (Receive) Plugin
 * * Listens for Semtech UDP packet forwarder messages (UDP port 1700).
 * * Decrypts ABP device payloads using a shared AppSKey.
 * * Creates an "External Device" for each LoRaWAN device.
 */
class LorawanPlugin {
    constructor() {
        this.name = 'lorawan';
        this.config = {};
        this.deps = null;
        this.server = null; // This will be the dgram UDP socket
        this.logs = [];
        this.maxLogs = 100;
        this.gatewayTokens = new Map(); // Stores gateway random tokens
    }

    /**
     * Initializes the plugin, loading its configuration.
     * @param {object} pluginDeps - Dependencies injected by PluginManager.
     */
    async init(pluginDeps) {
        this.deps = pluginDeps;
        this.deps.pluginLog('LoRaWAN', 'Initializing LoRaWAN plugin...');
        this.config = await this.getConfig();
        
        const initialState = { ...this.config, enabled: this.config.enabled, status: 'Disabled' };
        this.deps.updatePluginState(this.name, initialState);

        try {
            this.startListener();
        } catch (error) {
            this.deps.pluginLog('LoRaWAN', `Failed to start listener on init: ${error.message}`, 'ERROR');
        }
    }

    /**
     * Retrieves the current configuration from the database.
     * @returns {object} The saved configuration.
     */
    async getConfig() {
        const config = {
            enabled: await this.deps.getSetting('lorawanEnabled', 'false') === 'true',
            port: parseInt(await this.deps.getSetting('lorawanPort', '1700'), 10),
            appSKey: await this.deps.getSetting('lorawanAppSKey', ''), // Shared key for all ABP devices
        };
        // To be enabled, it MUST have a port and a key
        config.enabled = config.enabled && !!config.port && !!config.appSKey;
        return config;
    }

    /**
     * Saves the configuration to the database.
     * @param {object} config - The new configuration to save.
     */
    async saveConfig(config) {
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'lorawanEnabled', config.enabled.toString());
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'lorawanPort', config.port.toString());
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'lorawanAppSKey', config.appSKey);

        const oldPort = this.config.port;
        this.config = await this.getConfig(); // Re-fetch to validate
        
        this.addLog(`Configuration saved. Enabled: ${this.config.enabled}`);

        // Restart listener if port changed or was just enabled
        if (config.port !== oldPort || (config.enabled && !this.server)) {
            this.stopListener();
        }
        
        // The startListener function will handle the "enabled" check
        this.startListener();
    }
    
    /**
     * Stops the LoRaWAN UDP listener.
     */
    stopListener() {
        if (this.server) {
            this.server.close();
            this.server = null;
            this.addLog('LoRaWAN UDP listener stopped.');
            this.deps.updatePluginState(this.name, { enabled: false, status: 'Disabled' });
        }
    }

    /**
     * Starts the LoRaWAN UDP listener.
     */
    startListener() {
        if (this.server) {
            this.addLog('Listener is already running.');
            if (this.config.enabled) {
                this.deps.updatePluginState(this.name, { enabled: true, status: 'Listening', statusColor: 'var(--success-accent)' });
            } else {
                 this.deps.updatePluginState(this.name, { enabled: false, status: 'Disabled' });
            }
            return;
        }

        if (!this.config.enabled) {
            this.addLog('Listener is disabled. (Requires Port and AppSKey)');
            this.deps.updatePluginState(this.name, { enabled: false, status: 'Disabled' });
            return;
        }

        try {
            this.server = dgram.createSocket('udp4');

            this.server.on('error', (err) => {
                const msg = `UDP server error: ${err.message}`;
                this.deps.pluginLog('LoRaWAN', msg, 'ERROR');
                this.addLog(msg);
                this.deps.updatePluginState(this.name, { enabled: false, status: `Error: ${err.message}`, statusColor: 'var(--danger-accent)' });
                this.server.close();
                this.server = null;
            });

            this.server.on('message', (msg, rinfo) => {
                this.handleUdpPacket(msg, rinfo);
            });

            this.server.on('listening', () => {
                const address = this.server.address();
                const msg = `Listening for LoRaWAN packets on ${address.address}:${address.port}`;
                this.deps.pluginLog('LoRaWAN', msg);
                this.addLog(msg);
                this.deps.updatePluginState(this.name, { enabled: true, status: 'Listening', statusColor: 'var(--success-accent)' });
            });

            this.server.bind(this.config.port);

        } catch (err) {
            const msg = `Failed to create UDP listener: ${err.message}`;
            this.deps.pluginLog('LoRaWAN', msg, 'ERROR');
            this.addLog(msg);
            this.deps.updatePluginState(this.name, { enabled: false, status: `Error: ${err.message}`, statusColor: 'var(--danger-accent)' });
        }
    }

    /**
     * Handles an incoming UDP packet from a gateway.
     * @param {Buffer} msg - The raw UDP message.
     * @param {object} rinfo - Remote info (gateway address).
     */
    handleUdpPacket(msg, rinfo) {
        const identifier = msg[3];
        const token = msg.slice(1, 3);
        
        switch (identifier) {
            case 0x00: // PUSH_DATA
                this.addLog(`Received PUSH_DATA from ${rinfo.address}:${rinfo.port}`);
                this.handlePushData(msg, rinfo, token);
                this.sendAck(token, 0x01, rinfo); // Send PUSH_ACK
                break;
            case 0x02: // PULL_DATA
                this.addLog(`Received PULL_DATA from ${rinfo.address}:${rinfo.port}`);
                this.gatewayTokens.set(rinfo.address, token);
                this.sendAck(token, 0x04, rinfo); // Send PULL_ACK
                break;
            case 0x05: // TX_ACK
                this.addLog(`Received TX_ACK from ${rinfo.address}:${rinfo.port}`);
                break;
            default:
                this.addLog(`Received unknown packet type ${identifier} from ${rinfo.address}`, 'WARN');
                break;
        }
    }

    /**
     * Sends an ACK packet back to the gateway.
     * @param {Buffer} token - The random token from the gateway.
     * @param {number} identifier - The ACK identifier (0x01 for PUSH_ACK, 0x04 for PULL_ACK).
     * @param {object} rinfo - Remote info (gateway address).
     */
    sendAck(token, identifier, rinfo) {
        const protocolVersion = 2;
        const ack = Buffer.alloc(4);
        ack[0] = protocolVersion;
        token.copy(ack, 1);
        ack[3] = identifier;
        
        this.server.send(ack, 0, ack.length, rinfo.port, rinfo.address, (err) => {
            if (err) {
                this.addLog(`Error sending ACK to ${rinfo.address}: ${err.message}`, 'ERROR');
            }
        });
    }

    /**
     * Processes a PUSH_DATA packet.
     * @param {Buffer} msg - The raw UDP message.
     * @param {object} rinfo - Remote info (gateway address).
     */
    handlePushData(msg, rinfo) {
        try {
            const data = msg.slice(12); // Remove 12-byte header
            const jsonData = JSON.parse(data.toString());

            if (!jsonData.rxpk || !Array.isArray(jsonData.rxpk)) {
                return; // Not uplink data
            }

            for (const rx of jsonData.rxpk) {
                const packet = loraPacket.fromWire(Buffer.from(rx.data, 'base64'));
                
                // 1. Verify MIC (Message Integrity Code)
                // We'll assume ABP for simplicity and use the shared AppSKey as the NwkSKey
                // In a real OTAA setup, you'd need to look up the NwkSKey based on DevAddr
                const NwkSKey = Buffer.from(this.config.appSKey, 'hex');
                if (!loraPacket.verifyMIC(packet, NwkSKey)) {
                    this.addLog(`Invalid MIC for packet from ${packet.DevAddr.toString('hex')}`, 'WARN');
                    continue;
                }

                // 2. Decrypt Payload
                const AppSKey = Buffer.from(this.config.appSKey, 'hex');
                const payload = loraPacket.decrypt(packet, AppSKey, NwkSKey);
                
                this.processUplink(packet, payload, rx, rinfo);
            }
        } catch (error) {
            this.addLog(`Failed to parse PUSH_DATA from ${rinfo.address}: ${error.message}`, 'WARN');
        }
    }

    /**
     * Processes a decrypted uplink and saves it to the database.
     * @param {object} packet - The parsed packet from lora-packet.
     * @param {Buffer} payload - The decrypted FRMPayload.
     * @param {object} rx - The rxpk metadata from the gateway.
     * @param {object} rinfo - Remote info (gateway address).
     */
async processUplink(packet, payload, rx, rinfo) {
    const devAddr = packet.DevAddr.toString('hex');
    const deviceId = `lorawan-${devAddr}`;
    const deviceName = `LoRaWAN Device ${devAddr.toUpperCase()}`;
    const timestamp = Math.floor(Date.now() / 1000);

    // FIX: Convert all Buffer objects to hex strings
    const lastData = {
        gatewayIP: rinfo.address,
        devAddr: devAddr.toUpperCase(),
        fCnt: packet.FCnt, // FCnt is already a number, not a buffer
        rssi: rx.rssi,
        snr: rx.lsnr,
        spreadingFactor: `SF${rx.datr.split('SF')[1].split('BW')[0]}`,
        bandwidth: `BW${rx.datr.split('BW')[1]}`,
        // FIX: Convert payload buffer to hex, then to readable string
        payload: Buffer.from(payload.toString('hex'), 'hex').toString('utf8')
    };
    
    const lastDataString = JSON.stringify(lastData, null, 2);

    try {
        await this.deps.db.run(
            `INSERT OR REPLACE INTO external_devices (id, type, name, lastData, lastSeen, isAware)
             VALUES (?, ?, ?, ?, ?, ?)`,
            deviceId,
            'LoRaWAN',
            deviceName,
            lastDataString,
            timestamp,
            1
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

        this.addLog(`Saved uplink from ${devAddr.toUpperCase()} via ${rinfo.address}`);
    } catch (error) {
        this.addLog(`DB error saving LoRaWAN uplink: ${error.message}`, 'ERROR');
    }
}



    // --- Log Management ---
    
    /**
     * Adds a new message to the internal log array.
     * @param {string} message - The log message.
     */
    addLog(message, level = 'INFO') {
        const logEntry = { ts: Date.now(), msg: `[${level}] ${message}` };
        
        // FIX: Use push/shift to maintain chronological order for the frontend prepend-loop
        this.logs.push(logEntry);
        
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        const socket = this.deps.io();
        if (socket) {
            socket.emit('lorawan-log', this.logs); 
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
export const lorawanPlugin = new LorawanPlugin();