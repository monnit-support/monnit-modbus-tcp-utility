// plugins/bacnet_subscriber.js
// Shares the user-chosen port (default 47808) with bacnet.js
// One socket, two consumers: raw + light decoder

import dgram from 'dgram';

class BacnetSubscriberPlugin {
    constructor() {
        this.name = 'bacnet_subscriber';
        this.config = {};
        this.deps = null;
        this.sock = null;               // shared UDP socket
        this.logs = [];
        this.maxLogs = 100;
    }

    async init(pluginDeps) {
        this.deps = pluginDeps;
        this.deps.pluginLog('BACnet Subscriber', 'Initializing...');
        this.config = await this.getConfig();

        const initialState = { ...this.config, enabled: this.config.enabled, status: 'Disabled' };
        this.deps.updatePluginState(this.name, initialState);

        if (this.config.enabled) this.startListener();
    }

    async getConfig() {
        const enabled = await this.deps.getSetting('bacnetSubEnabled', 'false') === 'true';
        const port = parseInt(await this.deps.getSetting('bacnetSubPort', '47808'), 10);
        return { enabled: enabled && !!port, port };
    }

    async saveConfig(config) {
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'bacnetSubEnabled', config.enabled.toString());
        await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'bacnetSubPort', config.port.toString());
        this.config = config;
        this.stopListener();
        if (this.config.enabled) this.startListener();
    }

    startListener() {
        this.stopListener();

        const port = this.config.port;
        console.log('[BACnet-sub] sharing UDP port', port);

        // SHARED socket – REUSEADDR allows multiple binds in same process
        this.sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        this.sock.on('message', (buf, rinfo) => this.onDatagram(buf, rinfo));
        this.sock.on('error', err => console.log('[BACnet-sub] socket error', err));
        this.sock.bind({ port, exclusive: false }, () =>
            console.log('[BACnet-sub] socket bound (shared) to', port)
        );

        this.deps.updatePluginState(this.name, { status: 'Listening', statusColor: 'var(--success-accent)' });
        this.addLog(`Listening for BACnet devices on shared port ${port}`);
    }

    stopListener() {
        if (this.sock) { this.sock.close(); this.sock = null; }
        this.deps.updatePluginState(this.name, { status: 'Disabled' });
    }

    // ------------ single entry point for every UDP datagram ------------
    onDatagram(buf, rinfo) {
        console.log('[BACnet-sub-RAW]', rinfo.address, rinfo.port, buf);

        // 1. fast Who-Is detect (2 bytes)
        if (buf.length >= 4 && buf[0] === 0x81 && buf[1] === 0x0b) {
            console.log('[BACnet-sub] Who-Is detected');
            this.handleWhoIs({ address: rinfo.address, port: rinfo.port }, {});
        }

        // 2. light parser for I-Am details
        const iam = this.parseIAm(buf);
        if (iam) {
            console.log('[BACnet-sub] I-Am parsed', iam);
            this.handleIAm({ address: rinfo.address, port: rinfo.port }, iam);
        }
    }

    // ------------ minimal I-Am parser ------------
    // returns { deviceId, vendorId } or null
    parseIAm(buf) {
        try {
            if (buf.length < 12) return null;
            let off = 0;
            // BVLC header
            if (buf[off] !== 0x81 || buf[off + 1] !== 0x20) return null; // I-Am
            off += 4; // skip BVLC length
            // APDU header
            if (buf[off] !== 0x10) return null; // unconfirmed
            off += 2;
            // Service choice
            if (buf[off] !== 0x00) return null; // I-Am service
            off += 1;
            // Device ID (32-bit unsigned)
            const deviceId = buf.readUInt32BE(off); off += 4;
            // Max APDU (skip)
            off += 2;
            // Segmentation (skip)
            off += 1;
            // Vendor ID (16-bit)
            const vendorId = buf.readUInt16BE(off);
            return { deviceId, vendorId };
        } catch (e) {
            return null;
        }
    }

    // ------------ DB helpers (unchanged) ------------
    async handleWhoIs(address, request) {
        const deviceId = `bacnet-${address.address}`;
        const deviceName = `BACnet Device (${address.address})`;
        const timestamp = Math.floor(Date.now() / 1000);

        const lastData = {
            address: address.address,
            instance: request.deviceId || 'unknown',
            vendor: request.vendorName || 'unknown',
            vendorId: request.vendorId || 0
        };

        const lastDataString = JSON.stringify(lastData, null, 2);

        try {
            await this.deps.db.run(
                `INSERT OR REPLACE INTO external_devices (id, type, name, lastData, lastSeen, isAware)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                deviceId, 'BACnet Subscriber', deviceName, lastDataString, timestamp, 1
            );

            await this.deps.db.run(
                `INSERT INTO external_device_history (deviceId, timestamp, data)
                 VALUES (?, ?, ?)`,
                deviceId, timestamp, lastDataString
            );
            if (this.deps.notifyExternalHistoryUpdate) this.deps.notifyExternalHistoryUpdate(deviceId);

            await this.deps.db.run(
                `INSERT OR IGNORE INTO external_device_metadata (id, customName, colorGroup)
                 VALUES (?, ?, ?)`,
                deviceId, deviceName, null
            );

            this.addLog(`Discovered BACnet device at ${address.address}`);
        } catch (error) {
            this.addLog(`DB error saving BACnet device: ${error.message}`, 'ERROR');
        }
    }

    async handleIAm(address, info) {
        const deviceId = `bacnet-${address.address}`;
        const lastData = {
            address: address.address,
            instance: info.deviceId,
            vendor: 'unknown',
            vendorId: info.vendorId
        };
        const lastDataString = JSON.stringify(lastData, null, 2);
        const timestamp = Math.floor(Date.now() / 1000);

        await this.deps.db.run(
            `UPDATE external_devices SET lastData = ?, lastSeen = ? WHERE id = ?`,
            lastDataString, timestamp, deviceId
        );
        this.addLog(`Updated I-Am details for ${address.address}`);
    }

    // ------------ logging ------------
    addLog(msg, level = 'INFO') {
        // FIX: Use push/shift to maintain chronological order for the frontend prepend-loop
        this.logs.push({ ts: Date.now(), msg: `[${level}] ${msg}` });
        
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        const socket = this.deps.io?.();
        if (socket) {
            socket.emit('bacnetsub-log', this.logs);
        }
    }

    getLogs() { return this.logs; }
}

export const bacnetSubscriberPlugin = new BacnetSubscriberPlugin();