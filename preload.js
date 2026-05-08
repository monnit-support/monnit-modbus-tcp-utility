// preload.js
// This script acts as a secure bridge between your renderer (frontend) and the main process (main.js).
// It replaces the functionality of socket.io-client.

const { contextBridge, ipcRenderer } = require('electron');

// A whitelist of channels to secure communication (Renderer -> Main)
const validSendChannels = [
    'client-ready', 'setup-complete', 'start-polling', 'stop-polling', 'update-settings',
    'update-alerting-status', 'save-email-settings', 'send-test-email', 'save-sms-settings',
    'send-test-sms', 'save-alert-message', 'find-gateway-ip', 'find-gateway-mac',
    'scan-for-gateways', 'cancel-scan', 'remove-gateway', 'reset-all-gateways',
    'reset-all-alerts', 'reset-color-groups', 'reset-sensor-names', 'gateway-get-settings',
    'gateway-save-settings', 'get-gateway-setup-details', 'setup-enable-modbus',
    'gateway-reboot', 'get-device-history', 'set-active-gateway',
    'save-alert-config', 'save-sensor-metadata', 'get-modbus-registers', 'refresh-gateway-status',
    'save-backup-settings', 'backup-now',
    // --- Bulk Add Handler ---
    'add-gateways',
    // --- Documentation Channel ---
    'open-help-docs',
    'save-csv-file',
    // --- Backup Folder Channel ---
    'open-backups-folder',
    // --- External Device Channels ---
    'save-external-device-metadata',
    'get-external-device-history',
    // --- Plugin Config Channels ---
    'save-webhooks-config', 'save-mqtt-config', 'save-bacnet-config', 'save-snmptrap-config',
    'save-mqttsub-config', 'save-bacnetsub-config', 'save-lorawan-config', 'save-mbpoller-config',
    'get-plugin-configs',
    // --- Update Channels ---
    'check-for-updates', 'set-auto-update',
    // --- Auto Download Channels ---
    'save-auto-download-settings', 'open-documents-folder'
];

// A whitelist of channels for receiving data (Main -> Renderer)
const validReceiveChannels = [
    'polling-status', 'known-gateways', 'alert-configs-data', 'all-sensor-metadata',
    'all-external-metadata',
    'current-settings', 'log-message', 'modbus-data', 'polling-state-change',
    'system-status-update', 'scan-status-update', 'scan-results', 'gateway-find-result',
    'gateway-setup-details', 'gateway-settings-data', 'gateway-reconnecting',
    'gateway-save-status', 'setup-modbus-enabled-success', 'setup-modbus-enabled-fail',
    'settings-updated', 'email-settings-saved', 'email-test-status', 'sms-settings-saved',
    'sms-test-status', 'alert-message-saved', 'color-groups-reset-success',
    'sensor-names-reset-success', 'gateways-reset-success', 'gateways-added-success',
    'gateway-reboot-status', 'device-history-data', 'set-active-failed',
    'sensor-metadata-updated', 'modbus-register-data', 'gateway-status-data',
    'backup-status', 'backup-settings-saved',
    'save-csv-response',
    'external-devices-data', 'external-metadata-updated', 'external-device-history-data',
    'save-status', 'webhooks-config', 'mqtt-config', 'bacnet-config', 'snmptrap-config',
    'mqttsub-config', 'bacnetsub-config', 'lorawan-config', 'mbpoller-config',
    'plugin-status', 'webhook-log', 'mqtt-log', 'bacnet-log', 'snmptrap-log',
    'mqttsub-log', 'bacnetsub-log', 'lorawan-log', 'mbpoller-log',
    'update-status', 'update-downloaded', 'update-ready', 'auto-download-saved',
    'no-active-gateway', 'gateway-timeout',
    'modbus-disabled-blocking-start', 'request-poll-start', 'active-gateway-applied'
];

contextBridge.exposeInMainWorld('socket', {
    /**
     * Send an event to the main process.
     * @param {string} channel - The event channel (must be in validSendChannels)
     * @param {*} data - The payload to send
     */
    send: (channel, data) => {
        if (validSendChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        } else {
            console.warn(`Blocked send channel: ${channel}`);
        }
    },

    /**
     * Alias for 'send' to maintain compatibility with legacy Socket.io 'emit' calls.
     * @param {string} channel - The event channel (must be in validSendChannels)
     * @param {*} data - The payload to send
     */
    emit: (channel, ...args) => {
        if (validSendChannels.includes(channel)) {
            ipcRenderer.send(channel, ...args);
        } else {
            console.warn(`Blocked emit channel: ${channel}`);
        }
    },

    /**
     * Listen for an event from the main process.
     * @param {string} channel - The event channel (must be in validReceiveChannels)
     * @param {Function} func - The callback function to execute
     */
    on: (channel, func) => {
        if (validReceiveChannels.includes(channel)) {
            // Stripping 'event' from arguments to look like Socket.io
            const subscription = (event, ...args) => {
                // DEFENSIVE: Defer callback execution until after current task
                // This gives core scripts like client-core.js time time to finish DOM initialization
                setTimeout(() => {
                    try {
                        if (typeof func === 'function') {
                            func(...args);
                        }
                    } catch (err) {
                        // Suppress log errors during boot if variables aren't defined yet
                        const msg = err && typeof err.message === 'string' ? err.message : String(err);
                        if (!msg.includes('not defined')) {
                            console.error(`[PRELOAD] Error in listener for channel "${channel}":`, msg);
                        }
                    }
                }, 0);
            };

            ipcRenderer.on(channel, subscription);

            // Return a function to remove the listener
            return () => ipcRenderer.removeListener(channel, subscription);
        } else {
            console.warn(`Blocked receive channel: ${channel}`);
        }
    }
});