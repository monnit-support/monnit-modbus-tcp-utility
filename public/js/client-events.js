// public/client-events.js

// --- Helper functions for modal display ---
function showScanProgressModal() {
    const scanProgressModal = document.getElementById('scan-progress-modal');
    if (scanProgressModal) {
        scanProgressModal.classList.remove('hidden');
        scanProgressModal.style.display = 'flex'; // Ensure it's visible
        // scanProgressModal.style.backgroundColor = 'pink'; // For debugging - REMOVED
        const scanCurrentStatus = document.getElementById('scan-current-status');
        if (scanCurrentStatus) {
            scanCurrentStatus.textContent = 'Starting network scan...';
        }
        const scanProgressLog = document.getElementById('scan-progress-log');
        if (scanProgressLog) {
            scanProgressLog.innerHTML = ''; // Clear previous logs
        }
    } else {
        console.error("Scan progress modal element not found!");
    }
}

function hideScanProgressModal() {
    const scanProgressModal = document.getElementById('scan-progress-modal');
    if (scanProgressModal) {
        scanProgressModal.classList.add('hidden');
        scanProgressModal.style.display = 'none'; // Ensure it's hidden
        scanProgressModal.style.backgroundColor = ''; // Reset background
    }
}

document.addEventListener('DOMContentLoaded', () => {

    // --- Main Dashboard Controls ---

    // Assuming these are defined elsewhere or globally accessible
    const pollButton = document.getElementById('poll-button');
    const cardViewBtn = document.getElementById('card-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');
    const deviceCardsContainer = document.getElementById('device-cards-container');
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const portSettingInput = document.getElementById('port-setting');
    const maxRecordsInput = document.getElementById('max-records-setting');
    const settingsSaveStatus = document.getElementById('settings-save-status');
    const saveRepeatAlertBtn = document.getElementById('save-repeat-alert-btn');
    const repeatAlertIntervalInput = document.getElementById('repeat-alert-interval');
    const repeatAlertSaveStatus = document.getElementById('repeat-alert-save-status');
    const statusProblemIndicator = document.getElementById('status-problem-indicator');
    const statusProblemModal = document.getElementById('status-problem-modal');
    const repeatAlertInfoBtn = document.getElementById('repeat-alert-info-btn');
    const repeatAlertInfoModal = document.getElementById('repeat-alert-info-modal');
    const resetGatewaysBtn = document.getElementById('reset-gateways-btn');
    const resetAlertsBtn = document.getElementById('reset-alerts-btn');
    const resetColorGroupsBtn = document.getElementById('reset-color-groups-btn');
    const resetNamesBtn = document.getElementById('reset-names-btn');
    const alertingEnabledSwitch = document.getElementById('alerting-enabled-switch');
    const emailAlertsEnabledSwitch = document.getElementById('email-alerts-enabled-switch');
    const smsAlertsEnabledSwitch = document.getElementById('sms-alerts-enabled-switch');
    const alertSettingsContainer = document.getElementById('alert-settings-container');
    const emailSettingsContainer = document.getElementById('email-settings-container');
    const smsSettingsContainer = document.getElementById('sms-settings-container');
    const saveEmailSettingsBtn = document.getElementById('save-email-settings-btn');
    const sendTestEmailBtn = document.getElementById('send-test-email-btn');
    const emailTestStatus = document.getElementById('email-test-status');
    const emailSpinner = document.getElementById('email-spinner');
    const saveSmsSettingsBtn = document.getElementById('save-sms-settings-btn');
    const sendTestSmsBtn = document.getElementById('send-test-sms-btn');
    const smsTestStatus = document.getElementById('sms-test-status');
    const smsSpinner = document.getElementById('sms-spinner');
    const saveAlertMessageBtn = document.getElementById('save-alert-message-btn');
    const alertCustomMessage = document.getElementById('alert-custom-message');
    const alertMessageSaveStatus = document.getElementById('alert-message-save-status');
    const logHeader = document.querySelector('.log-header');
    const logContent = document.getElementById('log-content');
    const logToggle = document.getElementById('log-toggle');
    const logFilterContainer = document.getElementById('log-filter-container');
    const findGatewayBtn = document.getElementById('find-gateway-btn');
    const findGatewayModal = document.getElementById('find-gateway-modal');
    const closeModalBtn = findGatewayModal ? findGatewayModal.querySelector('.close-button') : null;
    const addManuallyToggle = document.getElementById('add-manually-toggle');
    const manualAddContainer = document.getElementById('manual-add-container');
    const manualAddType = document.getElementById('manual-add-type');
    const ipInputContainer = document.getElementById('ip-input-container');
    const macInputContainer = document.getElementById('mac-input-container');
    const findByIpBtn = document.getElementById('find-by-ip-btn');
    const ipAddressInput = document.getElementById('ip-address-input');
    const findByMacBtn = document.getElementById('find-by-mac-btn');
    const macAddressInput = document.getElementById('mac-address-input');
    const findGatewayStatus = document.getElementById('find-gateway-status');
    const scanNetworkBtn = document.getElementById('scan-network-btn');
    const scanProgressModal = document.getElementById('scan-progress-modal');
    const scanProgressLog = document.getElementById('scan-progress-log');
    const scanCurrentStatus = document.getElementById('scan-current-status');
    const cancelScanBtn = document.getElementById('cancel-scan-btn');
    const scanResultsContainer = document.getElementById('scan-results-container');
    const discoverSensorsBtn = document.getElementById('discover-sensors-btn');
    const showInactiveBtn = document.getElementById('show-inactive-btn');
    const inactiveSensorsList = document.getElementById('inactive-sensors-list');
    const inactiveSensorsModal = document.getElementById('inactive-sensors-modal');
    const closeInactiveModalBtn = inactiveSensorsModal ? inactiveSensorsModal.querySelector('.close-button') : null;
    const gatewayListContainer = document.getElementById('gateway-list-container');
    const subTabs = document.querySelectorAll('.sub-tab-link');
    const gatewayConfigContent = document.getElementById('gateway-config-content');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const typeFilter = document.getElementById('type-filter');
    const awareFilter = document.getElementById('aware-filter');
    const batteryFilter = document.getElementById('battery-filter');
    const signalFilter = document.getElementById('signal-filter');
    const colorGroupFilter = document.getElementById('color-group-filter');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');
    const confirmModal = document.getElementById('confirm-modal');
    const confirmModalTitle = document.getElementById('confirm-modal-title');
    const infoOkBtn = document.getElementById('info-ok-btn');
    const infoModal = document.getElementById('info-modal');
    const timeoutRetryBtn = document.getElementById('timeout-retry-btn');
    const timeoutRemoveBtn = document.getElementById('timeout-remove-btn');
    const timeoutModal = document.getElementById('timeout-modal');
    const saveAlertConfigBtn = document.getElementById('save-alert-config-btn');
    const cancelAlertConfigBtn = document.getElementById('cancel-alert-config-btn');
    const alertConfigModal = document.getElementById('alert-config-modal');
    const alertCondition = document.getElementById('alert-condition');
    const alertThreshold = document.getElementById('alert-threshold');
    const alertDatumSelect = document.getElementById('alert-datum');
    const alertThresholdDiscrete = document.getElementById('alert-threshold-discrete');
    const alertThresholdGroup = document.getElementById('alert-threshold-group');

    function updateAlertConfigUIFromDatum() {
        const chartableData = typeof currentAlertChartableData !== 'undefined' ? currentAlertChartableData : [];
        const datumIndex = alertDatumSelect ? parseInt(alertDatumSelect.value, 10) : 0;
        const datum = chartableData[datumIndex];
        const thresholdLabel = alertThresholdGroup ? alertThresholdGroup.querySelector('label') : null;

        const condOpts = [
            { v: 'above', t: 'Value Above' },
            { v: 'below', t: 'Value Below' },
            { v: 'equal', t: 'Value Equals' },
            { v: 'not_equal', t: 'Value Not Equals' }
        ];
        const numericConds = condOpts;
        const discreteConds = condOpts.filter(o => o.v === 'equal' || o.v === 'not_equal');

        if (datum && datum.valueType === 'discrete') {
            alertThreshold.classList.add('hidden');
            if (alertThresholdDiscrete) {
                alertThresholdDiscrete.classList.remove('hidden');
                alertThresholdDiscrete.innerHTML = '';
                (datum.options || [{ value: 0, label: 'False' }, { value: 1, label: 'True' }]).forEach(opt => {
                    const o = document.createElement('option');
                    o.value = String(opt.value);
                    o.textContent = opt.label;
                    alertThresholdDiscrete.appendChild(o);
                });
            }
            alertCondition.innerHTML = discreteConds.map(c => `<option value="${c.v}">${c.t}</option>`).join('');
            if (thresholdLabel) thresholdLabel.textContent = 'Value';
        } else {
            alertThreshold.classList.remove('hidden');
            if (alertThresholdDiscrete) alertThresholdDiscrete.classList.add('hidden');
            alertCondition.innerHTML = numericConds.map(c => `<option value="${c.v}">${c.t}</option>`).join('');
            const unit = (datum && datum.unit) ? ` (${datum.unit})` : '';
            if (thresholdLabel) thresholdLabel.textContent = 'Threshold Value' + unit;
            alertThreshold.placeholder = datum && datum.unit ? `Enter value in ${datum.unit}` : 'Enter value';
        }
    }
    const statusHeader = document.getElementById('status-header');
    const statusBar = document.getElementById('status-bar');
    const statusToggleArrow = document.getElementById('status-toggle-arrow');
    if (statusToggleArrow && statusBar) {
        const toggleStatusBar = () => {
            const isCollapsed = statusBar.classList.toggle('is-collapsed');
            localStorage.setItem('isStatusBarCollapsed', isCollapsed);
            statusToggleArrow.classList.toggle('down', !isCollapsed);
        };
        statusToggleArrow.addEventListener('click', toggleStatusBar);
        statusToggleArrow.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleStatusBar();
            }
        });
    }
    const gatewayInfoModal = document.getElementById('gateway-info-modal');
    const closeGatewayInfoModalBtn = gatewayInfoModal ? gatewayInfoModal.querySelector('.close-button') : null;
    const writeAccessInfoModal = document.getElementById('write-access-info-modal');
    const closeWriteAccessInfoModalBtn = writeAccessInfoModal ? writeAccessInfoModal.querySelector('.close-button') : null;
    const checkUpdatesBtn = document.getElementById('check-updates-btn');
    const updateStatusMessage = document.getElementById('update-status-message');

    const mainDashboardView = document.getElementById('main-dashboard-view');
    const deviceDetailsView = document.getElementById('device-details-view');
    const detailsDeviceId = document.getElementById('details-device-id');
    const historyContent = document.getElementById('history-content');
    const alertHistoryContent = document.getElementById('alert-history-content');
    const detailsContent = document.getElementById('details-content');
    const historyChart = null; // Assuming this is managed elsewhere or initialized later
    const externalDeviceCardsContainer = document.getElementById('external-device-cards-container');
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
    const detailsTabsContainer = document.querySelector('.details-tabs');
    const detailsTabs = document.querySelectorAll('.details-tab-link');
    const modbusRegistersContent = document.getElementById('modbus-registers-content');
    const gatewayConfigContainer = document.getElementById('gateway-config-container');


    if (pollButton) {
        pollButton.addEventListener('click', () => {
            if (pollConnectionPending) return;
            if (isPolling) {
                showConfirmationModal("Are you sure you wish to stop polling?","Stop Polling", () => {
                    socket.emit('stop-polling');
                });
            } else {
                isInitialDiscoveryDone = false;
                setPollConnecting(true);
                socket.emit('start-polling');
            }
        });
    }

    if (cardViewBtn) {
        cardViewBtn.addEventListener('click', () => {
            if (cardViewBtn.classList.contains('active')) return;
            cardViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
            deviceCardsContainer.classList.remove('list-view');
            deviceCardsContainer.classList.add('card-view');
            applyFiltersAndRender();
        });
    }

    if (listViewBtn) {
        listViewBtn.addEventListener('click', () => {
            if (listViewBtn.classList.contains('active')) return;
            listViewBtn.classList.add('active');
            cardViewBtn.classList.remove('active');
            deviceCardsContainer.classList.remove('card-view');
            deviceCardsContainer.classList.add('list-view');
            applyFiltersAndRender();
        });
    }

    // --- Tab Navigation ---

    if (tabs) {
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const clickedTab = e.currentTarget;
                tabs.forEach(item => item.classList.remove('active'));
                clickedTab.classList.add('active');
                tabContents.forEach(content => content.classList.remove('active'));
                const targetContent = document.getElementById(clickedTab.dataset.tab);
                if (targetContent) targetContent.classList.add('active');

                // Refresh gateway status badge when clicking the Devices tab
                if(clickedTab.dataset.tab === 'devices-content' && isPolling) {
                    const activeGatewayIp = latestDeviceData.gateways.find(g => g.isActive)?.ip;
                    if(activeGatewayIp) {
                        socket.emit('refresh-gateway-status', activeGatewayIp);
                    }
                }
            });
        });
    }

    // --- Settings & Configuration ---

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            const settings = {
                port: portSettingInput.value,
                maxRecords: maxRecordsInput.value,
            };
            socket.emit('update-settings', settings);
            settingsSaveStatus.textContent = 'Saving...';
        });
    }

    if (saveRepeatAlertBtn) {
        saveRepeatAlertBtn.addEventListener('click', () => {
            const settings = {
                repeatAlertInterval: repeatAlertIntervalInput.value
            };
            isSavingRepeatAlert = true; // Set flag before emitting
            socket.emit('update-settings', settings);
            repeatAlertSaveStatus.textContent = 'Saving...';
        });
    }

    if (statusProblemIndicator) {
        statusProblemIndicator.addEventListener('click', () => {
            statusProblemModal.classList.remove('hidden');
        });
    }

    if (repeatAlertInfoBtn) {
        repeatAlertInfoBtn.addEventListener('click', () => {
            repeatAlertInfoModal.classList.remove('hidden');
        });
    }

    if (repeatAlertInfoModal) {
        const closeBtn = repeatAlertInfoModal.querySelector('.close-button');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                repeatAlertInfoModal.classList.add('hidden');
            });
        }
    }

    if (resetGatewaysBtn) {
        resetGatewaysBtn.addEventListener('click', () => {
            showConfirmationModal(
                "Are you sure you want to remove all gateways and their sensor data? This action cannot be undone.",
                "Confirm Reset",
                () => { socket.emit('reset-all-gateways'); }
            );
        });
    }

    if (resetAlertsBtn) {
        resetAlertsBtn.addEventListener('click', () => {
             showConfirmationModal(
                "Are you sure you want to remove all alert configurations? This action cannot be undone.",
                "Confirm Reset",
                () => { socket.emit('reset-all-alerts'); }
            );
        });
    }

    if (resetColorGroupsBtn) {
        resetColorGroupsBtn.addEventListener('click', () => {
            showConfirmationModal(
                "Are you sure you want to reset all custom sensor color groups? Custom names will not be affected. This cannot be undone.",
                "Confirm Reset",
                () => { socket.emit('reset-color-groups'); }
            );
        });
    }

    if (resetNamesBtn) {
        resetNamesBtn.addEventListener('click', () => {
            showConfirmationModal(
                "Are you sure you want to remove all custom sensor names? This action cannot be undone.",
                "Confirm Reset",
                () => { socket.emit('reset-sensor-names'); }
            );
        });
    }

    // --- Alerting System Toggles ---

    const updateAlertingStatus = () => {
        if (!alertingEnabledSwitch || !emailAlertsEnabledSwitch || !smsAlertsEnabledSwitch) return;
        const status = {
            main: alertingEnabledSwitch.checked,
            email: emailAlertsEnabledSwitch.checked,
            sms: smsAlertsEnabledSwitch.checked
        };
        socket.emit('update-alerting-status', status);
    };

    if (alertingEnabledSwitch) {
        alertingEnabledSwitch.addEventListener('change', () => {
            alertSettingsContainer.classList.toggle('hidden', !alertingEnabledSwitch.checked);
            updateAlertingStatus();
        });
    }

    if (emailAlertsEnabledSwitch) {
        emailAlertsEnabledSwitch.addEventListener('change', () => {
            emailSettingsContainer.classList.toggle('hidden', !emailAlertsEnabledSwitch.checked);
            updateAlertingStatus();
        });
    }

    if (smsAlertsEnabledSwitch) {
        smsAlertsEnabledSwitch.addEventListener('change', () => {
            smsSettingsContainer.classList.toggle('hidden', !smsAlertsEnabledSwitch.checked);
            updateAlertingStatus();
        });
    }

    if (saveEmailSettingsBtn) {
        saveEmailSettingsBtn.addEventListener('click', () => {
            const config = {
                server: document.getElementById('smtp-server').value,
                port: document.getElementById('smtp-port').value,
                username: document.getElementById('smtp-username').value,
                password: document.getElementById('smtp-password').value,
                fromName: document.getElementById('smtp-from-name').value,
                fromEmail: document.getElementById('smtp-from-email').value,
                recipientEmail: document.getElementById('smtp-recipient-email').value
            };
            socket.emit('save-email-settings', config);
            emailTestStatus.textContent = 'Saving...';
        });
    }

    if (sendTestEmailBtn) {
        sendTestEmailBtn.addEventListener('click', () => {
            const config = {
                server: document.getElementById('smtp-server').value,
                port: document.getElementById('smtp-port').value,
                username: document.getElementById('smtp-username').value,
                password: document.getElementById('smtp-password').value,
                fromName: document.getElementById('smtp-from-name').value,
                fromEmail: document.getElementById('smtp-from-email').value,
                to: document.getElementById('smtp-recipient-email').value
            };

            if (!config.server || !config.port || !config.to) {
                emailTestStatus.textContent = 'Please fill in all required email fields.';
                return;
            }

            emailTestStatus.textContent = '';
            emailSpinner.classList.remove('hidden');
            socket.emit('send-test-email', config);
        });
    }

    if (saveSmsSettingsBtn) {
        saveSmsSettingsBtn.addEventListener('click', () => {
            const config = {
                apiKey: document.getElementById('textbelt-api-key').value,
                recipientSms: document.getElementById('sms-recipient-phone').value,
            };
            socket.emit('save-sms-settings', config);
            smsTestStatus.textContent = 'Saving...';
        });
    }

    if (sendTestSmsBtn) {
        sendTestSmsBtn.addEventListener('click', () => {
            const data = {
                phone: document.getElementById('sms-recipient-phone').value
            };
            if (!data.phone) {
                smsTestStatus.textContent = 'Please enter a recipient phone number.';
                return;
            }
            smsTestStatus.textContent = '';
            smsSpinner.classList.add('hidden');
            socket.emit('send-test-sms', data);
        });
    }

    if (saveAlertMessageBtn) {
        saveAlertMessageBtn.addEventListener('click', () => {
            const message = alertCustomMessage.value;
            socket.emit('save-alert-message', message);
            alertMessageSaveStatus.textContent = 'Saving...';
        });
    }

    // --- Log Viewer Interactions ---

    if (logHeader) {
        logHeader.addEventListener('click', () => {
            const isHidden = logContent.style.display === 'none';
            logContent.style.display = isHidden ? '' : 'none';
            logToggle.classList.toggle('down', isHidden);
            logToggle.classList.toggle('up', !isHidden);
        });
    }

    if (logFilterContainer) {
        logFilterContainer.addEventListener('click', (e) => {
            const target = e.target.closest('.log-filter-btn');
            if (!target) return;

            e.stopPropagation(); // Prevent the header click from firing

            document.querySelectorAll('.log-filter-btn').forEach(btn => btn.classList.remove('active'));
            target.classList.add('active');

            const filter = target.dataset.filter;

            document.querySelectorAll('#log-content .log-entry').forEach(entry => {
                if (filter === 'all') {
                    entry.classList.remove('hidden');
                } else {
                    const levelClass = `log-${filter.toUpperCase()}`;
                    entry.classList.toggle('hidden', !entry.classList.contains(levelClass));
                }
            });
        });
    }

    // --- Gateway Management ---

    if (findGatewayBtn) findGatewayBtn.addEventListener('click', () => findGatewayModal.classList.remove('hidden'));
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => findGatewayModal.classList.add('hidden'));

    if (addManuallyToggle) {
        addManuallyToggle.addEventListener('click', (e) => {
            e.preventDefault();
            manualAddContainer.classList.toggle('hidden');
        });
    }

    if (manualAddType) {
        manualAddType.addEventListener('change', () => {
            if (manualAddType.value === 'ip') {
                ipInputContainer.classList.remove('hidden');
                macInputContainer.classList.add('hidden');
            } else {
                ipInputContainer.classList.add('hidden');
                macInputContainer.classList.remove('hidden');
            }
        });
    }

    if (findByIpBtn) {
        findByIpBtn.addEventListener('click', () => {
            const ip = ipAddressInput.value.trim();
            if (ip) {
                socket.emit('find-gateway-ip', ip);
                findGatewayStatus.textContent = `Searching for ${ip}...`;
            }
        });
    }

    if (findByMacBtn) {
        findByMacBtn.addEventListener('click', () => {
            const mac = macAddressInput.value.trim();
            if (mac) {
                socket.emit('find-gateway-mac', mac);
                findGatewayStatus.textContent = `Searching for ${mac}...`;
            }
        });
    }

    if (scanNetworkBtn) {
        scanNetworkBtn.addEventListener('click', () => {
            findGatewayModal.classList.add('hidden');
            showScanProgressModal(); // Use the new function
            socket.emit('scan-for-gateways');
        });
    }

    if (cancelScanBtn) {
        cancelScanBtn.addEventListener('click', () => {
            showConfirmationModal(
                'Are you sure you want to cancel the network scan?',
                'Cancel Scan',
                () => {
                    socket.emit('cancel-scan');
                    hideScanProgressModal(); // Use the new function
                }
            );
        });
    }

    if (scanResultsContainer) {
        scanResultsContainer.addEventListener('click', (e) => {
            // Handle single add button
            if (e.target.classList.contains('add-gateway-btn')) {
                const ip = e.target.dataset.ip;
                e.target.textContent = 'Adding...';
                e.target.disabled = true;
                socket.emit('find-gateway-ip', ip);
            }

            // Handle "Add Selected" Button
            if (e.target.id === 'add-selected-gateways-btn') {
                const checkedBoxes = scanResultsContainer.querySelectorAll('.scan-checkbox:checked');
                if (checkedBoxes.length === 0) {
                    showInfoModal('No Selection', 'Please select at least one gateway to add.');
                    return;
                }

                e.target.textContent = 'Adding...';
                e.target.disabled = true;

                // Iterate and add each one
                checkedBoxes.forEach(box => {
                    const ip = box.value;
                    socket.emit('find-gateway-ip', ip);
                });

                // Close modal after a short delay
                setTimeout(() => {
                    findGatewayModal.classList.add('hidden');
                }, 1000);
            }
        });
    }

    if (discoverSensorsBtn) {
        discoverSensorsBtn.addEventListener('click', () => {
            if(isPolling) {
                 showConfirmationModal(
                    'This will re-run the initial sensor discovery process. Continue?',
                    'Discover Sensors',
                    () => {
                        deviceCardsContainer.innerHTML = '';
                        isInitialDiscoveryDone = false;
                        infoBar.classList.add('is-detecting');
                        infoBar.classList.remove('hidden');
                        pollingStatusContainer.classList.remove('hidden');
                        pollingStatusSpinner.classList.remove('hidden');
                        pollingStatusMessage.textContent = 'Discovering Sensors...';
                        filterContainer.classList.add('hidden');
                        socket.emit('start-polling');
                    }
                );
            } else {
                showInfoModal('Not Polling', 'Please start polling before discovering sensors.');
            }
        });
    }

    if (showInactiveBtn) {
        showInactiveBtn.addEventListener('click', () => {
            inactiveSensorsList.innerHTML = '';
            if (latestDeviceData.inactiveSensors && latestDeviceData.inactiveSensors.length > 0) {
                const table = document.createElement('table');
                table.className = 'history-table';
                table.innerHTML = `<thead><tr><th>Slot</th><th>Device ID</th></tr></thead>`;
                const tbody = document.createElement('tbody');
                latestDeviceData.inactiveSensors.forEach(sensor => {
                    const row = document.createElement('tr');
                    row.innerHTML = `<td>${sensor.slot}</td><td>${sensor.deviceId}</td>`;
                    tbody.appendChild(row);
                });
                table.appendChild(tbody);
                inactiveSensorsList.appendChild(table);
            } else {
                inactiveSensorsList.innerHTML = '<p class="no-data-message">No inactive sensors found.</p>';
            }
            inactiveSensorsModal.classList.remove('hidden');
        });
    }

    if (closeInactiveModalBtn) closeInactiveModalBtn.addEventListener('click', () => inactiveSensorsModal.classList.add('hidden'));

    if (gatewayListContainer) {
        gatewayListContainer.addEventListener('click', (e) => {
            const card = e.target.closest('.gateway-list-card');
            const toggle = e.target.closest('.active-gateway-toggle');

            if (toggle) {
                e.stopPropagation();
                const gatewayId = parseInt(toggle.dataset.id, 10);
                if (toggle.checked) {
                    const targetGw = latestDeviceData.gateways.find((g) => g.gatewayId === gatewayId);
                    const gatewayLabel = targetGw?.ip ? `${targetGw.ip} (ID ${gatewayId})` : `Gateway ID ${gatewayId}`;
                    showConfirmationModal(
                        `This will set ${gatewayLabel} as the active gateway and start the sensor discovery process. Any current polling will be stopped. Continue?`,
                        `Set Active Gateway`,
                        () => {
                            if (gatewayListContainer) gatewayListContainer.classList.add('gateway-switch-busy');
                            // Clear existing devices immediately
                            latestDeviceData.sensors = [];
                            latestDeviceData.gateway = {};
                            applyFiltersAndRender();
                            socket.emit('set-active-gateway', gatewayId, true); // Pass true to auto-start polling
                        }
                    );
                } else {
                    if (gatewayListContainer) gatewayListContainer.classList.add('gateway-switch-busy');
                    // Clear existing devices immediately
                    latestDeviceData.sensors = [];
                    latestDeviceData.gateway = {};
                    applyFiltersAndRender();
                    socket.emit('set-active-gateway', null);
                }
            } else if (card) {
                 // Prevent card selection if an info button was clicked
                if (e.target.closest('.info-icon-btn')) {
                    return;
                }
                document.querySelectorAll('.gateway-list-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedGateway = { id: card.dataset.id, ip: card.dataset.ip };

                card.classList.add('refreshing');
                socket.emit('refresh-gateway-status', selectedGateway.ip);

                gatewayConfigContainer.classList.remove('hidden');
                if (document.querySelector('.sub-tab-link[data-page="status"]')) {
                    document.querySelector('.sub-tab-link[data-page="status"]').click();
                }
            }
        });
    }

    if (subTabs) {
        subTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                if (selectedGateway) {
                    const page = tab.dataset.page;
                    subTabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    gatewayConfigContent.innerHTML = '<div class="spinner-container" style="display: flex; justify-content: center; padding: 20px;"><div class="spinner"></div></div>';
                    socket.emit('gateway-get-settings', { ip: selectedGateway.ip, page: page });
                }
            });
        });
    }

    if (gatewayConfigContent) {
        gatewayConfigContent.addEventListener('click', (e) => {
            if (e.target.matches('input[type="submit"], button[type="submit"]')) {
                e.preventDefault();
                const form = e.target.closest('form');
                if (!form || !selectedGateway) return;

                showConfirmationModal(
                    'Applying this setting may cause the gateway to reboot. Do you want to continue?',
                    'Confirm Save & Reboot',
                    () => {
                        const formData = new FormData(form);
                        const data = Object.fromEntries(formData.entries());
                        const page = document.querySelector('.sub-tab-link.active')?.dataset.page;

                        if (page) {
                            gatewayConfigContent.innerHTML = '<p>Applying settings... The gateway will now reboot. Please wait.</p>';
                            handleGatewayReboot(selectedGateway.ip);
                            socket.emit('gateway-save-settings', { ip: selectedGateway.ip, page, formData: data });
                        }
                    }
                );
            }

            if(e.target.id === 'reboot-gateway-btn' && selectedGateway) {
                showConfirmationModal(
                    `Are you sure you want to reboot the gateway at ${selectedGateway.ip}?`,
                    "Reboot Gateway",
                    () => { socket.emit('gateway-reboot', { ip: selectedGateway.ip }); }
                );
            }

            // FIX: Add event handlers for the memory reset buttons
            if (e.target.id === 'reset-data-memory' && selectedGateway) {
                showConfirmationModal(
                    'Are you sure you want to reset the gateway\'s data memory? This will erase the local cache of sensor readings on the gateway itself. This action cannot be undone and will cause the gateway to reboot.',
                    'Confirm Reset Data Memory',
                    () => {
                        const page = 'misc';
                        const formData = { action: 'reset-data-memory' };
                        handleGatewayReboot(selectedGateway.ip);
                        socket.emit('gateway-save-settings', { ip: selectedGateway.ip, page, formData });
                    }
                );
            }

            if (e.target.id === 'reset-config-memory' && selectedGateway) {
                showConfirmationModal(
                    'WARNING: Are you sure you want to reset the gateway\'s configuration memory? This will restore the gateway to its factory default settings. This action cannot be undone and will cause the gateway to reboot.',
                    'Confirm Reset Configuration Memory',
                    () => {
                        const page = 'misc';
                        const formData = { action: 'reset-config-memory' };
                        handleGatewayReboot(selectedGateway.ip);
                        socket.emit('gateway-save-settings', { ip: selectedGateway.ip, page, formData });
                    }
                );
            }

            if (e.target.id === 'write-access-info-btn-banner') {
                writeAccessInfoModal.classList.remove('hidden');
            }
        });

        // Delegated 'change' listener for dynamic content within gatewayConfigContent
        gatewayConfigContent.addEventListener('change', (e) => {
            // SNMP Trap visibility toggle
            if (e.target.id === 'snmp-traps-enable') {
                const isEnabled = e.target.value === '1';
                document.querySelectorAll('.snmp-trap-option').forEach(el => {
                    el.classList.toggle('hidden', !isEnabled);
                });
            }
        });
    }

    // --- Device & Sensor Interactions ---

    // Combined listener for Monnit device card clicks
    if (deviceCardsContainer) {
        deviceCardsContainer.addEventListener('click', (e) => {
            // FIX: Updated exclusion logic to allow clicking the name text for navigation
            // We block clicks ONLY if they hit a button, selector, or the input field itself
            if (e.target.closest('.icon-button') ||
                e.target.closest('.color-group-selector') ||
                e.target.closest('.sensor-name-input')) {
                return;
            }

            const card = e.target.closest('.device-card:not(.gateway-card)');
            const gatewayCard = e.target.closest('.gateway-card');
            const header = e.target.closest('.sortable');

            if (header && deviceCardsContainer.classList.contains('list-view')) {
                const sortKey = header.dataset.sort;
                if (currentSort.key === sortKey) {
                    currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.key = sortKey;
                    currentSort.direction = 'asc';
                }
                applyFiltersAndRender();
            } else if (card || gatewayCard) {
                const deviceCard = card || gatewayCard;
                const deviceId = deviceCard.dataset.deviceId;
                const isGateway = deviceCard.dataset.isGateway === 'true';

                exportCsvBtn.style.display = isGateway ? 'none' : 'block';

                setupDetailTabs(isGateway, false); // isExternal = false
                setDefaultDateRange(); // Set default 24-hour range
                mainDashboardView.classList.add('hidden');
                deviceDetailsView.classList.remove('hidden');
                currentDetailsDeviceId = deviceId;
                currentDetailsIsGateway = isGateway;
                currentDetailsExternalDeviceId = null;
                detailsDeviceId.textContent = `${isGateway ? 'Gateway' : 'Sensor'} ${deviceId}`;
                historyContent.innerHTML = '<p>Loading history...</p>';
                alertHistoryContent.innerHTML = '<p>Loading alert history...</p>'; // ADDED
                detailsContent.innerHTML = '<p>Loading details...</p>'; // ADDED

                if (historyChart) historyChart.destroy();
                const chartContainer = document.querySelector('#charts-content .chart-container');
                chartContainer.innerHTML = '<p class="no-data-message">Loading chart data...</p>';

                if (isGateway) {
                    const gw = latestDeviceData.gateways?.find(g => g.gatewayId == deviceId);
                    if (gw?.ip) socket.emit('refresh-gateway-status', gw.ip);
                }
                console.log(`[CLIENT] Requesting history for deviceId: ${deviceId}`);
                socket.emit('get-device-history', { deviceId, isGateway: isGateway });
            }
        });

         // Delegated listener for controls *within* Monnit sensor cards
        deviceCardsContainer.addEventListener('click', (e) => {
            const alertToggle = e.target.closest('.alert-toggle-btn');
            const alertConfig = e.target.closest('.alert-config-btn');
            const editNameBtn = e.target.closest('.edit-name-btn');

            if (alertToggle) {
                const sensorId = parseInt(alertToggle.dataset.sensorId, 10);
                const currentConfig = alertConfigs[sensorId] || { isEnabled: 0 };
                const isEnabled = currentConfig.isEnabled === 1;
                 showConfirmationModal(
                    `Are you sure you want to ${isEnabled ? 'disable' : 'enable'} alerts for sensor ${sensorId}?`,
                    `${isEnabled ? 'Disable' : 'Enable'} Alerts`,
                    () => {
                        socket.emit('save-alert-config', { sensorId, isEnabled: !isEnabled });
                    }
                );

            } else if (alertConfig) {
                const sensorId = parseInt(alertConfig.dataset.sensorId, 10);
                currentSensorForAlertConfig = sensorId;
                const config = alertConfigs[sensorId] || {};
                const sensor = (latestDeviceData.sensors || []).find(s => s.sensorId === sensorId);
                alertConfigTitle.textContent = `Configure Alert for Sensor ${sensorId}`;
                currentAlertChartableData = [];
                if (alertDatumSelect) {
                    alertDatumSelect.innerHTML = '';
                    if (sensor && typeof window.parseSensorData === 'function') {
                        try {
                            const parsed = window.parseSensorData(sensor);
                            currentAlertChartableData = parsed.chartableData || [];
                            currentAlertChartableData.forEach((d, i) => {
                                const opt = document.createElement('option');
                                opt.value = String(i);
                                opt.textContent = d.label;
                                alertDatumSelect.appendChild(opt);
                            });
                            if (currentAlertChartableData.length === 0) {
                                const opt = document.createElement('option');
                                opt.value = '0';
                                opt.textContent = '—';
                                alertDatumSelect.appendChild(opt);
                            }
                        } catch (_) {
                            const opt = document.createElement('option');
                            opt.value = '0';
                            opt.textContent = '—';
                            alertDatumSelect.appendChild(opt);
                        }
                    } else {
                        const opt = document.createElement('option');
                        opt.value = '0';
                        opt.textContent = '—';
                        alertDatumSelect.appendChild(opt);
                    }
                    alertDatumSelect.value = String(config.dataIndex ?? 0);
                }
                updateAlertConfigUIFromDatum();
                const validCond = ['above','below','equal','not_equal'].includes(config.condition) ? config.condition : 'above';
                if (alertCondition.querySelector(`option[value="${validCond}"]`)) {
                    alertCondition.value = validCond;
                }
                alertThreshold.value = config.threshold ?? 0;
                if (alertThresholdDiscrete) alertThresholdDiscrete.value = String(config.threshold ?? 0);
                alertConfigModal.classList.remove('hidden');

            } else if (editNameBtn) {
                // Unified name editing logic for Monnit
                const nameContainer = editNameBtn.closest('.sensor-name-container');
                const sensorId = nameContainer.dataset.sensorId;
                const nameSpan = nameContainer.querySelector('.sensor-custom-name');
                const currentName = sensorMetadata[sensorId]?.customName || '';

                // Flag to prevent double-save (blur + enter)
                let isSaving = false;

                // FIX: Allow full width for input
                nameSpan.style.maxWidth = '100%';
                // FIX: Prevent overflow clipping during edit
                nameSpan.style.overflow = 'visible';

                nameSpan.innerHTML = `
                    <input type="text" class="sensor-name-input" value="${currentName}" maxlength="20" placeholder="Enter name...">
                `;
                const input = nameSpan.querySelector('input');
                input.focus();
                input.select();

                // Cleanup helper
                const cleanup = (finalName) => {
                    if (!document.body.contains(nameSpan)) return;
                    nameSpan.style.maxWidth = ''; // Reset style
                    nameSpan.style.overflow = ''; // Reset overflow
                    nameSpan.textContent = finalName || 'Click to add name';
                    if (!finalName) nameSpan.classList.add('placeholder');
                };

                const saveName = () => {
                    if (isSaving) return;
                    isSaving = true;

                    const newName = input.value.trim();
                    if (newName !== currentName) {
                        // Remove input immediately to unblock re-rendering
                        cleanup(newName);

                        showConfirmationModal(
                            `Save the new name "${newName}" for sensor ${sensorId}?`,
                            'Confirm Name Change',
                            () => {
                                // OPTIMISTIC UPDATE FIX
                                if (!sensorMetadata[sensorId]) sensorMetadata[sensorId] = {};
                                sensorMetadata[sensorId].customName = newName;

                                socket.emit('save-sensor-metadata', { sensorId, customName: newName });
                            }
                        );

                        // Revert if cancelled
                        const oldCancel = confirmCancelBtn.onclick;
                        confirmCancelBtn.onclick = () => {
                            if (typeof oldCancel === 'function') oldCancel();

                            // REVERT OPTIMISTIC UPDATE
                            sensorMetadata[sensorId].customName = currentName;
                            cleanup(currentName);

                            confirmCancelBtn.onclick = oldCancel;
                        };
                    } else {
                         cleanup(currentName);
                    }
                };

                const cancelEdit = () => {
                    if (isSaving) return;
                    cleanup(currentName);
                }

                input.addEventListener('blur', () => {
                    // Small delay to allow for other click events
                    setTimeout(() => {
                        if (document.activeElement !== input && !isSaving) {
                            saveName();
                        }
                    }, 100);
                });

                input.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        input.blur();
                    } else if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelEdit();
                    }
                });
            }
        });

        // Delegated change listener for Monnit color groups
        deviceCardsContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('color-group-selector')) {
                const sensorId = e.target.dataset.sensorId;
                const colorGroup = e.target.value;
                // FIX: Blur immediately to allow re-render
                e.target.blur();
                socket.emit('save-sensor-metadata', { sensorId, colorGroup });
            }
        });
    }

    // --- New Listeners for External Devices ---

    // Click handler for external device cards
    if (externalDeviceCardsContainer) {
        externalDeviceCardsContainer.addEventListener('click', (e) => {
            // FIX: Updated exclusion logic to allow clicking the name text for navigation
            if (e.target.closest('.icon-button') ||
                e.target.closest('.color-group-selector') ||
                e.target.closest('.sensor-name-input')) {
                return;
            }

            const card = e.target.closest('.device-card');
            if (card) {
                const deviceId = card.dataset.deviceId;

                exportCsvBtn.style.display = 'block'; // External history is exportable
                setupDetailTabs(false, true); // isGateway = false, isExternal = true
                setDefaultDateRange(); // Set default 24-hour range
                mainDashboardView.classList.add('hidden');
                deviceDetailsView.classList.remove('hidden');
                currentDetailsDeviceId = null;
                currentDetailsExternalDeviceId = deviceId;

                const device = latestExternalDevices.find(d => d.id === deviceId);
                const deviceName = externalMetadata[deviceId]?.customName || device?.name || 'External Device';
                detailsDeviceId.textContent = `${deviceName}`;

                // Clear all content areas
                historyContent.innerHTML = '<p>Loading history...</p>';
                alertHistoryContent.innerHTML = '<p>Loading alert history...</p>'; // ADDED
                detailsContent.innerHTML = '<p>Loading details...</p>';
                if (historyChart) historyChart.destroy();
                document.querySelector('#charts-content .chart-container').innerHTML = '';

                // Render details immediately from cached data
                renderExternalDetails(deviceId);
                // Request history from server
                socket.emit('get-external-device-history', deviceId);
            }
        });

        // Delegated listener for controls *within* external sensor cards
        externalDeviceCardsContainer.addEventListener('click', (e) => {
            const editNameBtn = e.target.closest('.edit-name-btn');
            if (editNameBtn) {
                // Unified name editing logic for External Devices
                const nameContainer = editNameBtn.closest('.sensor-name-container');
                const deviceId = nameContainer.dataset.sensorId;
                const nameSpan = nameContainer.querySelector('.sensor-custom-name');
                const currentName = nameSpan.textContent.trim();

                // Flag to prevent double-firing (blur + enter)
                let isSaving = false;

                // FIX: Allow full width for input
                nameSpan.style.maxWidth = '100%';
                // FIX: Prevent overflow clipping during edit
                nameSpan.style.overflow = 'visible';

                nameSpan.innerHTML = `
                    <input type="text" class="sensor-name-input" value="${currentName}" maxlength="20" placeholder="Enter name...">
                `;
                const input = nameSpan.querySelector('input');
                input.focus();
                input.select();

                // Cleanup function to remove input and restore text
                const cleanup = (finalName) => {
                    if (!document.body.contains(nameSpan)) return; // Element might be gone if re-rendered
                    nameSpan.style.maxWidth = ''; // Reset style
                    nameSpan.style.overflow = ''; // Reset overflow
                    nameSpan.textContent = finalName || 'Click to add name';
                    if (!finalName) nameSpan.classList.add('placeholder');
                };

                const saveName = () => {
                    if (isSaving) return;
                    isSaving = true;

                    const newName = input.value.trim();
                    if (newName !== currentName) {
                        // Remove input immediately to prevent re-render blocking
                        cleanup(newName);

                        showConfirmationModal(
                            `Save the new name "${newName}" for device ${deviceId}?`,
                            'Confirm Name Change',
                            () => {
                                // OPTIMISTIC UPDATE FIX
                                if (!externalMetadata[deviceId]) externalMetadata[deviceId] = {};
                                externalMetadata[deviceId].customName = newName;

                                socket.emit('save-external-device-metadata', { deviceId, customName: newName });
                            }
                        );

                        // Revert callback for cancel
                        const oldCancel = confirmCancelBtn.onclick;
                        confirmCancelBtn.onclick = () => {
                            if(typeof oldCancel === 'function') oldCancel();

                            // REVERT OPTIMISTIC UPDATE
                            externalMetadata[deviceId].customName = currentName;
                            cleanup(currentName);

                            confirmCancelBtn.onclick = oldCancel;
                        };

                    } else {
                        cleanup(currentName);
                    }
                };

                const cancelEdit = () => {
                     if (isSaving) return;
                     cleanup(currentName);
                }

                input.addEventListener('blur', () => {
                     setTimeout(() => {
                        if (document.activeElement !== input && !isSaving) {
                            saveName();
                        }
                    }, 100);
                });

                input.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault(); // Prevent default form submission if any
                        input.blur(); // Trigger blur which calls saveName
                    } else if (event.key === 'Escape') {
                        event.preventDefault();
                        cancelEdit();
                    }
                });
            }
        });

        // Delegated change listener for external color groups
        externalDeviceCardsContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('color-group-selector')) {
                const deviceId = e.target.dataset.sensorId; // We use sensorId attribute for both
                const colorGroup = e.target.value;
                // FIX: Blur immediately to allow re-render
                e.target.blur();
                socket.emit('save-external-device-metadata', { deviceId, colorGroup });
            }
        });
    }

    // --- Detail View Interactions ---

    if (backToDashboardBtn) {
        backToDashboardBtn.addEventListener('click', () => {
            deviceDetailsView.classList.add('hidden');
            mainDashboardView.classList.remove('hidden');
            currentDetailsDeviceId = null;
            currentDetailsIsGateway = false;
            currentDetailsExternalDeviceId = null;
            // Clear history data to prevent memory leaks
            currentHistoryData = [];
            currentExternalHistoryData = {};
        });
    }

    if (detailsTabsContainer) {
        detailsTabsContainer.addEventListener('click', (e) => {
            const tab = e.target.closest('.details-tab-link');
            if (tab) {
                detailsTabs.forEach(item => item.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.details-tab-content').forEach(content => content.classList.remove('active'));
                document.getElementById(`${tab.dataset.tab}-content`).classList.add('active');

                // Re-render chart or history if the tab is clicked and data is available
                if(tab.dataset.tab === 'charts' && !isDetailViewForExternal) {
                    renderChart();
                }
                if(tab.dataset.tab === 'history') {
                    if (isDetailViewForExternal) {
                        // FIX: Safety check for records undefined
                        const recs = currentExternalHistoryData.records || [];
                        renderExternalHistory(currentExternalHistoryData.deviceId, recs);
                    } else {
                        // FIX: Safety check for records undefined
                        const recs = currentHistoryData || [];
                        renderHistory(recs, isDetailViewForGateway);
                    }
                }
                // ADDED: Refresh alert history on date change
                if(tab.dataset.tab === 'alert-history' && !isDetailViewForExternal) {
                    // FIX: Safety check for records undefined
                    const recs = currentHistoryData || [];
                    renderAlertHistory(recs);
                }

                if (tab.dataset.tab === 'sensor-list') {
                    renderSensorList();
                }

                if (tab.dataset.tab === 'modbus-registers') {
                    renderModbusRegisters();
                }
                if (tab.id === 'details-tab-settings' && isDetailViewForGateway) {
                     const mainSettingsTab = document.querySelector('.tab-link[data-tab="gateway-settings-content"]');
                     if(mainSettingsTab) {
                        if (backToDashboardBtn) backToDashboardBtn.click();
                        mainSettingsTab.click();
                        const gid = currentDetailsDeviceId ?? getEffectiveActiveGatewayId();
                        const gatewayInList = gid != null ? document.querySelector(`.gateway-list-card[data-id="${gid}"]`) : null;
                        if (gatewayInList) gatewayInList.click();
                     }
                }
            }
        });
    }

    // FIX: Updated Click Handler for MODBUS Read Registers
    if (modbusRegistersContent) {
        modbusRegistersContent.addEventListener('click', (e) => {
            if (e.target.id === 'read-registers-btn') {
                const registerType = document.getElementById('register-type').value;
                let start, count;

                if (registerType === 'gateway') {
                    start = 0;
                    count = 5;
                } else if (registerType === 'sensor') {
                    const slot = document.getElementById('modbus-sensor-select').value;
                    if (!slot) {
                        showInfoModal('Selection Required', 'Please select a sensor to poll.');
                        return;
                    }
                    // Calculate register based on slot (Monnit Standard)
                    // Register = 100 + (Slot - 1) * 16
                    start = 100 + (parseInt(slot, 10) - 1) * 16;
                    count = 16;
                } else { // Custom
                    start = parseInt(document.getElementById('register-range-start').value, 10);
                    count = parseInt(document.getElementById('register-range-count').value, 10);
                    if (isNaN(start) || isNaN(count)) return;
                }

                const ip = getEffectiveActiveGatewayIp();

                if (ip) {
                    document.getElementById('modbus-results-container').innerHTML = '<div class="spinner-container" style="display: flex; justify-content: center;"><div class="spinner"></div></div>';

                    // Clear any existing timeout
                    if (readRegisterTimeout) clearTimeout(readRegisterTimeout);

                    // Set a new timeout
                    readRegisterTimeout = setTimeout(() => {
                        const container = document.getElementById('modbus-results-container');
                        container.innerHTML = `<p class="no-data-message" style="color: var(--danger-accent);">Request timed out after 60 seconds.</p>`;
                    }, 60000);

                    socket.emit('get-modbus-registers', { ip, start, count });
                } else {
                    showInfoModal(
                        'No Active Gateway',
                        'Choose an active gateway under Gateway Settings, or start polling so the app can resolve the gateway IP.'
                    );
                }
            }
        });

        // FIX: Updated Change Handler for MODBUS Register Dropdown
        modbusRegistersContent.addEventListener('change', (e) => {
            if (e.target.id === 'register-type') {
                const type = e.target.value;
                const sensorGroup = document.getElementById('sensor-select-group');
                const startGroup = document.getElementById('register-range-start-group');
                const countGroup = document.getElementById('register-range-count-group');
                const resultsContainer = document.getElementById('modbus-results-container');

                // Reset UI State
                sensorGroup.classList.add('hidden');
                startGroup.style.display = 'none';
                countGroup.style.display = 'none';
                resultsContainer.innerHTML = '<p class="no-data-message">Click "Read Registers" to view data.</p>';

                if (type === 'gateway') {
                    // Gateway Status (Registers 0-4) - Fixed, hidden inputs
                } else if (type === 'sensor') {
                    // Specific Sensor - Show Dropdown
                    sensorGroup.classList.remove('hidden');
                } else { // Custom
                    startGroup.style.display = 'block';
                    countGroup.style.display = 'block';
                }
            }
        });
    }

    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportHistoryToCSV);

    // Re-render history/chart when date range changes
    [startDateInput, endDateInput].forEach(el => {
        if (el) {
            el.addEventListener('change', () => {
                if (isDetailViewForExternal) {
                    renderExternalHistory(currentExternalHistoryData.deviceId, currentExternalHistoryData.records);
                } else {
                    renderHistory(currentHistoryData, isDetailViewForGateway);
                    if (document.getElementById('details-tab-charts').classList.contains('active')) {
                        renderChart();
                    }
                    // ADDED: Refresh alert history on date change
                    if (document.getElementById('details-tab-alert-history').classList.contains('active')) {
                        renderAlertHistory(currentHistoryData);
                    }
                }
            });
        }
    });

    [typeFilter, awareFilter, batteryFilter, signalFilter, colorGroupFilter].forEach(el => {
        if (el) {
            el.addEventListener('input', applyFiltersAndRender);
        }
    });

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            typeFilter.value = 'all';
            awareFilter.value = 'all';
            batteryFilter.value = 'all';
            signalFilter.value = 'all';
            colorGroupFilter.value = 'all';
            applyFiltersAndRender();
        });
    }

    // --- Modals & Confirmation ---

    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', () => {
            if (confirmModalTitle.textContent.includes('Set Active Gateway')) {
                document.querySelectorAll('.active-gateway-toggle').forEach(toggle => {
                    const gatewayId = parseInt(toggle.dataset.id, 10);
                    const gatewayData = latestDeviceData.gateways?.find(g => g.gatewayId === gatewayId);
                    if (gatewayData) {
                        toggle.checked = !!gatewayData.isActive;
                    }
                });
            }
            confirmModal.classList.add('hidden');
            confirmCallback = null;
        });
    }

    if (confirmOkBtn) {
        confirmOkBtn.addEventListener('click', () => {
            if (typeof confirmCallback === 'function') {
                confirmCallback();
            }
            confirmModal.classList.add('hidden');
        });
    }

    if (infoOkBtn) infoOkBtn.addEventListener('click', () => infoModal.classList.add('hidden'));

    if (timeoutRetryBtn) {
        timeoutRetryBtn.addEventListener('click', () => {
            if (timedOutGateway && timedOutGateway.ip) {
                setPollConnecting(true);
                socket.emit('start-polling', timedOutGateway.ip);
            }
            timeoutModal.classList.add('hidden');
        });
    }

    if (timeoutRemoveBtn) {
        timeoutRemoveBtn.addEventListener('click', () => {
            if (timedOutGateway && timedOutGateway.gatewayId) {
                socket.emit('remove-gateway', timedOutGateway.gatewayId);
            }
            timeoutModal.classList.add('hidden');
        });
    }

    if (saveAlertConfigBtn) {
        saveAlertConfigBtn.addEventListener('click', () => {
            if (currentSensorForAlertConfig) {
                const datumEl = document.getElementById('alert-datum');
                const datumIndex = datumEl ? parseInt(datumEl.value, 10) : 0;
                const datum = (typeof currentAlertChartableData !== 'undefined' ? currentAlertChartableData : [])[datumIndex];
                const isDiscrete = datum && datum.valueType === 'discrete';
                const thresholdVal = isDiscrete && alertThresholdDiscrete
                    ? parseFloat(alertThresholdDiscrete.value)
                    : parseFloat(alertThreshold.value);
                const config = {
                    sensorId: currentSensorForAlertConfig,
                    condition: alertCondition.value,
                    threshold: isNaN(thresholdVal) ? 0 : thresholdVal,
                    dataIndex: datumIndex
                };
                socket.emit('save-alert-config', config);
                alertConfigModal.classList.add('hidden');
            }
        });
    }

    if (alertDatumSelect) {
        alertDatumSelect.addEventListener('change', () => {
            const prevCondition = alertCondition.value;
            updateAlertConfigUIFromDatum();
            if (alertCondition.querySelector(`option[value="${prevCondition}"]`)) {
                alertCondition.value = prevCondition;
            }
            alertThreshold.value = 0;
            if (alertThresholdDiscrete) alertThresholdDiscrete.value = '0';
        });
    }

    if (cancelAlertConfigBtn) cancelAlertConfigBtn.addEventListener('click', () => alertConfigModal.classList.add('hidden'));

    if (alertConfigModal) {
        const closeBtn = alertConfigModal.querySelector('.close-button');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => alertConfigModal.classList.add('hidden'));
        }
    }



    if (gatewayInfoBtn) gatewayInfoBtn.addEventListener('click', () => gatewayInfoModal.classList.remove('hidden'));
    if (closeGatewayInfoModalBtn) closeGatewayInfoModalBtn.addEventListener('click', () => gatewayInfoModal.classList.add('hidden'));

    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.write-access-info-trigger')) {
            writeAccessInfoModal.classList.remove('hidden');
        }
        if (e.target.closest('.modbus-disabled-info-trigger')) {
            document.getElementById('modbus-disabled-info-modal').classList.remove('hidden');
        }
        if (e.target.closest('#modbus-blocking-enable-btn')) {
            if (modbusBlockingGatewayIp) {
                socket.emit('setup-enable-modbus', modbusBlockingGatewayIp);
            }
        }
        if (e.target.closest('.gateway-locked-info-trigger')) {
            document.getElementById('gateway-locked-info-modal').classList.remove('hidden');
        }
        if (e.target.closest('.default-server-info-trigger')) {
            document.getElementById('default-server-info-modal').classList.remove('hidden');
        }
        if (e.target.closest('.info-ok-btn')) {
            e.target.closest('.modal').classList.add('hidden');
        }
         if (e.target.closest('.close-button')) {
            e.target.closest('.modal').classList.add('hidden');
            if (e.target.closest('#modbus-disabled-blocking-modal')) modbusBlockingGatewayIp = null;
        }
        if (e.target.closest('.info-ok-btn') && e.target.closest('#modbus-disabled-blocking-modal')) {
            modbusBlockingGatewayIp = null;
        }
    });

    if (closeWriteAccessInfoModalBtn) closeWriteAccessInfoModalBtn.addEventListener('click', () => writeAccessInfoModal.classList.add('hidden'));

    // --- Application Update Listeners ---
    if (checkUpdatesBtn) {
        checkUpdatesBtn.addEventListener('click', () => {
            if (updateStatusMessage) {
                updateStatusMessage.textContent = 'Checking...';
                updateStatusMessage.style.color = 'var(--text-color)';
            }
            socket.emit('check-for-updates');
        });
    }

    // --- Socket Event Listeners for Scan Progress ---
    socket.on('scan-status-update', (msg) => {
        const scanCurrentStatus = document.getElementById('scan-current-status');
        if (scanCurrentStatus) {
            scanCurrentStatus.textContent = msg;
        }
        const scanProgressLog = document.getElementById('scan-progress-log');
        if (scanProgressLog) {
            const entry = document.createElement('div');
            entry.textContent = msg;
            scanProgressLog.prepend(entry);
        }
    });

    socket.on('scan-results', (gateways) => {
        hideScanProgressModal(); // Hide modal when scan results are received
        // Further logic to display results in findGatewayModal if needed
        // For now, just hide the progress modal
    });

});
