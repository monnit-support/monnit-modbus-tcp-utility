// public/client-core.js
// parseSensorData from sensor-parser.js (loaded before this script)

// --- Global Scope Declarations ---
var socket;

// --- DOM Elements (Declared Globally) ---
var pollButton, deviceCardsContainer, externalDeviceCardsContainer, logContent;
var mainDashboardView, deviceDetailsView;
var tabs, tabContents;
var serverStatus, gatewayStatus, sensorsStatus, alertingStatus, statusBar, statusHeader, statusToggleArrow, statusProblemIndicator;
var portSettingInput, maxRecordsInput, saveSettingsBtn, settingsSaveStatus, alertingEnabledSwitch, resetGatewaysBtn, resetAlertsBtn, resetColorGroupsBtn, resetNamesBtn, repeatAlertIntervalInput, repeatAlertInfoBtn, saveRepeatAlertBtn, repeatAlertSaveStatus, pluginsActiveList;
var logFilterContainer, logHeader, logToggle, latestLogMessage;
var findGatewayBtn, findGatewayModal, closeModalBtn, addManuallyToggle, manualAddContainer, manualAddType, ipInputContainer, macInputContainer, findByMacBtn, macAddressInput, findByIpBtn, ipAddressInput, findGatewayStatus, gatewayListContainer, gatewayConfigContainer, gatewayConfigContent, subTabs, scanNetworkBtn, scanStatus, scanResultsContainer, gatewayInfoBtn, gatewayInfoModal, closeGatewayInfoModalBtn, writeAccessInfoModal, closeWriteAccessInfoModalBtn;
var discoverSensorsBtn, showInactiveBtn, inactiveSensorsModal, inactiveSensorsList, closeInactiveModalBtn;
var backToDashboardBtn, detailsDeviceId, historyContent, alertHistoryContent, detailsContent, sensorListContent, modbusRegistersContent, detailsTabsContainer, detailsTabs, exportCsvBtn;
var chartControls, startDateInput, endDateInput;
var infoBar, pollingStatusContainer, pollingStatusSpinner, pollingStatusMessage, cardViewBtn, listViewBtn;
var filterContainer, typeFilter, awareFilter, batteryFilter, signalFilter, colorGroupFilter, resetFiltersBtn;
var confirmModal, confirmModalTitle, confirmModalMessage, confirmOkBtn, confirmCancelBtn;
var infoModal, infoModalTitle, infoModalMessage, infoOkBtn;
var timeoutModal, timeoutModalMessage, timeoutRetryBtn, timeoutRemoveBtn;
var alertSettingsContainer, emailAlertsEnabledSwitch, smsAlertsEnabledSwitch, emailSettingsContainer, smsSettingsContainer, saveEmailSettingsBtn, sendTestEmailBtn, emailTestStatus, saveSmsSettingsBtn, sendTestSmsBtn, smsTestStatus, alertCustomMessage, saveAlertMessageBtn, alertMessageSaveStatus, charLimitWarning, emailSpinner, smsSpinner;
var alertConfigModal, alertConfigTitle, alertDatumSelect, alertCondition, alertThreshold, alertThresholdDiscrete, saveAlertConfigBtn, cancelAlertConfigBtn;
var scanProgressModal, scanCurrentStatus, scanProgressLog, cancelScanBtn;
var rebootModal;
var statusProblemModal, repeatAlertInfoModal, alertRepeatNotice;
// --- NEW: Update Elements ---
var checkUpdatesBtn, autoUpdateToggle, updateStatusMessage;

// --- State (Declared Globally) ---
var isPolling = false;
var selectedGateway = null;
var isDetailViewForGateway = false;
var isDetailViewForExternal = false;
var currentDetailsDeviceId = null;
var currentDetailsIsGateway = false;
var currentDetailsExternalDeviceId = null;
var latestDeviceData = { gateways: [], gateway: {}, sensors: [], inactiveSensors: [] };
var latestExternalDevices = [];
var sensorMetadata = {};
var externalMetadata = {};
var currentHistoryData = [];
var currentExternalHistoryData = {};
var currentGatewayStatusData = null;
var historyChart = null;
var isInitialDiscoveryDone = false;
var confirmCallback = null;
var currentSort = { key: 'slot', direction: 'asc' };
var alertConfigs = {};
var currentSensorForAlertConfig = null;
var currentAlertChartableData = [];
var logFilters = { info: true, warn: true, error: true };
var timedOutGateway = null;
var rebootCheckInterval = null;
var rebootTimeout = null;
var rebootingGatewayIp = null;
var modbusBlockingGatewayIp = null;
var isSavingRepeatAlert = false;
var readRegisterTimeout = null;
var pollConnectionPending = false;
var pollConnectingSafetyTimer = null;

// --- Helper Functions ---

function clearPollConnectingSafetyTimer() {
    if (pollConnectingSafetyTimer) {
        clearTimeout(pollConnectingSafetyTimer);
        pollConnectingSafetyTimer = null;
    }
}

/** Grey out the poll control while the main process connects to the gateway (mirrors server start-polling work). */
function setPollConnecting(pending) {
    pollConnectionPending = pending;
    clearPollConnectingSafetyTimer();
    if (!pollButton) return;
    if (pending) {
        pollButton.disabled = true;
        pollButton.classList.remove('stop');
        pollButton.classList.add('connecting');
        pollButton.textContent = 'Connecting...';
        pollConnectingSafetyTimer = setTimeout(() => {
            pollConnectingSafetyTimer = null;
            if (!pollConnectionPending) return;
            pollConnectionPending = false;
            updatePollingButton();
        }, 45000);
    } else {
        pollConnectionPending = false;
        pollButton.classList.remove('connecting');
        pollButton.disabled = false;
        updatePollingButton();
    }
}

function updatePollingButton(status) {
    if (typeof status !== 'undefined') {
        isPolling = status;
        pollConnectionPending = false;
        clearPollConnectingSafetyTimer();
    }

    if (!pollButton) return;
    if (pollConnectionPending) return;

    pollButton.disabled = false;
    if (isPolling) {
        pollButton.textContent = 'Stop Polling';
        pollButton.classList.add('stop');
        pollButton.classList.remove('connecting');
        if (discoverSensorsBtn) {
            discoverSensorsBtn.classList.remove('visually-hidden');
            discoverSensorsBtn.classList.remove('hidden');
        }
    } else {
        pollButton.textContent = 'Start Polling';
        pollButton.classList.remove('stop');
        pollButton.classList.remove('connecting');
        if (showInactiveBtn) showInactiveBtn.classList.add('hidden');
        if (discoverSensorsBtn) discoverSensorsBtn.classList.add('visually-hidden');
    }
}

// Alias for compatibility with client-socket.js which calls this name
var updatePollButtonState = updatePollingButton;

/** When polling is stopped, live poll payload is cleared; resolve active gateway from stored gateway list. */
function getEffectiveActiveGatewayId() {
    const g = latestDeviceData.gateway;
    if (g && g.gatewayId != null && g.gatewayId !== '') return g.gatewayId;
    const active = latestDeviceData.gateways.find((gw) => gw.isActive);
    return active ? active.gatewayId : null;
}

function getEffectiveActiveGatewayIp() {
    const gid = getEffectiveActiveGatewayId();
    if (gid == null) return null;
    const row = latestDeviceData.gateways.find((gw) => gw.gatewayId == gid);
    return row && row.ip ? row.ip : null;
}

function showInfoModal(title, message) {
    if (!infoModal) return;
    infoModalTitle.textContent = title;
    infoModalMessage.textContent = message;
    infoModal.classList.remove('hidden');
}

function showConfirmationModal(message, title, onConfirm) {
    if (!confirmModal) return;
    confirmModalTitle.textContent = title || 'Confirmation';
    confirmModalMessage.textContent = message;
    confirmCallback = onConfirm;
    confirmModal.classList.remove('hidden');
}

function handleGatewayReboot(ip) {
    // Clear any existing reboot check from a previous call
    if (rebootCheckInterval) { clearInterval(rebootCheckInterval); rebootCheckInterval = null; }
    if (rebootTimeout) { clearTimeout(rebootTimeout); rebootTimeout = null; }

    rebootingGatewayIp = ip;
    if (rebootModal) rebootModal.classList.remove('hidden');

    const clearRebootCheck = () => {
        clearInterval(rebootCheckInterval);
        clearTimeout(rebootTimeout);
        rebootCheckInterval = null;
        rebootTimeout = null;
        rebootingGatewayIp = null;
    };

    rebootCheckInterval = setInterval(() => {
        if(socket) socket.emit('refresh-gateway-status', rebootingGatewayIp);
    }, 5000);

    rebootTimeout = setTimeout(() => {
        clearRebootCheck();
        if(rebootModal) rebootModal.classList.add('hidden');
        showInfoModal("Gateway Response Timeout", `The gateway at ${ip} did not respond after applying settings. Please check its connection.`);
    }, 60000); 
}

function exportHistoryToCSV() {
    let csvContent = '';
    const deviceIdEl = document.getElementById('details-device-id');
    let deviceId = deviceIdEl ? deviceIdEl.textContent.replace(/\s/g, '_') : 'unknown';
    
    const escapeCSV = (str) => `"${String(str).replace(/"/g, '""')}"`;

    if (isDetailViewForExternal) {
        const headers = ["Timestamp", "Label", "Value"];
        const rows = [];
        const { records = [] } = currentExternalHistoryData;

        records.forEach(rec => {
            try {
                const timestamp = new Date(rec.timestamp * 1000).toLocaleString();
                const data = JSON.parse(rec.data);
                const addRows = (dataObj) => {
                        if (dataObj === null || typeof dataObj !== 'object') {
                        rows.push([timestamp, "Payload", dataObj].map(escapeCSV).join(','));
                        return;
                    }
                    for (const [key, value] of Object.entries(dataObj)) {
                        const displayValue = (typeof value === 'object') ? JSON.stringify(value) : value;
                        rows.push([timestamp, key, displayValue].map(escapeCSV).join(','));
                    }
                };
                addRows(data);
            } catch { /* skip row */ }
        });
        csvContent = [headers.join(','), ...rows].join('\n');

    } else {
        if (!currentHistoryData || currentHistoryData.length === 0) {
            showInfoModal("Export Failed", "No history data to export.");
            return;
        }
        const headers = ["Timestamp", "Sensor ID", "Device Type", "Reading", "Voltage (V)", "RSSI (%)", "Is Aware", "Alert Triggered"];
        const rows = currentHistoryData.map(rec => {
            try {
                if (typeof rec.rawData !== 'string' || rec.rawData.trim() === '') return null;
                const timestamp = new Date(rec.timestamp * 1000).toLocaleString();
                const tempSensor = {
                    deviceType: rec.deviceType,
                    data: JSON.parse(rec.rawData)
                };
                const parsed = parseSensorData(tempSensor);
                return [timestamp, rec.sensorId, parsed.name, parsed.displayString, rec.voltage.toFixed(2), rec.rssi, rec.isAware ? 'Yes' : 'No', rec.alertTriggered ? 'Yes' : 'No'].map(escapeCSV).join(',');
            } catch {
                return null;
            }
        }).filter(row => row !== null);
        csvContent = [headers.join(','), ...rows].join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `history_${deviceId}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Formats a Date object into a string suitable for datetime-local input.
 */
function formatDateForPicker(date) {
    try {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (e) {
        console.error('Error formatting date:', e);
        return '';
    }
}

function setDefaultDateRange() {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    if (endDateInput) endDateInput.value = formatDateForPicker(endDate);
    if (startDateInput) startDateInput.value = formatDateForPicker(startDate);
}

function getSensorColorClassName(sensorName) {
    const name = sensorName.toLowerCase().replace(/\s+/g, '-');
    const nameMap = {
        'temperature': 'temperature',
        'humidity': 'humidity',
        'dry-contact': 'dry-contact',
        'water-detect': 'water-detect',
        'pir-motion': 'pir-motion',
        'ac-current-meter': 'ac-current-meter',
        'voltage-meter': 'voltage-meter',
        'pressure-meter': 'pressure-meter',
        'light-meter': 'light-meter',
        'control-unit': 'control-unit',
        'external': 'external-device'
    };
    const key = Object.keys(nameMap).find(k => name.includes(k)) || 'unknown-sensor';
    return `border-${key}`;
}

function sortSensors(sensors) {
    sensors.sort((a, b) => {
        let valA, valB;
        
        if (currentSort.key === 'reading') {
            valA = parseSensorData(a).displayString;
            valB = parseSensorData(b).displayString;
        } else if (currentSort.key === 'type') {
                valA = parseSensorData(a).name;
                valB = parseSensorData(b).name;
        } else if (currentSort.key === 'data') {
            valA = (a.data && Array.isArray(a.data) && a.data.length > 0) ? a.data[0] : null;
            valB = (b.data && Array.isArray(b.data) && b.data.length > 0) ? b.data[0] : null;
        } else {
            valA = a[currentSort.key];
            valB = b[currentSort.key];
        }
        
        if (typeof valA === 'string' && typeof valB === 'string') {
            return currentSort.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
            return currentSort.direction === 'asc' ? valA - valB : valB - valA;
        }
    });
}

function createDefaultServerBadge(status) {
    if (!status || status.toLowerCase() === 'unknown') return '<div class="badge-placeholder"></div>';

    let badgeClass = 'status-off';
    let badgeText = status;
    const statusLower = status.toLowerCase();

    if (statusLower.includes('on and server error')) {
        badgeClass = 'status-warning';
    } else if (statusLower === 'on') {
        badgeClass = 'status-on';
    }

    return `
        <div class="status-badge-container">
            <span class="default-server-badge ${badgeClass}">Default Server: ${badgeText}</span>
            <button class="info-icon-btn default-server-info-trigger" title="About the Default Server Interface">i</button>
        </div>
    `;
}

function populateFilterOptions(sensors) {
    const sensorTypes = [...new Set(sensors.map(s => parseSensorData(s).name))];
    const currentOptions = Array.from(typeFilter.options).map(o => o.value);
    sensorTypes.forEach(type => {
        if (!currentOptions.includes(type)) {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeFilter.appendChild(option);
        }
    });
}

function setupDetailTabs(isGateway, isExternal) {
    isDetailViewForGateway = isGateway;
    isDetailViewForExternal = isExternal;

    detailsTabs.forEach(tab => {
        const tabName = tab.dataset.tab;
        let showTab = false;

        if (isExternal) {
            if (['history', 'details'].includes(tabName)) {
                showTab = true;
            }
        } else if (isGateway) {
            if (['history', 'sensor-list', 'modbus-registers', 'settings'].includes(tabName)) {
                showTab = true;
            }
        } else {
                if (['history', 'alert-history', 'charts'].includes(tabName)) {
                showTab = true;
            }
        }
        
        tab.style.display = showTab ? 'flex' : 'none';
    });

    // Force click history to reset view
    const historyTab = document.querySelector('.details-tab-link[data-tab="history"]');
    if (historyTab) historyTab.click();
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    
    // --- Socket.IO Shim for Electron ---
    if (window.socket) { // FIX: Changed from window.api to window.socket
        console.log("[CLIENT] Initializing in Electron mode (IPC bridge active).");
        socket = {
            on: (channel, callback) => {
                if (!window.socket) return; // FIX: Changed from window.api to window.socket
                window.socket.on(channel, callback);
            },
            emit: (channel, ...args) => {
                if (!window.socket) return;
                // Must use preload emit (not send): IPC may carry multiple args (e.g. set-active-gateway + autoStart).
                window.socket.emit(channel, ...args);
            }
        };
        
        // Notify main process we are ready
        socket.emit('client-ready');
        
    } else {
        console.log("[CLIENT] Initializing in Browser mode (Socket.IO active).");
        // Check if io exists before calling it to prevent crash
        if (typeof io !== 'undefined') {
            socket = io('http://localhost:7001'); // FIX: Specify the server URL to port 7001
        } else {
            console.error("Socket.io not found. Client cannot connect.");
        }
    }

    // --- Assign DOM Elements ---
    pollButton = document.getElementById('poll-button');
    deviceCardsContainer = document.getElementById('device-cards-container');
    externalDeviceCardsContainer = document.getElementById('external-device-cards-container');
    logContent = document.getElementById('log-content');

    mainDashboardView = document.getElementById('main-dashboard-view');
    deviceDetailsView = document.getElementById('device-details-view');

    tabs = document.querySelectorAll('.tab-link');
    tabContents = document.querySelectorAll('.tab-content');

    serverStatus = document.getElementById('server-status');
    gatewayStatus = document.getElementById('gateway-status');
    sensorsStatus = document.getElementById('sensors-status');
    alertingStatus = document.getElementById('alerting-status');
    statusBar = document.getElementById('status-bar');
    statusHeader = document.getElementById('status-header');
    statusToggleArrow = document.getElementById('status-toggle-arrow');
    statusProblemIndicator = document.getElementById('status-problem-indicator');

    portSettingInput = document.getElementById('port-setting');
    maxRecordsInput = document.getElementById('max-records-setting');
    saveSettingsBtn = document.getElementById('save-settings-btn');
    settingsSaveStatus = document.getElementById('settings-save-status');
    alertingEnabledSwitch = document.getElementById('alerting-enabled-switch');
    resetGatewaysBtn = document.getElementById('reset-gateways-btn');
    resetAlertsBtn = document.getElementById('reset-alerts-btn');
    resetColorGroupsBtn = document.getElementById('reset-color-groups-btn');
    resetNamesBtn = document.getElementById('reset-names-btn');
    repeatAlertIntervalInput = document.getElementById('repeat-alert-interval');
    repeatAlertInfoBtn = document.getElementById('repeat-alert-info-btn');
    saveRepeatAlertBtn = document.getElementById('save-repeat-alert-btn');
    repeatAlertSaveStatus = document.getElementById('repeat-alert-save-status');
    pluginsActiveList = document.getElementById('plugins-active-list');

    logFilterContainer = document.getElementById('log-filter-container');
    logHeader = document.querySelector('.log-header');
    logToggle = document.getElementById('log-toggle');
    latestLogMessage = document.getElementById('latest-log-message');

    findGatewayBtn = document.getElementById('find-gateway-btn');
    findGatewayModal = document.getElementById('find-gateway-modal');
    closeModalBtn = findGatewayModal ? findGatewayModal.querySelector('.close-button') : null;

    addManuallyToggle = document.getElementById('add-manually-toggle');
    manualAddContainer = document.getElementById('manual-add-container');
    manualAddType = document.getElementById('manual-add-type');
    ipInputContainer = document.getElementById('ip-input-container');
    macInputContainer = document.getElementById('mac-input-container');
    findByMacBtn = document.getElementById('find-by-mac-btn');
    macAddressInput = document.getElementById('mac-address-input');
    findByIpBtn = document.getElementById('find-by-ip-btn');
    ipAddressInput = document.getElementById('ip-address-input');
    findGatewayStatus = document.getElementById('find-gateway-status');
    gatewayListContainer = document.getElementById('gateway-list-container');
    gatewayConfigContainer = document.getElementById('gateway-config-container');
    gatewayConfigContent = document.getElementById('gateway-config-content');
    subTabs = document.querySelectorAll('.sub-tab-link');
    scanNetworkBtn = document.getElementById('scan-network-btn');
    scanStatus = document.getElementById('scan-status');
    scanResultsContainer = document.getElementById('scan-results-container');
    gatewayInfoBtn = document.getElementById('gateway-info-btn');
    gatewayInfoModal = document.getElementById('gateway-info-modal');
    closeGatewayInfoModalBtn = gatewayInfoModal ? gatewayInfoModal.querySelector('.close-button') : null;
    writeAccessInfoModal = document.getElementById('write-access-info-modal');
    closeWriteAccessInfoModalBtn = writeAccessInfoModal ? writeAccessInfoModal.querySelector('.close-button') : null;
    
    discoverSensorsBtn = document.getElementById('discover-sensors-btn');
    showInactiveBtn = document.getElementById('show-inactive-btn');
    inactiveSensorsModal = document.getElementById('inactive-sensors-modal');
    inactiveSensorsList = document.getElementById('inactive-sensors-list');
    closeInactiveModalBtn = inactiveSensorsModal ? inactiveSensorsModal.querySelector('.close-button') : null;
    
    backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
    detailsDeviceId = document.getElementById('details-device-id');
    historyContent = document.getElementById('history-content');
    alertHistoryContent = document.getElementById('alert-history-content');
    detailsContent = document.getElementById('details-content');
    sensorListContent = document.getElementById('sensor-list-content');
    modbusRegistersContent = document.getElementById('modbus-registers-content');
    detailsTabsContainer = document.querySelector('.details-tabs');
    detailsTabs = document.querySelectorAll('.details-tab-link');
    exportCsvBtn = document.getElementById('export-csv-btn');

    chartControls = document.querySelector('#history-content .chart-controls');
    startDateInput = document.getElementById('start-date');
    endDateInput = document.getElementById('end-date');
    
    infoBar = document.getElementById('info-bar');
    pollingStatusContainer = document.getElementById('polling-status-container');
    if (pollingStatusContainer) {
        pollingStatusSpinner = pollingStatusContainer.querySelector('.spinner');
    }
    pollingStatusMessage = document.getElementById('polling-status-message');
    cardViewBtn = document.getElementById('card-view-btn');
    listViewBtn = document.getElementById('list-view-btn');
    
    filterContainer = document.getElementById('filter-container');
    typeFilter = document.getElementById('type-filter');
    awareFilter = document.getElementById('aware-filter');
    batteryFilter = document.getElementById('battery-filter');
    signalFilter = document.getElementById('signal-filter');
    colorGroupFilter = document.getElementById('color-group-filter');
    resetFiltersBtn = document.getElementById('reset-filters-btn');
    
    confirmModal = document.getElementById('confirm-modal');
    confirmModalTitle = document.getElementById('confirm-modal-title');
    confirmModalMessage = document.getElementById('confirm-modal-message');
    confirmOkBtn = document.getElementById('confirm-ok-btn');
    confirmCancelBtn = document.getElementById('confirm-cancel-btn');

    infoModal = document.getElementById('info-modal');
    infoModalTitle = document.getElementById('info-modal-title');
    infoModalMessage = document.getElementById('info-modal-message');
    infoOkBtn = document.getElementById('info-ok-btn');

    timeoutModal = document.getElementById('timeout-modal');
    timeoutModalMessage = document.getElementById('timeout-modal-message');
    timeoutRetryBtn = document.getElementById('timeout-retry-btn');
    timeoutRemoveBtn = document.getElementById('timeout-remove-btn');
    
    alertSettingsContainer = document.getElementById('alert-settings-container');
    emailAlertsEnabledSwitch = document.getElementById('email-alerts-enabled-switch');
    smsAlertsEnabledSwitch = document.getElementById('sms-alerts-enabled-switch');
    emailSettingsContainer = document.getElementById('email-settings-container');
    smsSettingsContainer = document.getElementById('sms-settings-container');
    saveEmailSettingsBtn = document.getElementById('save-email-settings-btn');
    sendTestEmailBtn = document.getElementById('send-test-email-btn');
    emailTestStatus = document.getElementById('email-test-status');
    saveSmsSettingsBtn = document.getElementById('save-sms-settings-btn');
    sendTestSmsBtn = document.getElementById('send-test-sms-btn');
    smsTestStatus = document.getElementById('sms-test-status');
    alertCustomMessage = document.getElementById('alert-custom-message');
    saveAlertMessageBtn = document.getElementById('save-alert-message-btn');
    alertMessageSaveStatus = document.getElementById('alert-message-save-status');
    charLimitWarning = document.getElementById('char-limit-warning');
    emailSpinner = document.getElementById('email-spinner');
    smsSpinner = document.getElementById('sms-spinner');

    alertConfigModal = document.getElementById('alert-config-modal');
    alertConfigTitle = document.getElementById('alert-config-title');
    alertDatumSelect = document.getElementById('alert-datum');
    alertCondition = document.getElementById('alert-condition');
    alertThreshold = document.getElementById('alert-threshold');
    alertThresholdDiscrete = document.getElementById('alert-threshold-discrete');
    saveAlertConfigBtn = document.getElementById('save-alert-config-btn');
    cancelAlertConfigBtn = document.getElementById('cancel-alert-config-btn');
    
    scanProgressModal = document.getElementById('scan-progress-modal');
    scanCurrentStatus = document.getElementById('scan-current-status');
    scanProgressLog = document.getElementById('scan-progress-log');
    cancelScanBtn = document.getElementById('cancel-scan-btn');

    rebootModal = document.getElementById('reboot-modal');

    statusProblemModal = document.getElementById('status-problem-modal');
    repeatAlertInfoModal = document.getElementById('repeat-alert-info-modal');
    if (document.getElementById('alert-repeat-notice')) {
        alertRepeatNotice = document.getElementById('alert-repeat-notice').querySelector('span');
    }

    const helpDocLink = document.getElementById('help-doc-link');
    if (helpDocLink) {
        helpDocLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Stop event bubbling
            console.log("[CLIENT] Help documentation link clicked.");
            if (socket && socket.emit) {
                socket.emit('open-help-docs'); // Send signal to backend
            }
        });
    }

    // --- NEW: Initialize Update Controls ---
    // --- NEW: Initialize Update Controls ---
    autoUpdateToggle = document.getElementById('auto-update-toggle');
    
    updatePollingButton(); // Call the corrected function

    // Check for initial tab from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab');
    if (initialTab) {
        const tabToActivate = document.querySelector(`.tab-link[data-tab="${initialTab}"]`);
        if (tabToActivate) {
            tabToActivate.click();
            history.replaceState(null, '', window.location.pathname);
        }
    }
});