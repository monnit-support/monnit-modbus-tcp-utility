// public/plugins.js - UI-side plugin manager
// FIX: Use Electron IPC bridge instead of Socket.IO

document.addEventListener('DOMContentLoaded', () => {
    
    // Use the IPC bridge from preload.js instead of Socket.IO
    const socket = window.socket;

    if (!socket) {
        console.error('[PLUGINS] window.socket is undefined! Check preload.js');
        return;
    }

    console.log('[PLUGINS] Initializing with Electron IPC bridge');

    let activePluginMode = 'broadcast'; // 'broadcast' or 'receive'

    // --- Mode Toggle ---
    const modeButtons = document.querySelectorAll('.plugin-mode-btn');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            modeButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activePluginMode = e.target.dataset.mode;
            
            document.getElementById('broadcast-plugin-container').classList.toggle('hidden', activePluginMode !== 'broadcast');
            document.getElementById('receive-plugin-container').classList.toggle('hidden', activePluginMode !== 'receive');
        });
    });

    // --- Tab Navigation ---
    const broadcastTabs = document.querySelectorAll('#broadcast-tabs .tab-link');
    const receiveTabs = document.querySelectorAll('#receive-tabs .tab-link');
    
    const allTabs = [...broadcastTabs, ...receiveTabs];
    
    allTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const target = e.target.dataset.tab;

            // Remove active from siblings
            e.target.closest('.tabs').querySelectorAll('.tab-link').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            // Hide all tab contents in this container
            e.target.closest('.plugin-group').querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Show target content
            const targetContent = document.getElementById(target);
            if (targetContent) targetContent.classList.add('active');
        });
    });

    // --- Configuration Loaders (simplified) ---
    
    // FIX: Use IPC bridge instead of Socket.IO emit/on
    const saveConfig = (channel, config, statusElementId) => {
        const statusEl = document.getElementById(statusElementId);
        if (statusEl) {
            statusEl.textContent = 'Saving...';
            statusEl.style.color = 'var(--info-accent)';
        }
        
        // Use the IPC bridge
        socket.emit(channel, config);
    };
    
    // --- Webhooks ---
    const whSaveBtn = document.getElementById('wh-save-btn');
    if (whSaveBtn) {
        whSaveBtn.addEventListener('click', () => {
            const config = {
                enabled: document.getElementById('wh-enable-toggle').checked,
                baseUrl: document.getElementById('wh-base-url').value,
                auth: document.getElementById('wh-auth-toggle').checked,
                username: document.getElementById('wh-username')?.value || '',
                password: document.getElementById('wh-password')?.value || ''
            };
            saveConfig('save-webhooks-config', config, 'wh-save-status');
        });
    }

    // --- MQTT ---
    const mqttSaveBtn = document.getElementById('mqtt-save-btn');
    if (mqttSaveBtn) {
        mqttSaveBtn.addEventListener('click', () => {
            const config = {
                enabled: document.getElementById('mqtt-enable-toggle').checked,
                host: document.getElementById('mqtt-host').value,
                port: parseInt(document.getElementById('mqtt-port').value) || 1883,
                clientId: document.getElementById('mqtt-client-id').value || `monnit-utility-${Date.now()}`,
                topic: document.getElementById('mqtt-topic').value,
                username: document.getElementById('mqtt-username')?.value || '',
                password: document.getElementById('mqtt-password')?.value || '',
                protocol: document.getElementById('mqtt-protocol')?.value || 'mqtt',
                tls: document.getElementById('mqtt-tls')?.checked || false
            };
            saveConfig('save-mqtt-config', config, 'mqtt-save-status');
        });
    }

    // --- BACnet ---
    const bacnetSaveBtn = document.getElementById('bacnet-save-btn');
    if (bacnetSaveBtn) {
        bacnetSaveBtn.addEventListener('click', () => {
            const config = {
                enabled: document.getElementById('bacnet-enable-toggle').checked,
                deviceName: document.getElementById('bacnet-device-name').value,
                port: parseInt(document.getElementById('bacnet-port').value) || 47808,
                nodeId: parseInt(document.getElementById('bacnet-node-id').value) || 1200
            };
            saveConfig('save-bacnet-config', config, 'bacnet-save-status');
        });
    }

    // --- SNMP Trap ---
    const snmptrapSaveBtn = document.getElementById('snmptrap-save-btn');
    if (snmptrapSaveBtn) {
        snmptrapSaveBtn.addEventListener('click', () => {
            const config = {
                enabled: document.getElementById('snmptrap-enable-toggle').checked,
                port: parseInt(document.getElementById('snmptrap-port').value) || 162,
                community: document.getElementById('snmptrap-community').value || 'public'
            };
            saveConfig('save-snmptrap-config', config, 'snmptrap-save-status');
        });
    }

    // --- MQTT Subscriber ---
    const mqttsubSaveBtn = document.getElementById('mqttsub-save-btn');
    if (mqttsubSaveBtn) {
        mqttsubSaveBtn.addEventListener('click', () => {
            const config = {
                enabled: document.getElementById('mqttsub-enable-toggle').checked,
                host: document.getElementById('mqttsub-host').value,
                port: parseInt(document.getElementById('mqttsub-port').value) || 1883,
                topic: document.getElementById('mqttsub-topic').value,
                username: document.getElementById('mqttsub-username')?.value || '',
                password: document.getElementById('mqttsub-password')?.value || '',
                protocol: document.getElementById('mqttsub-protocol')?.value || 'mqtt',
                tls: document.getElementById('mqttsub-tls')?.checked || false
            };
            saveConfig('save-mqttsub-config', config, 'mqttsub-save-status');
        });
    }

    // --- BACnet Subscriber ---
    const bacnetsubSaveBtn = document.getElementById('bacnetsub-save-btn');
    if (bacnetsubSaveBtn) {
        bacnetsubSaveBtn.addEventListener('click', () => {
            const config = {
                enabled: document.getElementById('bacnetsub-enable-toggle').checked,
                port: parseInt(document.getElementById('bacnetsub-port').value) || 47808
            };
            saveConfig('save-bacnetsub-config', config, 'bacnetsub-save-status');
        });
    }

    // --- LoRaWAN ---
    const lorawanSaveBtn = document.getElementById('lorawan-save-btn');
    if (lorawanSaveBtn) {
        lorawanSaveBtn.addEventListener('click', () => {
            const config = {
                enabled: document.getElementById('lorawan-enable-toggle').checked,
                port: parseInt(document.getElementById('lorawan-port').value) || 1700,
                appSKey: document.getElementById('lorawan-appskey').value
            };
            saveConfig('save-lorawan-config', config, 'lorawan-save-status');
        });
    }

    // --- MODBUS Poller ---
    const mbPollerSaveBtn = document.getElementById('mbpoller-save-btn');
    if (mbPollerSaveBtn) {
        mbPollerSaveBtn.addEventListener('click', () => {
            const config = {
                enabled: document.getElementById('mbpoller-enable-toggle').checked,
                ip: document.getElementById('mbpoller-ip').value,
                port: parseInt(document.getElementById('mbpoller-port').value) || 502,
                unitId: parseInt(document.getElementById('mbpoller-unit-id').value) || 1,
                startRegister: parseInt(document.getElementById('mbpoller-start-reg').value) || 0,
                count: parseInt(document.getElementById('mbpoller-count').value) || 10,
                interval: parseInt(document.getElementById('mbpoller-interval').value) || 60
            };
            saveConfig('save-mbpoller-config', config, 'mbpoller-save-status');
        });
    }

// --- Log toggles - FIXED to match actual HTML structure ---
document.addEventListener('click', (e) => {
    const header = e.target.closest('.plugin-log-header');
    if (header) {
        const toggle = header.querySelector('.log-toggle-arrow');
        const pluginName = header.dataset.plugin;
        
        if (!pluginName) {
            console.error('Plugin log header missing data-plugin attribute', header);
            return;
        }
        
        const content = document.querySelector(`.plugin-log-content[data-plugin="${pluginName}"]`);
        if (!content) {
            console.error(`No plugin log content found for plugin: ${pluginName}`);
            return;
        }
        
        // Toggle visibility
        const isCurrentlyHidden = content.style.display === 'none' || content.style.display === '';
        const newDisplay = isCurrentlyHidden ? 'block' : 'none';
        content.style.display = newDisplay;
        
        // Update arrow direction
        if (toggle) {
            toggle.textContent = isCurrentlyHidden ? '▼' : '▶';
        }
        
        console.log(`Plugin log "${pluginName}" ${isCurrentlyHidden ? 'expanded' : 'collapsed'}`);
        e.stopPropagation();
    }
});

    // --- FIX: Handle config load/save responses from main process ---
    
    // Handle config data coming from main
    socket.on('webhooks-config', (config) => {
        document.getElementById('wh-enable-toggle').checked = config.enabled;
        document.getElementById('wh-base-url').value = config.baseUrl || '';
        document.getElementById('wh-auth-toggle').checked = config.auth || false;
        document.getElementById('wh-username').value = config.username || '';
        document.getElementById('wh-password').value = config.password || '';
        updateStatus('wh-status', config);
    });

        // --- Handle save status responses ---
    socket.on('save-status', (data) => {
        console.log('[PLUGINS] Save status received:', data);
        const { plugin, msg } = data;
        
        // Map plugin names to their status element IDs
        const pluginStatusMap = {
            'webhooks': 'wh-save-status',
            'mqtt': 'mqtt-save-status', 
            'bacnet': 'bacnet-save-status',
            'snmptrap': 'snmptrap-save-status',
            'mqtt_subscriber': 'mqttsub-save-status',
            'bacnet_subscriber': 'bacnetsub-save-status',
            'lorawan': 'lorawan-save-status',
            'modbus_poller': 'mbpoller-save-status'
        };
        
        const statusEl = document.getElementById(pluginStatusMap[plugin]);
        if (statusEl) {
            if (msg === 'Saved.') {
                statusEl.textContent = 'Settings saved successfully!';
                statusEl.style.color = 'var(--success-accent)';
                statusEl.className = 'status-message success';
                
                // Clear success message after 3 seconds
                setTimeout(() => {
                    statusEl.textContent = '';
                }, 3000);
            } else if (msg.includes('Error:')) {
                statusEl.textContent = msg.replace('Error: ', '');
                statusEl.style.color = 'var(--danger-accent)';
                statusEl.className = 'status-message error';
            } else {
                statusEl.textContent = msg;
                statusEl.style.color = 'var(--info-accent)';
                statusEl.className = 'status-message';
            }
        }
    });

    socket.on('mqtt-config', (config) => {
        document.getElementById('mqtt-enable-toggle').checked = config.enabled;
        document.getElementById('mqtt-host').value = config.host || '';
        document.getElementById('mqtt-port').value = config.port || 1883;
        document.getElementById('mqtt-client-id').value = config.clientId || '';
        document.getElementById('mqtt-topic').value = config.topic || '';
        document.getElementById('mqtt-username').value = config.username || '';
        document.getElementById('mqtt-password').value = config.password || '';
        document.getElementById('mqtt-protocol').value = config.protocol || 'mqtt';
        document.getElementById('mqtt-tls').checked = config.tls || false;
        updateStatus('mqtt-status', config);
    });

    socket.on('bacnet-config', (config) => {
        document.getElementById('bacnet-enable-toggle').checked = config.enabled;
        document.getElementById('bacnet-device-name').value = config.deviceName || '';
        document.getElementById('bacnet-port').value = config.port || 47808;
        document.getElementById('bacnet-node-id').value = config.nodeId || 1200;
        updateStatus('bacnet-status', config);
    });

    socket.on('snmptrap-config', (config) => {
        document.getElementById('snmptrap-enable-toggle').checked = config.enabled;
        document.getElementById('snmptrap-port').value = config.port || 162;
        document.getElementById('snmptrap-community').value = config.community || 'public';
        updateStatus('snmptrap-status', config);
    });

    socket.on('mqttsub-config', (config) => {
        document.getElementById('mqttsub-enable-toggle').checked = config.enabled;
        document.getElementById('mqttsub-host').value = config.host || '';
        document.getElementById('mqttsub-port').value = config.port || 1883;
        document.getElementById('mqttsub-topic').value = config.topic || '';
        document.getElementById('mqttsub-username').value = config.username || '';
        document.getElementById('mqttsub-password').value = config.password || '';
        document.getElementById('mqttsub-protocol').value = config.protocol || 'mqtt';
        document.getElementById('mqttsub-tls').checked = config.tls || false;
        updateStatus('mqttsub-status', config);
    });

    socket.on('bacnetsub-config', (config) => {
        document.getElementById('bacnetsub-enable-toggle').checked = config.enabled;
        document.getElementById('bacnetsub-port').value = config.port || 47808;
        updateStatus('bacnetsub-status', config);
    });

    socket.on('lorawan-config', (config) => {
        document.getElementById('lorawan-enable-toggle').checked = config.enabled;
        document.getElementById('lorawan-port').value = config.port || 1700;
        document.getElementById('lorawan-appskey').value = config.appSKey || '';
        updateStatus('lorawan-status', config);
    });

    socket.on('mbpoller-config', (config) => {
        document.getElementById('mbpoller-enable-toggle').checked = config.enabled;
        document.getElementById('mbpoller-ip').value = config.ip || '';
        document.getElementById('mbpoller-port').value = config.port || 502;
        document.getElementById('mbpoller-unit-id').value = config.unitId || 1;
        document.getElementById('mbpoller-start-reg').value = config.startRegister || 0;
        document.getElementById('mbpoller-count').value = config.count || 10;
        document.getElementById('mbpoller-interval').value = config.interval || 60;
        updateStatus('mbpoller-status', config);
    });

// Handle log updates - FIXED to use data-plugin selectors
socket.on('webhook-log', (logs) => updateLogContent('webhook', logs));
socket.on('mqtt-log', (logs) => updateLogContent('mqtt', logs));
socket.on('bacnet-log', (logs) => updateLogContent('bacnet', logs));
socket.on('snmptrap-log', (logs) => updateLogContent('snmptrap', logs));
socket.on('mqttsub-log', (logs) => updateLogContent('mqttsub', logs));
socket.on('bacnetsub-log', (logs) => updateLogContent('bacnetsub', logs));
socket.on('lorawan-log', (logs) => updateLogContent('lorawan', logs));
socket.on('mbpoller-log', (logs) => updateLogContent('modbus', logs)); // Special case: mbpoller -> modbus

// FIXED: Use data-plugin selector instead of ID
function updateLogContent(pluginName, logs) {
    const contentEl = document.querySelector(`.plugin-log-content[data-plugin="${pluginName}"]`);
    if (!contentEl) {
        console.error(`[PLUGINS] No log content element found for plugin: ${pluginName}`);
        return;
    }
    
    contentEl.innerHTML = '';
    const maxDisplay = 500;
    const toShow = Array.isArray(logs) ? logs.slice(-maxDisplay) : [];
    toShow.forEach(logEntry => {
        const logDiv = document.createElement('div');
        logDiv.className = `log-entry log-INFO plugin-log plugin-log-${pluginName}`;
        
        // Extract message and timestamp
        const message = logEntry.msg || logEntry.message || 'No message';
        const timestamp = logEntry.ts || logEntry.timestamp || Date.now();
        
        // Create log entry
        logDiv.innerHTML = `<span class="log-timestamp">${new Date(timestamp).toLocaleTimeString()}</span> <span class="log-level">[INFO]</span> ${message}`;
        
        // Prepend to show newest at top
        contentEl.prepend(logDiv);
    });
    
    // Avoid verbose logging in hot paths
}

    // FIX: Explicitly request configs on load
    socket.emit('get-plugin-configs');
});