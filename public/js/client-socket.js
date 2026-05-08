// public/client-socket.js

document.addEventListener('DOMContentLoaded', () => {
    const MAX_LOG_ENTRIES = 500;

    function appendLogAndTruncate(container, entry) {
        if (!container) return;
        container.appendChild(entry);
        const entries = container.querySelectorAll('.log-entry');
        if (entries.length > MAX_LOG_ENTRIES) {
            for (let i = 0; i < entries.length - MAX_LOG_ENTRIES; i++) {
                entries[i].remove();
            }
        }
        requestAnimationFrame(() => {
            if (container) container.scrollTop = container.scrollHeight;
        });
    }

    // --- Socket.IO Event Handlers ---

    // Fix for "Active Plugins" text and Status
    socket.on('plugin-status', (data) => {
        // Update "X Active" text
        if (pluginsActiveList) {
            pluginsActiveList.textContent = data.enabledCount > 0 ? `${data.enabledCount} Active` : 'None';
        }
        
        // Update "Latest Log" text on Plugins page if element exists
        const latestLogEl = document.getElementById('plugin-latest-log');
        if (latestLogEl && data.latestLog) {
            latestLogEl.textContent = data.latestLog;
        }
    });

    // --- Plugin Specific Log Handlers ---
    // These listen for real-time logs from plugins (e.g., BACnet traffic) and display them
    const pluginLogChannels = [
        'webhook-log', 'mqtt-log', 'bacnet-log', 'snmptrap-log',
        'mqttsub-log', 'bacnetsub-log', 'lorawan-log', 'mbpoller-log'
    ];

    pluginLogChannels.forEach(channel => {
        socket.on(channel, (data) => {
            const message = typeof data === 'object' ? data.message : data;
            const timestamp = new Date().toLocaleTimeString();
            const pluginName = channel.replace('-log', '').toUpperCase();

            // 1. Update the "Latest Log" text on the Plugins page immediately
            const latestLogEl = document.getElementById('plugin-latest-log');
            if (latestLogEl) {
                latestLogEl.textContent = `[${timestamp}] ${message}`;
            }

            // 2. Inject into the Main Dashboard Log for visibility
            // This ensures "BACnet Subscriber" activity is seen in the main log window
            if (logContent) {
                const logEntry = document.createElement('div');
                logEntry.className = `log-entry log-INFO plugin-log`;
                logEntry.innerHTML = `<span class="log-timestamp">${timestamp}</span> <span class="log-level">[${pluginName}]</span> ${message}`;
                
                // Respect current filter
                if (logFilterContainer) {
                    const activeFilter = logFilterContainer.querySelector('.active');
                    if (activeFilter && activeFilter.dataset.filter !== 'all' && activeFilter.dataset.filter !== 'info') {
                        logEntry.classList.add('hidden');
                    }
                }
                
                appendLogAndTruncate(logContent, logEntry);
                if (latestLogMessage) {
                    latestLogMessage.textContent = `[${pluginName}] ${message}`;
                    latestLogMessage.className = `log-INFO`;
                }
            }
        });
    });

    // --- NEW: Update Status Handler ---
    socket.on('update-status', (data) => {
        if (updateStatusMessage) {
            updateStatusMessage.textContent = data.message;
            updateStatusMessage.style.color = data.color || 'var(--text-color)';
            
            // Clear previous timeout if exists
            if (window.updateMessageTimeout) clearTimeout(window.updateMessageTimeout);

            // Set a new timeout to clear the message after 15 seconds
            window.updateMessageTimeout = setTimeout(() => {
                if (updateStatusMessage) updateStatusMessage.textContent = '';
            }, 15000);
        }
    });

    // --- NEW: Update Ready Handler (Changes Button Text) ---
    socket.on('update-ready', (data) => {
        if (checkUpdatesBtn) {
            checkUpdatesBtn.textContent = "Restart & Install";
            checkUpdatesBtn.classList.remove('secondary');
            checkUpdatesBtn.classList.add('active'); // Make it look primary/actionable
            checkUpdatesBtn.title = `Install version ${data.version}`;
        }
    });

    socket.on('polling-status', (status) => {
        if (gatewayListContainer) gatewayListContainer.classList.remove('gateway-switch-busy');
        updatePollingButton(status);
    });

    socket.on('active-gateway-applied', () => {
        if (gatewayListContainer) gatewayListContainer.classList.remove('gateway-switch-busy');
    });
    
    socket.on('modbus-data', (data) => {
        latestDeviceData.gateway = data.gateway;
        latestDeviceData.sensors = data.sensors;
        latestDeviceData.inactiveSensors = data.inactiveSensors;
        
        if (data.inactiveSensors && data.inactiveSensors.length > 0) {
            showInactiveBtn.textContent = `Inactive Sensors (${data.inactiveSensors.length})`;
            showInactiveBtn.classList.remove('hidden');
        } else {
            showInactiveBtn.classList.add('hidden');
        }
        
        populateFilterOptions(data.sensors);
        applyFiltersAndRender();

        if (!isDetailViewForExternal && currentDetailsDeviceId != null && !currentDetailsIsGateway) {
            socket.emit('get-device-history', { deviceId: currentDetailsDeviceId, isGateway: false });
        }
    });
    
    socket.on('all-sensor-metadata', (metadata) => {
        sensorMetadata = metadata;
        applyFiltersAndRender();
    });

    socket.on('sensor-metadata-updated', (update) => {
        if (sensorMetadata[update.sensorId]) {
            sensorMetadata[update.sensorId].customName = update.customName;
            sensorMetadata[update.sensorId].colorGroup = update.colorGroup;
        } else {
            sensorMetadata[update.sensorId] = { customName: update.customName, colorGroup: update.colorGroup };
        }
        applyFiltersAndRender();
    });

    // --- New External Metadata Handlers ---
    socket.on('all-external-metadata', (metadata) => {
        externalMetadata = metadata;
        renderExternalDevices(latestExternalDevices);
    });

    socket.on('external-metadata-updated', (update) => {
        if (externalMetadata[update.deviceId]) {
            externalMetadata[update.deviceId].customName = update.customName;
            externalMetadata[update.deviceId].colorGroup = update.colorGroup;
        } else {
            externalMetadata[update.deviceId] = { customName: update.customName, colorGroup: update.colorGroup };
        }
        renderExternalDevices(latestExternalDevices);
    });
    // --- End External Metadata Handlers ---


    socket.on('alert-configs-data', (configs) => {
        alertConfigs = configs;
        applyFiltersAndRender();
    });

    socket.on('log-message', (log) => {
        const logEntry = document.createElement('div');
        const level = log.level.toLowerCase();
        logEntry.className = `log-entry log-${log.level.toUpperCase()}`;
        logEntry.innerHTML = `<span class="log-timestamp">${log.timestamp}</span> <span class="log-level">[${log.level.toUpperCase()}]</span> ${log.message}`;
        
        const activeFilter = logFilterContainer?.querySelector('.active')?.dataset?.filter;
        if (activeFilter && activeFilter !== 'all' && activeFilter !== level) {
            logEntry.classList.add('hidden');
        }
        
        appendLogAndTruncate(logContent, logEntry);
        latestLogMessage.textContent = `[${log.level}] ${log.truncatedMessage}`;
        latestLogMessage.className = `log-${log.level.toUpperCase()}`;
    });

    socket.on('email-settings-saved', (message) => {
        emailTestStatus.textContent = message;
        setTimeout(() => emailTestStatus.textContent = '', 5000);
    });
    
    socket.on('sms-settings-saved', (message) => {
        smsTestStatus.textContent = message;
        setTimeout(() => smsTestStatus.textContent = '', 5000);
    });

    socket.on('alert-message-saved', (message) => {
        alertMessageSaveStatus.textContent = message;
        setTimeout(() => alertMessageSaveStatus.textContent = '', 5000);
    });
    
    socket.on('email-test-status', (response) => {
        emailSpinner.classList.add('hidden');
        emailTestStatus.textContent = response.message;
        emailTestStatus.style.color = response.success ? 'var(--success-accent)' : 'var(--danger-accent)';
    });
    
    socket.on('sms-test-status', (response) => {
        smsSpinner.classList.add('hidden');
        smsTestStatus.textContent = response.message;
        smsTestStatus.style.color = response.success ? 'var(--success-accent)' : 'var(--danger-accent)';
    });
    
    socket.on('system-status-update', (data) => {
        if (data.serverStatus) serverStatus.textContent = `Server: ${data.serverStatus}`;
        if (data.gatewayStatus) gatewayStatus.textContent = `Gateway: ${data.gatewayStatus}`;
        if (data.sensorsStatus) sensorsStatus.textContent = `Sensors: ${data.sensorsStatus}`;
        if (data.alertingStatus) {
            alertingStatus.textContent = `Alerting: ${data.alertingStatus}`;
            alertingStatus.classList.toggle('inactive', data.alertingStatus === 'Inactive');
        }

        const inactiveSystems = [];
        if (serverStatus.textContent.includes('Inactive')) inactiveSystems.push('Server');
        if (gatewayStatus.textContent.includes('Inactive')) inactiveSystems.push('Gateway');
        if (alertingStatus.textContent.includes('Inactive')) inactiveSystems.push('Alerting');

        if(inactiveSystems.length > 0) {
            statusProblemIndicator.classList.remove('hidden');
            document.getElementById('status-problem-message').textContent = `The following systems are inactive: ${inactiveSystems.join(', ')}. Please check the logs and your settings.`;
        } else {
            statusProblemIndicator.classList.add('hidden');
        }
    });

    socket.on('polling-state-change', (data) => {
        infoBar.classList.remove('hidden');
        switch(data.state) {
            case 'detecting':
                if (!isInitialDiscoveryDone) {
                    infoBar.classList.add('is-detecting');
                    pollingStatusContainer.classList.remove('hidden');
                    pollingStatusSpinner.classList.remove('hidden');
                    pollingStatusMessage.textContent = 'Discovering Sensors...';
                    filterContainer.classList.add('hidden');
                }
                break;
            case 'polling':
                isInitialDiscoveryDone = true;
                infoBar.classList.remove('is-detecting');
                pollingStatusSpinner.classList.add('hidden');
                pollingStatusMessage.textContent = `Active Sensors: ${data.activeSensors} / ${data.totalSensors}`;
                filterContainer.classList.remove('hidden');
                break;
            case 'idle':
                isInitialDiscoveryDone = false;
                infoBar.classList.add('hidden');
                 // Clear device display when polling stops or becomes idle
                latestDeviceData.sensors = [];
                latestDeviceData.gateway = {};
                latestDeviceData.inactiveSensors = [];
                applyFiltersAndRender();
                break;
        }
    });
    
    socket.on('gateway-timeout', (data) => {
        timedOutGateway = data;
        let message = `Connection to the gateway at ${data.ip} timed out.`;
        if(data.gatewayId) {
            message = `Connection to Gateway ${data.gatewayId} at ${data.ip} timed out.`;
        }
        timeoutModalMessage.textContent = message;
        timeoutModal.classList.remove('hidden');
        // Main process stops polling and sends polling-status false; no stop-polling emit needed.
    });

    socket.on('current-settings', (settings) => {
        portSettingInput.value = settings.port;
        maxRecordsInput.value = settings.maxRecords;
        repeatAlertIntervalInput.value = settings.repeatAlertInterval || 60;
        
        const repeatMinutes = parseInt(repeatAlertIntervalInput.value, 10);
        if (isNaN(repeatMinutes) || repeatMinutes === 0) {
            alertRepeatNotice.textContent = 'Repeat alerts for persistent conditions are currently disabled.';
        } else {
            alertRepeatNotice.textContent = `Alerts with active triggers are sent every ${repeatMinutes} minutes when a triggering condition persists.`;
        }

            // --- NEW: Hide the automatic updates toggle on Mac ---
        if (settings.platform === 'darwin') {
            const autoUpdateContainer = document.getElementById('auto-update-container');
            if (autoUpdateContainer) {
                autoUpdateContainer.style.display = 'none';
            }
        }
        
        alertingEnabledSwitch.checked = settings.alertingEnabled;
        alertSettingsContainer.classList.toggle('hidden', !settings.alertingEnabled);
        
        emailAlertsEnabledSwitch.checked = settings.emailAlertsEnabled;
        emailSettingsContainer.classList.toggle('hidden', !settings.emailAlertsEnabled);

        smsAlertsEnabledSwitch.checked = settings.smsAlertsEnabled;
        smsSettingsContainer.classList.toggle('hidden', !settings.smsAlertsEnabled);
        
        if(settings.smtpServer) document.getElementById('smtp-server').value = settings.smtpServer;
        if(settings.smtpPort) document.getElementById('smtp-port').value = settings.smtpPort;
        if(settings.smtpUsername) document.getElementById('smtp-username').value = settings.smtpUsername;
        if(settings.smtpPassword) document.getElementById('smtp-password').value = settings.smtpPassword;
        if(settings.smtpFromName) document.getElementById('smtp-from-name').value = settings.smtpFromName;
        if(settings.smtpFromEmail) document.getElementById('smtp-from-email').value = settings.smtpFromEmail;
        if(settings.recipientEmail) document.getElementById('smtp-recipient-email').value = settings.recipientEmail;
        if(settings.textbeltApiKey) document.getElementById('textbelt-api-key').value = settings.textbeltApiKey;
        if(settings.recipientSms) document.getElementById('sms-recipient-phone').value = settings.recipientSms;
        if(settings.alertCustomMessage) alertCustomMessage.value = settings.alertCustomMessage;
        // --- New: Auto Update Toggle ---
        if(autoUpdateToggle) autoUpdateToggle.checked = settings.autoUpdateEnabled;
        
        // --- NEW: Set Version Number dynamically ---
        const versionEl = document.getElementById('app-version');
        if (versionEl && settings.appVersion) {
            versionEl.textContent = `v${settings.appVersion}`;
        }
    });

    socket.on('settings-updated', (message) => {
        settingsSaveStatus.textContent = message;
        repeatAlertSaveStatus.textContent = message;
        
        if (isSavingRepeatAlert) {
            isSavingRepeatAlert = false; // Reset flag
            // Reload after a short delay to allow user to see the "Saved." message.
            setTimeout(() => location.reload(), 500); 
        } else {
            setTimeout(() => {
                settingsSaveStatus.textContent = '';
                repeatAlertSaveStatus.textContent = '';
            }, 5000);
        }
    });
    
    socket.on('known-gateways', (gateways) => {
        const refreshingCard = document.querySelector('.gateway-list-card.refreshing');
        if (refreshingCard) refreshingCard.classList.remove('refreshing');
        
        // FIX: Sort gateways: Active first, then by ID
        gateways.sort((a, b) => {
            if (a.isActive && !b.isActive) return -1;
            if (!a.isActive && b.isActive) return 1;
            return a.gatewayId - b.gatewayId;
        });

        latestDeviceData.gateways = gateways;
        renderGatewayList(gateways);
        updatePollButtonState();
    });

    socket.on('gateway-find-result', (result) => {
        findGatewayStatus.textContent = result.message;
        if(result.success) {
            setTimeout(() => findGatewayModal.classList.add('hidden'), 2000);
        }
    });

    socket.on('scan-status-update', (message) => {
        scanCurrentStatus.textContent = message;
        const logEntry = document.createElement('div');
        logEntry.textContent = message;
        scanProgressLog.appendChild(logEntry);
        scanProgressLog.scrollTop = scanProgressLog.scrollHeight;
    });

    socket.on('scan-results', (gateways) => {
        console.log('[CLIENT] Received scan-results with data:', gateways);
        scanProgressModal.classList.add('hidden'); // Hide progress modal
        findGatewayModal.classList.remove('hidden'); // Show results in find modal

        if (gateways && gateways.length > 0) {
            scanStatus.textContent = `Scan complete. Found ${gateways.length} gateway(s).`;
        } else {
            scanStatus.textContent = 'Scan complete. No verifiable gateways were found on the network.';
        }
        
        // This function is in client-render.js and supports multi-select
        renderScanResults(gateways);
    });

    socket.on('gateway-status-data', (response) => {
        const refreshingCard = document.querySelector('.gateway-list-card.refreshing');
        if (refreshingCard) refreshingCard.classList.remove('refreshing');

        if (rebootingGatewayIp && response.success) {
            clearInterval(rebootCheckInterval);
            clearTimeout(rebootTimeout);
            rebootingGatewayIp = null;
            rebootModal.classList.add('hidden');
            
            const activeSubTab = document.querySelector('.sub-tab-link.active');
            if (activeSubTab && selectedGateway) {
                socket.emit('gateway-get-settings', { ip: selectedGateway.ip, page: activeSubTab.dataset.page });
            }
        }

        if (response.success) {
            renderGatewayStatus(response.data);
            applyReadOnlyState();
        }
        else gatewayConfigContent.innerHTML = `<p class="error">Error: ${response.message}</p>`;
    });

    socket.on('gateway-settings-data', (response) => {
        const refreshingCard = document.querySelector('.gateway-list-card.refreshing');
        if (refreshingCard) refreshingCard.classList.remove('refreshing');

        if (response.success) {
            console.log('Received gateway settings:', response.page, response.settings);
            const page = response.page;
            // Render the correct form first
            const renderFunctions = {
                status: renderGatewayStatus,
                lan: renderGatewayLanSettings,
                wsn: renderGatewayWsnSettings,
                server: renderGatewayServerSettings,
                modbus: renderGatewayModbusSettings,
                snmp: renderGatewaySnmpSettings,
                misc: renderGatewayMiscSettings,
            };
            if(renderFunctions[page]) {
                renderFunctions[page]();
            }

            // Now populate it with the received settings
            const form = gatewayConfigContent.querySelector('form');
            if (form) {
                // FIX: Iterate keys carefully to avoid querySelector errors with special chars like '$$'
                for (const key in response.settings) {
                    try {
                        // Escape special characters for CSS selector if necessary, or use getElementsByName
                        const el = form.querySelector(`[name="${key}"]`);
                        if (el) {
                            if (el.type === 'radio') {
                                 const targetRadio = form.querySelector(`[name="${key}"][value="${response.settings[key]}"]`);
                                 if(targetRadio) targetRadio.checked = true;
                            } else if (el.type === 'checkbox') {
                                el.checked = response.settings[key];
                            } else {
                                el.value = response.settings[key];
                            }
                        }
                    } catch (e) {
                        console.warn(`Could not populate field ${key}:`, e);
                    }
                }
                
                // Manually trigger UI changes that depend on initial values
                if (page === 'snmp') {
                    // FIX: Check the DATA, not the DOM, for the initial toggle state.
                    // The Monnit key for SNMP Trap Enable is '$$1356'
                    const trapValue = response.settings['$$1356'];
                    const isEnabled = trapValue === '1';
                    document.querySelectorAll('.snmp-trap-option').forEach(el => {
                        el.classList.toggle('hidden', !isEnabled);
                    });
                }
            }
             if(page === 'status') {
                renderGatewayStatus(response.settings);
            }
            applyReadOnlyState();

        } else {
             if (!rebootingGatewayIp) { // Only show error if not expecting a reboot
                gatewayConfigContent.innerHTML = `<p class="error">Error: ${response.message}</p>`;
            }
        }
    });

    
    socket.on('gateway-reboot-status', (response) => {
        if (response.success && response.ip) {
            handleGatewayReboot(response.ip);
        } else {
            showInfoModal('Reboot Failed', response.message);
        }
    });
    
    socket.on('gateway-save-status', (response) => {
        // The optimistic UI feedback is already handled. We only need to act on failure.
        if (!response.success) {
            // A save failed. Stop the optimistic reboot process and show an error.
            if (rebootCheckInterval) clearInterval(rebootCheckInterval);
            if (rebootTimeout) clearTimeout(rebootTimeout);
            rebootingGatewayIp = null;
            rebootModal.classList.add('hidden');

            showInfoModal('Save Failed', response.message);
            
            // On failure, reload the settings from the gateway to restore the form
            const activeSubTab = document.querySelector('.sub-tab-link.active');
            if (activeSubTab && selectedGateway) {
                socket.emit('gateway-get-settings', { ip: selectedGateway.ip, page: activeSubTab.dataset.page });
            }
        }
        // If successful, do nothing. The reboot handler is already running and will refresh settings.
    });
    
    socket.on('device-history-data', (response) => {
        if (response && response.records) {
            if (!isDetailViewForExternal && currentDetailsDeviceId != null && String(response.deviceId) === String(currentDetailsDeviceId) && response.isGateway === currentDetailsIsGateway) {
                renderHistory(response.records, response.isGateway, response.gatewayInfo);
                if (document.getElementById('details-tab-charts')?.classList.contains('active')) {
                    renderChart();
                }
                if (document.getElementById('details-tab-alert-history')?.classList.contains('active')) {
                    renderAlertHistory(response.records);
                }
            }
        } else if (!isDetailViewForExternal && currentDetailsDeviceId != null && String(response?.deviceId) === String(currentDetailsDeviceId)) {
            renderHistory([], response?.isGateway ?? false);
        }
    });

    // --- New: External Device History Handler ---
    socket.on('external-device-history-data', (response) => {
        if (!response || !response.deviceId) return;
        if (isDetailViewForExternal && currentDetailsExternalDeviceId === response.deviceId) {
            renderExternalHistory(response.deviceId, response.records || []);
        }
    });

    socket.on('modbus-register-data', (response) => {
        // Clear timeout since we received a response
        if (readRegisterTimeout) clearTimeout(readRegisterTimeout);

        const container = document.getElementById('modbus-results-container');
        if (response.success) {
            const getInterp = typeof window.getModbusRegisterInterpretation === 'function' ? window.getModbusRegisterInterpretation : () => ({ formula: '—', humanReadable: '' });
            let tableHtml = `
                <div class="history-table-container">
                    <table id="modbus-register-table" class="history-table">
                        <thead>
                            <tr><th>Register</th><th>Value (Decimal)</th><th>Value (Hex)</th><th>Conversion Formula</th><th>Human Readable</th></tr>
                        </thead>
                        <tbody>
            `;
            response.registers.forEach((value, index) => {
                const register = response.start + index;
                const interp = getInterp(register, value, response.registers, response.start, response.registers.length);
                tableHtml += `
                    <tr>
                        <td>${register}</td>
                        <td>${value}</td>
                        <td>0x${value.toString(16).toUpperCase().padStart(4, '0')}</td>
                        <td>${interp.formula}</td>
                        <td>${interp.humanReadable}</td>
                    </tr>
                `;
            });
            tableHtml += '</tbody></table></div>';
            container.innerHTML = tableHtml;
        } else {
            container.innerHTML = `<p class="no-data-message" style="color: var(--danger-accent);">${response.message}</p>`;
        }
    });

    socket.on('no-active-gateway', () => {
        if (gatewayListContainer) gatewayListContainer.classList.remove('gateway-switch-busy');
        setPollConnecting(false);
        showInfoModal(
            'No Active Gateway',
            'Please go to the Gateway Settings tab and use the toggle to select an active gateway before starting to poll.'
        );
    });

    socket.on('modbus-disabled-blocking-start', (data) => {
        if (gatewayListContainer) gatewayListContainer.classList.remove('gateway-switch-busy');
        setPollConnecting(false);
        modbusBlockingGatewayIp = data?.ip || null;
        const modal = document.getElementById('modbus-disabled-blocking-modal');
        const statusEl = document.getElementById('modbus-blocking-status');
        const enableBtn = document.getElementById('modbus-blocking-enable-btn');
        if (modal) {
            if (statusEl) {
                statusEl.classList.add('hidden');
                statusEl.textContent = '';
            }
            if (enableBtn) enableBtn.disabled = false;
            modal.classList.remove('hidden');
        }
    });

    socket.on('request-poll-start', () => {
        setPollConnecting(true);
        socket.emit('start-polling');
    });

    socket.on('setup-modbus-enabled-success', () => {
        if (modbusBlockingGatewayIp) {
            const statusEl = document.getElementById('modbus-blocking-status');
            const enableBtn = document.getElementById('modbus-blocking-enable-btn');
            if (statusEl) {
                statusEl.classList.remove('hidden');
                statusEl.textContent = 'Command accepted. Gateway is rebooting. This may take up to 2 minutes. Checking connectivity...';
                statusEl.style.color = 'var(--success-accent)';
            }
            if (enableBtn) enableBtn.disabled = true;
            let attempts = 0;
            const maxAttempts = 24;
            let pollIntervalId = null;
            let checkIntervalId = null;
            const stopWaiting = () => {
                if (pollIntervalId) clearInterval(pollIntervalId);
                if (checkIntervalId) clearInterval(checkIntervalId);
                pollIntervalId = null;
                checkIntervalId = null;
            };
            pollIntervalId = setInterval(() => {
                attempts++;
                if (statusEl) statusEl.textContent = `Checking connectivity... (Attempt ${attempts}/${maxAttempts})`;
                socket.emit('refresh-gateway-status', modbusBlockingGatewayIp);
                if (attempts >= maxAttempts) {
                    stopWaiting();
                    modbusBlockingGatewayIp = null;
                    if (statusEl) statusEl.textContent = 'Gateway did not respond in time. Please try Start Polling manually.';
                    if (enableBtn) enableBtn.disabled = false;
                }
            }, 5000);
            setTimeout(() => {
                checkIntervalId = setInterval(() => {
                    if (!modbusBlockingGatewayIp) {
                        stopWaiting();
                        return;
                    }
                    const gw = latestDeviceData.gateways.find(g => g.ip === modbusBlockingGatewayIp);
                    if (gw && gw.isModbusActive) {
                        stopWaiting();
                        modbusBlockingGatewayIp = null;
                        const modal = document.getElementById('modbus-disabled-blocking-modal');
                        if (modal) modal.classList.add('hidden');
                        setPollConnecting(true);
                        socket.emit('start-polling');
                    }
                }, 3000);
            }, 30000);
        }
    });

    socket.on('setup-modbus-enabled-fail', (data) => {
        if (modbusBlockingGatewayIp) {
            const statusEl = document.getElementById('modbus-blocking-status');
            const enableBtn = document.getElementById('modbus-blocking-enable-btn');
            if (statusEl) {
                statusEl.classList.remove('hidden');
                statusEl.textContent = `Failed: ${data?.message || 'Unknown error'}. Please enable MODBUS TCP manually.`;
                statusEl.style.color = 'var(--danger-accent)';
            }
            if (enableBtn) enableBtn.disabled = false;
        }
    });
    
    socket.on('set-active-failed', (data) => {
        if (gatewayListContainer) gatewayListContainer.classList.remove('gateway-switch-busy');
        showInfoModal('Activation Failed', data.message);
    });

    socket.on('gateways-reset-success', () => {
        location.reload();
    });

    socket.on('color-groups-reset-success', () => {
        showInfoModal('Success', 'All sensor color groups have been reset.');
        // The 'all-sensor-metadata' event will trigger a re-render.
    });
    
    socket.on('sensor-names-reset-success', () => {
        showInfoModal('Success', 'All custom sensor names have been reset.');
    });
    
    // --- New: Listen for external device data ---
    socket.on('external-devices-data', renderExternalDevices);

});