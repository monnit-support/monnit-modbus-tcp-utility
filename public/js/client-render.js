// public/client-render.js

// --- UI Rendering Functions ---

function applyFiltersAndRender() {
    const sensors = latestDeviceData.sensors || [];
    const gateway = latestDeviceData.gateway;
    
    // FIX: Robust check for active edits in the Monnit container
    if (deviceCardsContainer.querySelector('.sensor-name-input')) {
        console.log("Skipping Monnit render due to active edit.");
        return;
    }

    deviceCardsContainer.innerHTML = '';
    
    let filteredSensors = sensors;
    const typeVal = typeFilter.value;
    const awareVal = awareFilter.value;
    const batteryVal = batteryFilter.value;
    const signalVal = signalFilter.value;
    const colorGroupVal = colorGroupFilter.value;


    if (typeVal !== 'all') {
        filteredSensors = filteredSensors.filter(s => parseSensorData(s).name === typeVal);
    }
    if (awareVal !== 'all') {
        filteredSensors = filteredSensors.filter(s => (s.isAware ? 'aware' : 'not-aware') === awareVal);
    }
    if (batteryVal === 'low') {
        filteredSensors = filteredSensors.filter(s => s.batteryPercentage < 20);
    }
    if (signalVal === 'low') {
        filteredSensors = filteredSensors.filter(s => s.rssi < 40);
    }
    if (colorGroupVal !== 'all') {
        const currentMeta = sensorMetadata || {};
        filteredSensors = filteredSensors.filter(s => {
            const meta = currentMeta[s.sensorId] || {};
            return (meta.colorGroup || 'none') === colorGroupVal;
        });
    }

    
    const isListView = deviceCardsContainer.classList.contains('list-view');
    
    // Always render Gateway card first if polling
    if (isPolling && gateway && gateway.gatewayId) {
        const gwData = latestDeviceData.gateways.find(g => g.gatewayId === gateway.gatewayId);
        const readOnlyHtml = gwData && gwData.isReadOnly ? '<span class="readonly-badge">Read-Only</span>' : '';
        const modbusHtml = gwData && gwData.isModbusActive === 0 ? '<span class="modbus-disabled-badge">MODBUS Disabled</span>' : '';
        const defaultServerHtml = gwData ? createDefaultServerBadge(gwData.defaultServerStatus) : '<div class="badge-placeholder"></div>';


        const deviceCard = document.createElement('div');
        deviceCard.className = 'device-card gateway-card';
        deviceCard.dataset.deviceId = gateway.gatewayId;
        deviceCard.dataset.isGateway = 'true';
        
        if(isListView) {
                deviceCard.innerHTML = `
                <div class="status-indicator gateway"></div>
                <div class="list-item-group gateway-group">
                    <span>Gateway ${gateway.gatewayId}</span>
                    <span>${gwData ? gwData.ip : 'N/A'}</span>
                    <span>FW: ${gwData ? gwData.firmwareVersion : 'N/A'}</span>
                </div>
                <div class="list-item"><span>Gateway</span></div>
                <div class="list-item"><span>-</span></div>
                <div class="list-item"><span>-</span></div>
                <div class="list-item"><span>-</span></div>
                <div class="list-item"><span>-</span></div>
                <div class="list-item"><span>-</span></div>
                <div class="gateway-card-badges" style="flex-direction: row; gap: 5px; align-items: center; justify-content: flex-start;">
                    ${readOnlyHtml}
                    ${modbusHtml}
                    ${defaultServerHtml}
                </div>
            `;
        } else {
            deviceCard.innerHTML = `
                <div class="card-header">
                    <h4>Gateway ${gateway.gatewayId}</h4>
                    <div class="gateway-card-badges">
                        ${readOnlyHtml ? `<div>${readOnlyHtml}</div>` : '<div class="badge-placeholder"></div>'}
                        ${modbusHtml ? `<div>${modbusHtml}</div>` : '<div class="badge-placeholder"></div>'}
                        ${defaultServerHtml}
                    </div>
                </div>
                <div class="sensor-data-grid">
                    <p><strong>IP Address:</strong> ${gwData ? gwData.ip : 'N/A'}</p>
                    <p><strong>Sensors:</strong> ${sensors.length}</p>
                    <p><strong>MAC Address:</strong> ${gwData ? gwData.macAddress : 'N/A'}</p>
                    <p><strong>Firmware:</strong> ${gwData ? gwData.firmwareVersion : gateway.firmwareVersion}</p>
                </div>
            `;
        }
        deviceCardsContainer.appendChild(deviceCard);
    }

    if (isListView) {
        const header = document.createElement('div');
        header.className = 'list-view-header';
        const sortArrow = (key) => currentSort.key === key ? (currentSort.direction === 'asc' ? '▲' : '▼') : '';
        header.innerHTML = `
            <div></div>
            <div class="header-group">
                <span class="sortable" data-sort="sensorId">Sensor ID <span class="sort-arrow">${sortArrow('sensorId')}</span></span>
                <span class="sortable" data-sort="reading">Reading <span class="sort-arrow">${sortArrow('reading')}</span></span>
                <span class="sortable" data-sort="lastCheckin">Last Check-in <span class="sort-arrow">${sortArrow('lastCheckin')}</span></span>
            </div>
            <div class="sortable" data-sort="type">Type <span class="sort-arrow">${sortArrow('type')}</span></div>
            <div class="sortable" data-sort="data">Raw Data <span class="sort-arrow">${sortArrow('data')}</span></div>
            <div class="sortable" data-sort="isAware">Aware <span class="sort-arrow">${sortArrow('isAware')}</span></div>
            <div class="sortable" data-sort="dataAge">Age(s) <span class="sort-arrow">${sortArrow('dataAge')}</span></div>
            <div class="sortable" data-sort="batteryPercentage">Batt <span class="sort-arrow">${sortArrow('batteryPercentage')}</span></div>
            <div class="sortable" data-sort="rssi">Signal <span class="sort-arrow">${sortArrow('rssi')}</span></div>
            <div>Alerts</div>
        `;
        deviceCardsContainer.appendChild(header);
    }

    sortSensors(filteredSensors);

    function formatAlertInfo(parsed, alertConfig) {
        if (!alertConfig.isEnabled) return '';
        const datum = (parsed.chartableData || [])[alertConfig.dataIndex ?? 0];
        const cond = alertConfig.condition || 'above';
        const thresh = alertConfig.threshold;
        const condText = cond === 'above' ? 'above' : cond === 'below' ? 'below' : cond === 'equal' ? 'equals' : 'not equals';
        if (datum) {
            const label = datum.label || 'Value';
            if (datum.valueType === 'discrete' && datum.options) {
                const opt = datum.options.find(o => Number(o.value) === Number(thresh));
                const threshLabel = opt ? opt.label : String(thresh);
                return `Alert when ${label} ${condText} ${threshLabel}`;
            }
            const unit = datum.unit ? ` ${datum.unit}` : '';
            return `Alert when ${label} ${condText} ${thresh}${unit}`;
        }
        return `Alerting ${cond} ${thresh}`;
    }

    filteredSensors.forEach(sensor => {
        const parsed = parseSensorData(sensor);
        const colorClass = getSensorColorClassName(parsed.name);
        const alertConfig = alertConfigs[sensor.sensorId] || {};
        const metadata = sensorMetadata[sensor.sensorId] || {};
        const lastCheckinDate = new Date(sensor.lastCheckin);
        const formattedDate = lastCheckinDate.toLocaleString([], {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        const deviceCard = document.createElement('div');
        deviceCard.className = `device-card sensor-card ${colorClass} color-group-${metadata.colorGroup || 'none'}`;
        deviceCard.dataset.deviceId = sensor.sensorId;
        deviceCard.dataset.isGateway = 'false';
        deviceCard.dataset.isExternal = 'false'; 

        if (isListView) {
            deviceCard.innerHTML = `
                <div class="status-indicator ${sensor.isAware ? 'aware' : 'not-aware'}"></div>
                <div class="list-item-group">
                    <span>${sensor.sensorId}</span>
                    <span>${parsed.displayString}</span>
                    <span>${formattedDate}</span>
                </div>
                <div class="list-item"><span>${parsed.name}</span></div>
                <div class="list-item raw-data-cell"><span>${sensor.data.join(', ')}</span></div>
                <div class="list-item"><span>${sensor.isAware ? 'Yes' : 'No'}</span></div>
                <div class="list-item"><span>${sensor.dataAge}s</span></div>
                <div class="list-item"><span>${sensor.batteryPercentage}%</span></div>
                <div class="list-item"><span>${sensor.rssi}%</span></div>
                <div class="card-header-controls">
                        <button class="icon-button alert-toggle-btn ${alertConfig.isEnabled ? 'active' : ''}" title="${alertConfig.isEnabled ? 'Disable' : 'Enable'} Alerts" data-sensor-id="${sensor.sensorId}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                    </button>
                    <button class="icon-button alert-config-btn" title="Configure Alert" data-sensor-id="${sensor.sensorId}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                </div>
            `;
        } else { // Card View
            const activeBadgeHtml = '<span class="active-badge">Active</span>';
            const nameText = metadata.customName || 'Click to add name';
            const nameClass = metadata.customName ? '' : 'placeholder';

            deviceCard.innerHTML = `
                <div class="card-header">
                    <div style="flex-grow: 1; overflow: hidden;">
                        <h4>${parsed.name}</h4>
                        <p class="sensor-id-text">ID: ${sensor.sensorId}</p>
                        <div class="sensor-name-container" data-sensor-id="${sensor.sensorId}" data-is-external="false" style="width: 100%; display: flex; align-items: center;">
                            <button class="icon-button edit-name-btn" title="Edit Name" style="margin-right: 5px;">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <span class="sensor-custom-name ${nameClass}" title="${nameText}" style="flex: 1; min-width: 0;">${nameText}</span>
                        </div>
                    </div>
                    <div class="card-header-controls" style="flex-shrink: 0; display: flex; align-items: center; gap: 5px; min-width: 90px; justify-content: flex-end;">
                            <button class="icon-button alert-toggle-btn ${alertConfig.isEnabled ? 'active' : ''}" title="${alertConfig.isEnabled ? 'Disable' : 'Enable'} Alerts" data-sensor-id="${sensor.sensorId}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                        </button>
                        <button class="icon-button alert-config-btn" title="Configure Alert" data-sensor-id="${sensor.sensorId}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <div class="status-indicator ${sensor.isAware ? 'aware' : 'not-aware'}"></div>
                    </div>
                </div>
                    <div class="card-sub-header">
                    <select class="color-group-selector" data-sensor-id="${sensor.sensorId}" data-is-external="false">
                        <option value="none" ${!metadata.colorGroup || metadata.colorGroup === 'none' ? 'selected' : ''}>No Group</option>
                        <option value="teal" ${metadata.colorGroup === 'teal' ? 'selected' : ''}>Teal</option>
                        <option value="magenta" ${metadata.colorGroup === 'magenta' ? 'selected' : ''}>Magenta</option>
                        <option value="coral" ${metadata.colorGroup === 'coral' ? 'selected' : ''}>Coral</option>
                        <option value="gold" ${metadata.colorGroup === 'gold' ? 'selected' : ''}>Gold</option>
                        <option value="olive" ${metadata.colorGroup === 'olive' ? 'selected' : ''}>Olive</option>
                    </select>
                    <div class="active-badge-container">${activeBadgeHtml}</div>
                </div>
                <div class="parsed-data">
                    <p>${parsed.displayString}</p>
                </div>
                    ${alertConfig.isEnabled ? `<p class="alert-info-text">${formatAlertInfo(parsed, alertConfig)}</p>` : ''}
                    ${alertConfig.isEnabled && alertConfig.lastAlertTimestamp ? `<p class="last-alert-time">Last alert: ${new Date(alertConfig.lastAlertTimestamp * 1000).toLocaleString()}</p>`: ''}
                <div class="sensor-footer-data">
                    <p class="full-width-item"><strong>Last Check-in:</strong> ${formattedDate}</p>
                    <p><strong>Data Age:</strong> ${sensor.dataAge}s</p>
                    <p><strong>Slot:</strong> ${sensor.slot}</p>
                    <p><strong>Signal:</strong> ${sensor.rssi}%</p>
                    <p><strong>Battery:</strong> ${sensor.batteryPercentage}%</p>
                </div>
            `;
        }
        deviceCardsContainer.appendChild(deviceCard);
    });
    
    if (filteredSensors.length === 0 && (!isPolling || !gateway || !gateway.gatewayId)) {
        const hasConfiguredGateways = (latestDeviceData.gateways || []).length > 0;
        const msg = hasConfiguredGateways && !isPolling
            ? 'Polling is stopped. Click Start Polling for live sensor data, or use Gateway Settings and MODBUS Registers while idle.'
            : 'Start polling to see device data.';
        deviceCardsContainer.innerHTML = `<p class="no-data-message">${msg}</p>`;
    }
}

// FIX: Updated to support multi-select add
function renderScanResults(gateways) {
    if (!scanResultsContainer) return;
    
    scanResultsContainer.innerHTML = '';
    
    // Add "Add Selected" button controls if in the dashboard context
    // We check if the modal is the Dashboard one by ID
    const isDashboardModal = document.getElementById('find-gateway-modal') && 
                             document.getElementById('find-gateway-modal').classList.contains('modal'); // Basic check

    if (isDashboardModal) {
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'scan-controls';
        controlsDiv.style.marginBottom = '10px';
        controlsDiv.style.display = 'flex';
        controlsDiv.style.justifyContent = 'flex-end';
        controlsDiv.innerHTML = `<button id="add-selected-gateways-btn" class="button">Add Selected</button>`;
        scanResultsContainer.appendChild(controlsDiv);
    }

    if (!gateways || gateways.length === 0) {
        const msg = document.createElement('p');
        msg.textContent = 'No gateways found.';
        msg.style.textAlign = 'center';
        msg.style.color = 'var(--subtle-text-color)';
        scanResultsContainer.appendChild(msg);
        return;
    }

    const list = document.createElement('div');
    list.className = 'scan-result-list';
    
    gateways.forEach(gw => {
        const item = document.createElement('div');
        item.className = 'scan-result-item setup-card';
        item.dataset.ip = gw.ip; 
        
        item.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px; width:100%;">
                <input type="checkbox" class="scan-checkbox" value="${gw.ip}" data-id="${gw.gatewayId}" style="width: 20px; height: 20px;">
                <div class="scan-result-details" style="flex-grow: 1;">
                    <strong>Gateway ID: ${gw.gatewayId}</strong>
                    <small>IP: ${gw.ip}</small>
                    <small>MAC: ${gw.macAddress || 'Unknown'}</small>
                </div>
            </div>
        `;
        list.appendChild(item);
    });
    
    scanResultsContainer.appendChild(list);
}

function renderGatewayList(gateways) {
    gatewayListContainer.innerHTML = '';
    if (gateways.length === 0) {
        gatewayListContainer.innerHTML = '<p>No gateways found. Use the button below to find new gateways.</p>';
        selectedGateway = null;
    } else {
        // FIX: Sort Active Gateways to the top
        gateways.sort((a, b) => {
            if (a.isActive && !b.isActive) return -1;
            if (!a.isActive && b.isActive) return 1;
            return a.gatewayId - b.gatewayId;
        });

        gateways.forEach(gw => {
            const card = document.createElement('div');
            card.className = `gateway-list-card ${gw.isActive ? 'active-for-polling' : ''}`;
            card.dataset.ip = gw.ip;
            card.dataset.id = gw.gatewayId;

            if (selectedGateway && gw.gatewayId == selectedGateway.id) {
                card.classList.add('selected');
            }

            const unlockedStatusClass = gw.isUnlocked ? 'unlocked' : 'locked';
            const unlockedStatusText = gw.isUnlocked ? 'UNLOCKED' : 'LOCKED';
            const lockedInfoBtn = !gw.isUnlocked ? ` <button class="info-icon-btn gateway-locked-info-trigger" title="How to Unlock Gateway">i</button>` : '';
            
            const readOnlyHtml = gw.isReadOnly ? `
                <div class="status-badge-container">
                    <span class="readonly-badge">Read-Only</span>
                    <button class="info-icon-btn write-access-info-trigger" title="How to Enable Write-Access">i</button>
                </div>
            ` : '<div class="badge-placeholder"></div>';

            const modbusHtml = gw.isModbusActive === 0 ? `
                <div class="status-badge-container">
                    <span class="modbus-disabled-badge">MODBUS Disabled</span>
                    <button class="info-icon-btn modbus-disabled-info-trigger" title="MODBUS TCP Disabled">i</button>
                </div>
            ` : '<div class="badge-placeholder"></div>';
            
            const defaultServerHtml = createDefaultServerBadge(gw.defaultServerStatus);

            card.innerHTML = `
                <div class="gateway-card-header">
                    <h4>Gateway ID: ${gw.gatewayId}</h4>
                        <div class="gateway-card-badges">
                        ${readOnlyHtml}
                        ${modbusHtml}
                        ${defaultServerHtml}
                    </div>
                </div>
                <p>IP Address: ${gw.ip}</p>
                <p>MAC: ${gw.macAddress || 'Unknown'}</p>
                <p>Firmware: ${gw.firmwareVersion}</p>
                <p>Unlock Status: <span class="unlock-status ${unlockedStatusClass}">${unlockedStatusText}</span>${lockedInfoBtn}</p>
                <div class="gateway-card-controls">
                    <label for="active-toggle-${gw.gatewayId}">Active Gateway</label>
                    <label class="switch">
                        <input type="checkbox" id="active-toggle-${gw.gatewayId}" class="active-gateway-toggle" data-id="${gw.gatewayId}" ${gw.isActive ? 'checked' : ''}>
                        <span class="slider round"></span>
                    </label>
                </div>
            `;
            gatewayListContainer.appendChild(card);
        });
    }
}

function renderGatewayStatus(data) {
    currentGatewayStatusData = data;
    const deviceListHtml = data.wireless.devices.map(d => `
        <tr>
            <td>${d.slot}</td>
            <td>${d.deviceId}</td>
        </tr>
    `).join('');

    const gwData = latestDeviceData.gateways.find(g => g.gatewayId == selectedGateway.id);
    const readOnlyHtml = gwData && gwData.isReadOnly ? `<div class="status-item"><span>Access Mode</span><span style="color: var(--warning-accent); font-weight: bold;">Read Only</span></div>` : '';

    gatewayConfigContent.innerHTML = `
        <div class="gateway-status-grid">
            <div class="status-section">
                <h4>Ethernet LAN</h4>
                <div class="status-item"><span>Physical Address</span><span>${data.lan.physicalAddress}</span></div>
                <div class="status-item"><span>IP Address</span><span>${data.lan.ipAddress}</span></div>
                <div class="status-item"><span>Subnet Mask</span><span>${data.lan.subnetMask}</span></div>
                <div class="status-item"><span>Default Gateway</span><span>${data.lan.defaultGateway}</span></div>
                <div class="status-item"><span>DNS Server</span><span>${data.lan.dnsServer}</span></div>
            </div>
            <div class="status-section">
                <h4>Gateway Services</h4>
                <div class="status-item"><span>Default Server</span><span>${data.services.defaultServer}</span></div>
                <div class="status-item"><span>SNTP</span><span>${data.services.sntp}</span></div>
                <div class="status-item"><span>Modbus TCP</span><span>${data.services.modbusTcp}</span></div>
                <div class="status-item"><span>SNMP</span><span>${data.services.snmp}</span></div>
            </div>
                <div class="status-section">
                <h4>Wireless Network</h4>
                <div class="status-item"><span>Data cache used</span><span>${data.wireless.dataCacheUsed}</span></div>
                <div class="status-item"><span>Total wireless devices</span><span>${data.wireless.totalWirelessDevices}</span></div>
            </div>
                <div class="status-section">
                <h4>System</h4>
                <div class="status-item"><span>Firmware Version</span><span>${data.firmware}</span></div>
                ${readOnlyHtml}
                <button id="reboot-gateway-btn" class="button" style="margin-top: 20px; width: 100%;">Reboot Gateway</button>
            </div>
            <div class="status-section" style="grid-column: span 2;">
                <h4>Connected Devices</h4>
                <div class="history-table-container" style="max-height: 250px;">
                    <table class="history-table">
                        <thead><tr><th>Slot</th><th>Device ID</th></tr></thead>
                        <tbody>${deviceListHtml}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderSensorList() {
    sensorListContent.innerHTML = `
        <p class="settings-note info">This is a list of sensors authorized to connect with the gateway, not necessarily sensors currently connected. You may see sensor IDs from factory testing; these can be removed. Devices are managed under <strong>Gateway Settings > Wireless Network</strong>.</p>
    `;
    if (!currentGatewayStatusData) {
        sensorListContent.innerHTML += '<p class="no-data-message">Sensor list data not available. Please check the Status tab first.</p>';
        return;
    }

    const devices = currentGatewayStatusData.wireless.devices;
    const deviceListHtml = devices.map(d => `
        <tr>
            <td>${d.slot}</td>
            <td>${d.deviceId}</td>
        </tr>
    `).join('');

    sensorListContent.innerHTML += `
        <div class="history-table-container">
            <table class="history-table">
                <thead><tr><th>Slot</th><th>Device ID</th></tr></thead>
                <tbody>${deviceListHtml}</tbody>
            </table>
        </div>
    `;
}

// FIX: Updated to include dynamic sensor dropdown
function renderModbusRegisters() {
    // 1. Build the list of active sensors for the dropdown
    let sensorOptions = '<option value="">Select a Sensor...</option>';
    if (latestDeviceData.sensors && latestDeviceData.sensors.length > 0) {
        // Sort by slot for easier finding
        const sortedSensors = [...latestDeviceData.sensors].sort((a, b) => a.slot - b.slot);
        sortedSensors.forEach(s => {
            // Try to find a custom name
            const meta = sensorMetadata[s.sensorId] || {};
            const name = meta.customName || `Sensor ${s.sensorId}`;
            sensorOptions += `<option value="${s.slot}">Slot ${s.slot}: ${name}</option>`;
        });
    } else {
        sensorOptions += '<option disabled>No cached sensors — start polling to list slots, or use Custom range</option>';
    }

    modbusRegistersContent.innerHTML = `
        <div id="modbus-controls" class="modbus-controls-panel">
            <div class="form-group">
                <label for="register-type">Target</label>
                <select id="register-type">
                    <option value="gateway">Gateway Status (Reg 0-4)</option>
                    <option value="sensor">Specific Sensor Slot</option>
                    <option value="custom">Custom Range</option>
                </select>
            </div>
            
            <div class="form-group hidden" id="sensor-select-group">
                <label for="modbus-sensor-select">Select Sensor</label>
                <select id="modbus-sensor-select">
                    ${sensorOptions}
                </select>
            </div>

            <div class="form-group" id="register-range-start-group">
                <label for="register-range-start">Start Register</label>
                <input type="number" id="register-range-start" value="0" min="0">
            </div>
            <div class="form-group" id="register-range-count-group">
                <label for="register-range-count">Count</label>
                <input type="number" id="register-range-count" value="5" min="1" max="100">
            </div>
            
            <div class="form-group" style="align-self: flex-end;">
                <button id="read-registers-btn" class="button">Read Registers</button>
            </div>
        </div>
        
        <div id="modbus-results-container">
            <p class="no-data-message">Select a target and click "Read Registers" to view live MODBUS TCP data.</p>
        </div>
    `;
}

function renderGatewayLanSettings() {
    gatewayConfigContent.innerHTML = `
        <div class="gateway-settings-form-container">
            <form id="lan-settings-form">
                <div class="status-section">
                    <h4>Local Area Network Settings</h4>
                    <table class="gateway-settings-table">
                        <tbody>
                            <tr><td>IP Address</td><td><input name="$$1712"></td></tr>
                            <tr><td>Subnet Mask</td><td><input name="$$1713"></td></tr>
                            <tr><td>Default Gateway</td><td><input name="$$1714"></td></tr>
                            <tr><td>DNS Server</td><td><input name="$$1715"></td></tr>
                        </tbody>
                    </table>
                    <p class="settings-note">For DHCP: set all fields to 0.0.0.0</p>
                </div>
                    <div class="status-section">
                    <h4>HTTP Interface Settings</h4>
                    <table class="gateway-settings-table">
                        <tbody>
                            <tr>
                                <td>HTTP Interface</td>
                                <td>
                                    <input type="radio" id="httpe" name="a" value="1"> <label for="httpe">Enable</label>
                                    <br>
                                    <input type="radio" id="nhttpe" name="a" value="0"> <label for="nhttpe">Disable</label>
                                </td>
                            </tr>
                            <tr>
                                <td>Configuration Timeout</td>
                                <td>
                                    <select id="cp" name="$$1219">
                                        <option value="0">Read Only</option>
                                        <option value="60">1 Minute</option>
                                        <option value="300">5 Minutes</option>
                                        <option value="1800">30 Minutes</option>
                                        <option value="65535">Always Available</option>
                                    </select>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="form-buttons">
                    <input type="submit" class="button" value="Save Changes">
                </div>
            </form>
        </div>
    `;
}

function renderGatewayWsnSettings() {
        gatewayConfigContent.innerHTML = `
        <div class="gateway-settings-form-container">
            <div class="settings-grid">
                <div class="status-section">
                    <h4>Add Device to Network</h4>
                    <form id="wsn-add-form">
                        <table class="gateway-settings-table">
                            <tbody>
                                <tr><td>Device ID</td><td><input name="$$2120"></td></tr>
                                <tr><td>Security Code</td><td><input name="$$262107"></td></tr>
                                <tr><td>Slot Index [1-256] (Optional)</td><td><input type="number" name="$$221f" min="1" max="256"></td></tr>
                            </tbody>
                        </table>
                        <div class="form-buttons"> <button type="submit" class="button">Add Device</button> </div>
                    </form>

                    <h4 style="margin-top:20px;">Remove Device From Network</h4>
                    <form id="wsn-remove-form">
                            <table class="gateway-settings-table">
                            <tbody><tr><td>Device ID</td><td><input name="remove-device-id"></td></tr></tbody>
                        </table>
                        <div class="form-buttons"><button type="submit" class="button secondary">Remove</button></div>
                    </form>
                </div>
                <div class="status-section">
                    <h4>Network Management</h4>
                    <div class="management-section">
                        <h5>Reform Network</h5>
                        <p>This will reset the list of all devices known to the gateway.</p>
                        <button id="reform-network-btn" class="button secondary">Reform Now</button>
                    </div>
                        <div class="management-section">
                        <h5>Create Network Backup</h5>
                        <p>Download the current list of devices.</p>
                        <a href="/download-netlist?ip=${selectedGateway.ip}&id=${selectedGateway.id}" class="button secondary">Click to Download</a>
                    </div>
                        <div class="management-section">
                        <h5>Restore Network Backup</h5>
                        <p>Upload a previously saved network list.</p>
                        <input type="file" id="NLR" accept=".xml">
                        <div id="ldr"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderGatewayServerSettings() {
    gatewayConfigContent.innerHTML = `
        <div class="gateway-settings-form-container">
            <form id="server-settings-form">
                <div class="status-section">
                    <h4>Default Server Settings</h4>
                    <table class="gateway-settings-table">
                        <tbody>
                            <tr>
                                <td>Default Server</td>
                                <td>
                                    <input type="radio" id="servere" name="o" value="1"> <label for="servere">Enable</label><br>
                                    <input type="radio" id="ndse" name="o" value="0"> <label for="ndse">Disable</label>
                                </td>
                            </tr>
                            <tr><td>Server Address</td><td><input name="$$164320"></td></tr>
                            <tr><td>Server Port</td><td><input type="number" name="$$1241"></td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="status-section">
                    <h4>Server Communication Settings</h4>
                    <table class="gateway-settings-table">
                        <tbody>
                            <tr><td>Gateway Heartbeat (Minutes)</td><td><input type="number" id="hbm" name="$$113f" step="0.01"></td></tr>
                            <tr>
                                <td>On Aware Messages</td>
                                <td>
                                    <select id="ca" name="$$1242">
                                        <option value="0">Wait for Heartbeat</option>
                                        <option value="1">Trigger Heartbeat</option>
                                    </select>
                                </td>
                            </tr>
                                <tr>
                                <td>On Server Loss</td>
                                <td>
                                        <select id="cs" name="$$133d">
                                        <option value="0">Log Sensor Data</option>
                                        <option value="1">Disable Wireless Network</option>
                                    </select>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="form-buttons"><input type="submit" class="button" value="Save Changes"></div>
            </form>
        </div>
    `;
}

function renderGatewayModbusSettings() {
    gatewayConfigContent.innerHTML = `
            <div class="gateway-settings-form-container">
            <form id="modbus-settings-form">
                <div class="status-section">
                    <h4>Modbus TCP Settings</h4>
                        <table class="gateway-settings-table">
                        <tbody>
                            <tr>
                                <td>Modbus TCP Interface</td>
                                <td>
                                    <input type="radio" id="modbe" name="o" value="1"> <label for="modbe">Enable</label><br>
                                    <input type="radio" id="nmodbe" name="o" value="0"> <label for="nmodbe">Disable</label>
                                </td>
                            </tr>
                            <tr><td>TCP Timeout (Minutes)</td><td><input type="number" name="$$124a" step="0.1"></td></tr>
                            <tr><td>Port</td><td><input type="number" name="$$124b"></td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="form-buttons"> <input type="submit" class="button" value="Save Changes"> </div>
            </form>
        </div>
    `;
}

function renderGatewaySnmpSettings() {
    gatewayConfigContent.innerHTML = `
        <div class="gateway-settings-form-container">
            <form id="snmp-settings-form">
                    <div class="status-section">
                    <h4>Simple Network Management Protocol v1 Settings</h4>
                    <table class="gateway-settings-table">
                        <tbody>
                            <tr>
                                <td>SNMP Interface</td>
                                <td>
                                    <input type="radio" id="snmpe" name="o" value="1"> <label for="snmpe">Enable</label><br>
                                    <input type="radio" id="nsnmpe" name="o" value="0"> <label for="nsnmpe">Disable</label>
                                </td>
                            </tr>
                            <tr>
                                <td>Inbound IP Address Range<br><small>(Start/End are inclusive)</small></td>
                                <td>
                                    <label>Starting Address</label>
                                    <input id="st" name="$$1744">
                                    <label style="margin-top: 10px;">Ending Address</label>
                                    <input id="end" name="$$1745">
                                </td>
                            </tr>
                            <tr><td>Inbound Port</td><td><input type="number" name="$$1247"></td></tr>
                            <tr><td>Community String</td><td><input name="$$164920"></td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="status-section">
                    <h4>Trap Settings</h4>
                    <table class="gateway-settings-table">
                        <tbody>
                            <tr>
                                <td>Traps</td>
                                <td>
                                    <select id="snmp-traps-enable" name="$$1356"> <option value="0">Disable</option> <option value="1">Enable</option> </select>
                                </td>
                            </tr>
                            <tr class="snmp-trap-option hidden"><td>&emsp;on Authentication Failure</td><td><select name="$$1357"><option value="0">Disable</option><option value="1">Enable</option></select></td></tr>
                            <tr class="snmp-trap-option hidden"><td>&emsp;on New Sensor Data</td><td><select name="$$1358"><option value="0">Disable</option><option value="1">Enable</option></select></td></tr>
                            <tr class="snmp-trap-option hidden"><td>&emsp;on Sensor Alarms</td><td><select name="$$1359"><option value="0">Disable</option><option value="1">Enable</option></select></td></tr>
                            <tr class="snmp-trap-option hidden"><td>Trap IP Address</td><td><input name="$$164620"></td></tr>
                            <tr class="snmp-trap-option hidden"><td>Trap Port</td><td><input type="number" name="$$1248"></td></tr>
                        </tbody>
                    </table>
                </div>
                    <div class="status-section">
                    <h4>MIB-II System Configuration Strings</h4>
                    <table class="gateway-settings-table">
                        <tbody>
                            <tr><td>Contact String</td><td><input name="$$164c30"></td></tr>
                            <tr><td>Name String</td><td><input name="$$164d30"></td></tr>
                            <tr><td>Location String</td><td><input name="$$164e30"></td></tr>
                            <tr><td>Description String</td><td><input name="$$164f30"></td></tr>
                        </tbody>
                    </table>
                </div>
                <div class="form-buttons"><input type="submit" class="button" value="Save Changes"></div>
            </form>
        </div>
    `;
}

function renderGatewayMiscSettings() {
        gatewayConfigContent.innerHTML = `
        <div class="gateway-settings-form-container">
            <form id="misc-settings-form">
                <div class="status-section">
                    <h4>Simple Network Time Protocol Settings</h4>
                    <table class="gateway-settings-table">
                            <tbody>
                            <tr>
                                <td>SNTP Interface</td>
                                <td>
                                    <input type="radio" id="sntpe" name="b" value="1"> <label for="sntpe">Enable</label><br>
                                    <input type="radio" id="nsntpe" name="b" value="0"> <label for="nsntpe">Disable</label>
                                </td>
                            </tr>
                            <tr><td>Server IP Address</td><td><input name="$$171a"></td></tr>
                            <tr><td>Update Interval (Minutes)</td><td><input type="number" name="$$1237"></td></tr>
                        </tbody>
                    </table>
                </div>
                    <div class="status-section">
                    <h4>Interface Data Management</h4>
                    <table class="gateway-settings-table">
                        <tbody><tr><td>Data Expiration (Hrs)</td><td><input type="number" name="$$123b"></td></tr></tbody>
                    </table>
                </div>
                    <div class="status-section">
                    <h4>Auto Reboot Settings</h4>
                    <table class="gateway-settings-table">
                        <tbody><tr><td>Auto Reset (Hrs)</td><td><input type="number" name="$$1238"></td></tr></tbody>
                    </table>
                </div>
                <div class="form-buttons"><input type="submit" class="button" value="Save Changes"></div>
            </form>
                <div class="status-section" style="margin-top: 20px;">
                <h4>Reset Memory</h4>
                <div class="form-buttons" style="justify-content: flex-start; gap: 20px;">
                    <button id="reset-data-memory" class="button secondary">Reset Data Memory</button>
                    <button id="reset-config-memory" class="button secondary">Reset Configuration Memory</button>
                </div>
            </div>
        </div>
    `;
}

function applyReadOnlyState() {
    const existingBanner = gatewayConfigContent.querySelector('.readonly-banner');
    if (existingBanner) existingBanner.remove();
    gatewayConfigContent.classList.remove('is-read-only');

    const selectedGwData = latestDeviceData.gateways.find(g => g.gatewayId == selectedGateway?.id);
    
    if (selectedGwData && selectedGwData.isReadOnly) {
        const banner = document.createElement('div');
        banner.className = 'readonly-banner';
        banner.innerHTML = `
            <span>Access Restricted: These settings are Read-Only.</span>
            <button id="write-access-info-btn-banner" class="info-icon-btn" title="How to Enable Write-Access">i</button>
        `;
        gatewayConfigContent.prepend(banner);

        const activeTab = document.querySelector('.sub-tab-link.active');
        if (activeTab && activeTab.dataset.page !== 'status') {
                gatewayConfigContent.classList.add('is-read-only');
        }
    }
}

/**
 * Renders the full history for a Monnit sensor.
 */
function renderHistory(records, isGateway) {
    // FIX: Safety check for records - DEFAULT TO EMPTY ARRAY IF UNDEFINED OR NULL
    // FIX: THIS LINE IS CRITICAL TO PREVENT THE CRASH
    if (!records) records = []; 
    
    console.log(`[CLIENT] renderHistory called with ${records.length} records.`);
    currentHistoryData = records;

    // Robust Date Parsing with Defaults
    let startTimestamp = 0;
    let endTimestamp = Date.now();

    if (startDateInput && startDateInput.value) {
        const d = new Date(startDateInput.value);
        if (!isNaN(d.getTime())) startTimestamp = d.getTime();
    }
    
    if (endDateInput && endDateInput.value) {
        const d = new Date(endDateInput.value);
        if (!isNaN(d.getTime())) endTimestamp = d.getTime() + (24 * 60 * 60 * 1000 - 1000); // End of day
    }

    let filteredRecords = records;
    try {
        filteredRecords = records.filter(rec => {
            const recDate = rec.timestamp * 1000;
            return recDate >= startTimestamp && recDate <= endTimestamp;
        });
    } catch (e) {
        console.error("Error filtering history records:", e);
        // Fallback to showing everything if filter crashes
        filteredRecords = records;
    }

    // Clear content first to remove "Loading..."
    historyContent.innerHTML = '';

    if (filteredRecords.length === 0 && !isGateway) {
        historyContent.innerHTML = '<p class="no-data-message">No historical data found for this device in the selected date range.</p>';
        // Re-add date pickers
        if (chartControls && historyContent.parentNode.contains(chartControls) === false) {
             // Only prepend if it's not already there or we are creating fresh
             historyContent.prepend(chartControls);
        } else if (chartControls) {
             historyContent.prepend(chartControls);
        }
        return;
    }
    
    let tableHtml;
    if (isGateway) {
        tableHtml = `
            <h3>Recent Sensor Activity</h3>
            <p>Showing the last 100 readings from all sensors connected to this gateway.</p>
        `;
    } else {
            tableHtml = '';
    }

    tableHtml += `
        <div class="history-table-container">
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Sensor ID</th>
                        <th>Reading</th>
                        <th>Voltage</th>
                        <th>RSSI</th>
                        <th>Aware</th>
                        <th>Alert</th>
                    </tr>
                </thead>
                <tbody>
    `;
    filteredRecords.forEach(rec => {
        let parsedData, rawData;
        try {
            if (typeof rec.rawData === 'string' && rec.rawData.trim() !== '') {
                rawData = JSON.parse(rec.rawData);
            } else {
                throw new Error("Raw data is not a valid string.");
            }

            const tempSensor = {
                deviceType: rec.deviceType,
                data: rawData
            };
            parsedData = parseSensorData(tempSensor);

            tableHtml += `
                <tr>
                    <td>${new Date(rec.timestamp * 1000).toLocaleString()}</td>
                    <td>${rec.sensorId}</td>
                    <td>${parsedData.displayString}</td>
                    <td>${rec.voltage.toFixed(2)}V</td>
                    <td>${rec.rssi}%</td>
                    <td>${rec.isAware ? 'Yes' : 'No'}</td>
                    <td>${rec.alertTriggered ? 'Sent' : ''}</td>
                </tr>
            `;
        } catch (error) {
            console.error('[CLIENT] Failed to parse record in renderHistory:', rec, error);
            tableHtml += `
                <tr>
                    <td>${new Date(rec.timestamp * 1000).toLocaleString()}</td>
                    <td>${rec.sensorId}</td>
                    <td colspan="5">Error parsing data for this entry.</td>
                </tr>
            `;
        }
    });
    tableHtml += '</tbody></table></div>';
    historyContent.innerHTML = tableHtml;
    // Re-add date pickers at the top
    if(chartControls) historyContent.prepend(chartControls);
}

/**
 * Renders the *alert* history for a Monnit sensor.
 */
function renderAlertHistory(records) {
    // FIX: Safety check
    if (!records) records = [];
    console.log(`[CLIENT] renderAlertHistory called with ${records.length} records.`);

    // Robust Date Parsing with Defaults
    let startTimestamp = 0;
    let endTimestamp = Date.now();

    if (startDateInput && startDateInput.value) {
        const d = new Date(startDateInput.value);
        if (!isNaN(d.getTime())) startTimestamp = d.getTime();
    }
    
    if (endDateInput && endDateInput.value) {
        const d = new Date(endDateInput.value);
        if (!isNaN(d.getTime())) endTimestamp = d.getTime() + (24 * 60 * 60 * 1000 - 1000);
    }
    
    const filteredRecords = records.filter(rec => {
        const recDate = rec.timestamp * 1000;
        // Filter for alerts AND date range
        return rec.alertTriggered === 1 && recDate >= startTimestamp && recDate <= endTimestamp;
    });

    // Clear content first
    alertHistoryContent.innerHTML = '';

    if (filteredRecords.length === 0) {
        alertHistoryContent.innerHTML = '<p class="no-data-message">No alert data found for this device in the selected date range.</p>';
        if(chartControls) alertHistoryContent.prepend(chartControls); // Re-add date pickers
        return;
    }
    
    let tableHtml = `
        <div class="history-table-container">
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Sensor ID</th>
                        <th>Reading</th>
                        <th>Voltage</th>
                        <th>RSSI</th>
                        <th>Aware</th>
                        <th>Alert</th>
                    </tr>
                </thead>
                <tbody>
    `;
    filteredRecords.forEach(rec => {
        let parsedData, rawData;
        try {
            if (typeof rec.rawData === 'string' && rec.rawData.trim() !== '') {
                rawData = JSON.parse(rec.rawData);
            } else {
                throw new Error("Raw data is not a valid string.");
            }

            const tempSensor = {
                deviceType: rec.deviceType,
                data: rawData
            };
            parsedData = parseSensorData(tempSensor);

            tableHtml += `
                <tr>
                    <td>${new Date(rec.timestamp * 1000).toLocaleString()}</td>
                    <td>${rec.sensorId}</td>
                    <td>${parsedData.displayString}</td>
                    <td>${rec.voltage.toFixed(2)}V</td>
                    <td>${rec.rssi}%</td>
                    <td>${rec.isAware ? 'Yes' : 'No'}</td>
                    <td>${rec.alertTriggered ? 'Sent' : ''}</td>
                </tr>
            `;
        } catch (error) {
            console.error('[CLIENT] Failed to parse record in renderAlertHistory:', rec, error);
            tableHtml += `
                <tr>
                    <td>${new Date(rec.timestamp * 1000).toLocaleString()}</td>
                    <td>${rec.sensorId}</td>
                    <td colspan="5">Error parsing data for this entry.</td>
                </tr>
            `;
        }
    });
    tableHtml += '</tbody></table></div>';
    alertHistoryContent.innerHTML = tableHtml;
    if(chartControls) alertHistoryContent.prepend(chartControls); // Re-add date pickers
}

/**
 * Renders the history for an external device
 */
function renderExternalHistory(deviceId, records) {
    // FIX: Safety check for records - DEFAULT TO EMPTY ARRAY IF UNDEFINED
    if (!records) records = [];

    currentExternalHistoryData = { deviceId, records };
    currentHistoryData = []; // Clear Monnit history

    // Robust Date Parsing with Defaults
    let startTimestamp = 0;
    let endTimestamp = Date.now();

    if (startDateInput && startDateInput.value) {
        const d = new Date(startDateInput.value);
        if (!isNaN(d.getTime())) startTimestamp = d.getTime();
    }
    
    if (endDateInput && endDateInput.value) {
        const d = new Date(endDateInput.value);
        if (!isNaN(d.getTime())) endTimestamp = d.getTime() + (24 * 60 * 60 * 1000 - 1000);
    }
    
    let filteredRecords = records;
    try {
         filteredRecords = records.filter(rec => {
            const recDate = rec.timestamp * 1000;
            return recDate >= startTimestamp && recDate <= endTimestamp;
        });
    } catch (e) {
        console.error("Error filtering external history:", e);
        filteredRecords = records;
    }
   

    // Clear content first
    historyContent.innerHTML = '';

    if (filteredRecords.length === 0) {
        historyContent.innerHTML = '<p class="no-data-message">No historical data found for this device in the selected date range.</p>';
        if(chartControls) historyContent.prepend(chartControls); // Re-add date pickers
        return;
    }

    let tableHtml = `
        <div class="history-table-container">
            <table class="history-table external-history-table">
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Label</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Helper to recursively parse JSON objects
    const addRows = (data, timestamp) => {
        if (data === null || typeof data !== 'object') {
            tableHtml += `<tr><td>${timestamp}</td><td>Payload</td><td>${data}</td></tr>`;
            return;
        }

        for (const [key, value] of Object.entries(data)) {
            const displayValue = (typeof value === 'object') ? JSON.stringify(value) : value;
            tableHtml += `<tr>
                <td>${timestamp}</td>
                <td>${key}</td>
                <td>${displayValue}</td>
            </tr>`;
        }
    };

    filteredRecords.forEach(rec => {
        try {
            const timestamp = new Date(rec.timestamp * 1000).toLocaleString();
            const data = JSON.parse(rec.data);
            
            // The stored data is { topic, payload } or { type, source, ... }
            // We want to iterate over the *content* of the data.
            addRows(data, timestamp);

        } catch (error) {
            console.error('[CLIENT] Failed to parse external record:', rec, error);
            tableHtml += `
                <tr>
                    <td>${new Date(rec.timestamp * 1000).toLocaleString()}</td>
                    <td colspan="2">Error parsing data for this entry.</td>
                </tr>
            `;
        }
    });

    tableHtml += '</tbody></table></div>';
    historyContent.innerHTML = tableHtml;
    if(chartControls) historyContent.prepend(chartControls); // Re-add date pickers
}

/**
 * Renders the details for an external device
 */
function renderExternalDetails(deviceId) {
    const device = latestExternalDevices.find(d => d.id === deviceId);
    if (!device) {
        detailsContent.innerHTML = '<p class="no-data-message">Could not find device details.</p>';
        return;
    }

    let detailsHtml = '<div class="gateway-status-grid">'; // Reuse gateway status styling
    let lastData = {};
    try {
        lastData = JSON.parse(device.lastData);
    } catch (e) {
        lastData = { error: "Could not parse lastData JSON." };
    }

    // --- General Details ---
    detailsHtml += `
        <div class="status-section">
            <h4>Device Information</h4>
            <div class="status-item"><span>Device ID</span><span>${device.id}</span></div>
            <div class="status-item"><span>Protocol</span><span>${device.type}</span></div>
            <div class="status-item"><span>Last Seen</span><span>${new Date(device.lastSeen * 1000).toLocaleString()}</span></div>
        </div>
    `;

    // --- Protocol-Specific Details ---
    let protocolDetails = '';
    if (device.type === 'MQTT Subscriber' && lastData.topic) {
        protocolDetails = `
            <div class="status-item"><span>MQTT Topic</span><span>${lastData.topic}</span></div>
        `;
    } else if (device.type === 'SNMP Trap' && lastData.source) {
        protocolDetails = `
            <div class="status-item"><span>Source IP</span><span>${lastData.source}</span></div>
            <div class="status-item"><span>SNMP Type</span><span>${lastData.type}</span></div>
            <div class="status-item"><span>Enterprise OID</span><span>${lastData.enterprise || 'N/A'}</span></div>
        `;
    } else if (device.type === 'BACnet Subscriber' && lastData.address) {
            protocolDetails = `
            <div class="status-item"><span>Source IP</span><span>${lastData.address}</span></div>
            <div class="status-item"><span>Device Instance</span><span>${lastData.instance}</span></div>
            <div class="status-item"><span>Vendor ID</span><span>${lastData.vendorId}</span></div>
        `;
    } else if (device.type === 'LoRaWAN' && lastData.devAddr) { // ADDED LoRaWAN
            protocolDetails = `
            <div class="status-item"><span>Gateway IP</span><span>${lastData.gatewayIP}</span></div>
            <div class="status-item"><span>Device Addr</span><span>${lastData.devAddr}</span></div>
            <div class="status-item"><span>Spreading Factor</span><span>${lastData.spreadingFactor}</span></div>
            <div class="status-item"><span>Bandwidth</span><span>${lastData.bandwidth}</span></div>
            <div class="status-item"><span>RSSI</span><span>${lastData.rssi}</span></div>
            <div class="status-item"><span>SNR</span><span>${lastData.snr}</span></div>
        `;
    }
    
    if (protocolDetails) {
            detailsHtml += `
            <div class="status-section">
                <h4>Protocol Details</h4>
                ${protocolDetails}
            </div>
        `;
    }

    // --- Last Data Payload ---
    detailsHtml += `
        <div class="status-section" style="grid-column: span 2;">
            <h4>Last Received Data</h4>
            <pre class="external-data-display">${JSON.stringify(lastData, null, 2)}</pre>
        </div>
    `;

    detailsHtml += '</div>'; // Close gateway-status-grid
    detailsContent.innerHTML = detailsHtml;
}

function renderChart() {
    const chartContainer = document.querySelector('#charts-content .chart-container');
    console.log(`[CLIENT] renderChart called with ${currentHistoryData.length} records.`);

    if (historyChart) {
        historyChart.destroy();
    }
    
    const canvas = document.createElement('canvas');
    canvas.id = 'history-chart';
    chartContainer.innerHTML = '';
    chartContainer.appendChild(canvas);


    const startDate = startDateInput.value ? new Date(startDateInput.value).getTime() : 0;
    // Use 23:59:59 of the end date to include the full day
    const endDate = endDateInput.value ? new Date(endDateInput.value).getTime() + (24 * 60 * 60 * 1000 - 1000) : Date.now();

    const filteredRecords = currentHistoryData.filter(rec => {
        const recDate = rec.timestamp * 1000;
        return recDate >= startDate && recDate <= endDate;
    });

    const datasets = {};
    const colors = ['#0a84ff', '#30d158', '#ff9f0a', '#ff453a', '#bf5af2', '#64d2ff'];

    filteredRecords.forEach(rec => {
        try {
            if (typeof rec.rawData !== 'string' || rec.rawData.trim() === '') {
                throw new Error("Raw data is not a valid string.");
            }
            const rawData = JSON.parse(rec.rawData);
            const timestamp = rec.timestamp * 1000;
            const tempSensor = { deviceType: rec.deviceType, data: rawData };
            const parsed = parseSensorData(tempSensor);
            
            if (parsed.chartableData && parsed.chartableData.length > 0) {
                parsed.chartableData.forEach(cd => {
                    if (!datasets[cd.label]) {
                        datasets[cd.label] = {
                            label: cd.label,
                            data: [],
                            borderColor: colors[Object.keys(datasets).length % colors.length],
                            backgroundColor: colors[Object.keys(datasets).length % colors.length] + '33',
                            tension: 0.1,
                            fill: false
                        };
                    }
                    datasets[cd.label].data.push({ x: timestamp, y: cd.value });
                });
            }
        } catch (error) {
                console.error('[CLIENT] Failed to parse record for chart:', rec, error);
        }
    });
    
    if (Object.keys(datasets).length === 0) {
        chartContainer.innerHTML = '<p class="no-data-message">No chartable data available for this sensor or selected date range.</p>';
        return;
    }
    
    const ctx = document.getElementById('history-chart').getContext('2d');
    historyChart = new Chart(ctx, {
        type: 'line',
        data: { datasets: Object.values(datasets) },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'day' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: 'var(--subtle-text-color)' }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: 'var(--subtle-text-color)' }
                }
            },
            plugins: {
                legend: {
                    labels: { color: 'var(--text-color)' }
                }
            }
        }
    });
}

/**
 * Renders the cards for external (non-Monnit) devices.
 * @param {Array<object>} devices - An array of device objects from the external_devices table.
 */
function renderExternalDevices(devices) {
    if (!externalDeviceCardsContainer) return;
    
    // Update cache regardless of render status so details view is fresh
    latestExternalDevices = devices; 

    // Check if an edit is currently in progress within this container
    if (externalDeviceCardsContainer.querySelector('.sensor-name-input')) {
        console.log("Skipping External Device render due to active edit.");
        return; 
    }

    // NEW CHECK: Check if a dropdown (select) is focused to prevent closing on re-poll
    if (document.activeElement && document.activeElement.tagName === 'SELECT' && externalDeviceCardsContainer.contains(document.activeElement)) {
         console.log("Skipping External Device render due to active dropdown interaction.");
         return;
    }

    // ALWAYS set to list view, per user request
    externalDeviceCardsContainer.className = 'list-view';

    externalDeviceCardsContainer.innerHTML = '';

    if (!devices || devices.length === 0) {
        externalDeviceCardsContainer.innerHTML = '<p class="no-data-message">No external devices found. Enable a "Receive" plugin to see devices here.</p>';
        return;
    }

    // Group devices by type
    const grouped = {};
    devices.forEach(device => {
        if (!grouped[device.type]) grouped[device.type] = [];
        grouped[device.type].push(device);
    });
    
    // Sort groups by device count
    const groupsArray = Object.entries(grouped);
    groupsArray.sort((a, b) => a[1].length - b[1].length);

    // Render each group
    groupsArray.forEach(([type, typeDevices]) => {
        // Create the group wrapper div
        const groupWrapper = document.createElement('div');
        const groupClass = `group-${type.toLowerCase().replace(/ /g, '-')}`;
        groupWrapper.className = `external-device-group ${groupClass}`;

        // Add type header
        const header = document.createElement('h3');
        header.className = 'external-device-type-header';
        header.textContent = `${type} (${typeDevices.length} Devices)`;
        groupWrapper.appendChild(header);
        
        // Create a container for the cards
        const cardGrid = document.createElement('div');
        cardGrid.className = 'list-view'; 
        groupWrapper.appendChild(cardGrid); 

        // UPDATED: Create a common header using the new unified grid class
        const listHeader = document.createElement('div');
        listHeader.className = 'list-view-header external-device-grid';
        listHeader.style.padding = '10px';
        
        listHeader.innerHTML = `
            <div></div> <!-- Status Indicator spacer -->
            <span>Device ID / Name</span>
            <span>Last Data</span>
            <span>Last Seen</span>
            <span>Protocol</span>
            <span style="text-align: right;">Customization</span>
        `;
        cardGrid.appendChild(listHeader);

        // Add cards for each device
        typeDevices.forEach(device => {
            const deviceId = device.id;
            const metadata = externalMetadata[deviceId] || {};
            const colorClass = getSensorColorClassName('external'); 
            const card = document.createElement('div');
            
            card.className = `device-card sensor-card ${colorClass} color-group-${metadata.colorGroup || 'none'} external-device-grid`;
            card.dataset.deviceId = deviceId;
            card.dataset.isGateway = 'false';
            card.dataset.isExternal = 'true';

            const lastSeen = new Date(device.lastSeen * 1000).toLocaleString();
            const defaultName = device.name || 'External Device';
            const customName = metadata.customName || defaultName;
            const nameClass = metadata.customName ? '' : 'placeholder';

            let dataDisplay = 'No data';
            if (device.lastData) {
                try {
                    const parsed = JSON.parse(device.lastData);
                    
                    if (parsed.payload) {
                        if (typeof parsed.payload === 'object') {
                            if (parsed.payload.deviceType !== undefined && parsed.payload.data !== undefined) {
                                const sensorData = parseSensorData(parsed.payload);
                                dataDisplay = sensorData.displayString;
                            } else {
                                const firstKey = Object.keys(parsed.payload)[0];
                                if(firstKey) {
                                    let firstValue = parsed.payload[firstKey];
                                    if (typeof firstValue === 'object') firstValue = JSON.stringify(firstValue);
                                    dataDisplay = `${firstKey}: ${firstValue}`; 
                                } else {
                                    dataDisplay = 'Empty Payload';
                                }
                            }
                        } else {
                            dataDisplay = `Payload: ${parsed.payload}`;
                        }
                    }
                    
                    else if (parsed.varbinds) dataDisplay = `OID: ${Object.keys(parsed.varbinds)[0] || 'N/A'}`;
                    else if (parsed.address) dataDisplay = `Addr: ${parsed.address}`;
                    else if (parsed.devAddr) dataDisplay = `DevAddr: ${parsed.devAddr}`;
                    else dataDisplay = device.lastData;

                    if (dataDisplay.length > 50) dataDisplay = dataDisplay.substring(0, 50) + '...';
                } catch (e) {
                    dataDisplay = 'Error parsing data';
                }
            }

            // UPDATED: Build the list view row using the grid structure directly
            card.innerHTML = `
                <div class="status-indicator external"></div>
                
                <div class="sensor-name-container" data-sensor-id="${deviceId}" data-is-external="true" style="min-width: 0;">
                    <button class="icon-button edit-name-btn" title="Edit Name" style="margin-right: 5px; flex-shrink: 0;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <span class="sensor-custom-name ${nameClass}" title="${defaultName}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${customName}</span>
                </div>

                <span title="${dataDisplay}" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${dataDisplay}</span>
                
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${lastSeen}</span>
                
                <span>${device.type}</span>
                
                <div style="display: flex; justify-content: flex-end;">
                     <select class="color-group-selector" data-sensor-id="${deviceId}" data-is-external="true" style="width: 100%;">
                        <option value="none" ${!metadata.colorGroup || metadata.colorGroup === 'none' ? 'selected' : ''}>No Group</option>
                        <option value="teal" ${metadata.colorGroup === 'teal' ? 'selected' : ''}>Teal</option>
                        <option value="magenta" ${metadata.colorGroup === 'magenta' ? 'selected' : ''}>Magenta</option>
                        <option value="coral" ${metadata.colorGroup === 'coral' ? 'selected' : ''}>Coral</option>
                        <option value="gold" ${metadata.colorGroup === 'gold' ? 'selected' : ''}>Gold</option>
                        <option value="olive" ${metadata.colorGroup === 'olive' ? 'selected' : ''}>Olive</option>
                    </select>
                </div>
            `;

            cardGrid.appendChild(card); 
        });
        
        externalDeviceCardsContainer.appendChild(groupWrapper);
    });
}