// public/setup.js

// --- DOM Elements ---
var socket;
var mainTitle, wizardContainer, steps, nextBtn, prevBtn;
var scanNetworkBtn, scanStatus, scanResultsContainer, manualAddPrompt;
var manualInput, addManualBtn;
var currentStepIndex = 0;
var selectedGatewayIp = null;
var selectedGatewayId = null;
var isScanning = false;
var scanTimeout = null;

// TRACKER: Prevent redundant command emissions
window.modbusCommandTriggered = false;

// --- State ---
var gatewayAnalysis = {}; 
let stepHistory = ['step-1-scan'];
let dynamicPath = [];
let currentPathIndex = 0;
let discoveredGateways = [];

/* ===========================================================
   LOGIC FUNCTIONS (HOISTED DEFINITIONS)
   Defined BEFORE they are called in DOMContentLoaded
   =========================================================== */

function getCurrentStepId() {
    return dynamicPath.length > 0 ? dynamicPath[currentPathIndex] : stepHistory[stepHistory.length - 1];
}

function updateWizardState() {
    const currentStepId = getCurrentStepId();
    steps.forEach(step => step.classList.remove('active'));
    const currentStepEl = document.getElementById(currentStepId);
    if(currentStepEl) currentStepEl.classList.add('active');

    // --- FIX: Automatically trigger command when entering action step ---
    if (currentStepId === 'step-action-enable-modbus') {
        if (!window.modbusCommandTriggered) {
            window.modbusCommandTriggered = true;
            console.log('[SETUP] Step active: step-action-enable-modbus. Triggering setup-enable-modbus.');
            socket.emit('setup-enable-modbus', selectedGatewayIp);
        }
    }

    const navigation = document.querySelector('.setup-navigation');
    if (navigation) {
        navigation.style.display = currentStepId === 'step-1-scan' ? 'none' : 'flex';
    }

    if (prevBtn) {
        const isFirstStep = (dynamicPath.length > 0 && currentPathIndex === 0) || (dynamicPath.length === 0 && stepHistory.length === 1);
        prevBtn.disabled = isFirstStep;
        if(isFirstStep) prevBtn.classList.add('hidden');
        else prevBtn.classList.remove('hidden');
    }
    
    if (nextBtn && currentStepEl) {
        const hasSelectionGroup = currentStepEl.querySelector('.selection-group');
        const isTerminalStep = ['step-needs-unlock'].includes(currentStepId);
        const isActionStep = currentStepId.startsWith('step-action-');
        
        if (hasSelectionGroup || isTerminalStep || isActionStep) {
            nextBtn.classList.add('hidden');
        } else {
            nextBtn.classList.remove('hidden');
        }
    }
    
    const footer = document.getElementById('wizard-footer');
    if (footer) footer.style.display = 'flex';
}

function startScan() {
    isScanning = true;
    if (scanNetworkBtn) {
        scanNetworkBtn.disabled = true;
        scanNetworkBtn.textContent = "Scanning...";
    }
    if (scanResultsContainer) {
        scanResultsContainer.innerHTML = '<div class="spinner"></div>';
    }
    socket.emit('scan-for-gateways');
}

function renderScanResults(gateways) {
    if (!scanResultsContainer) return;
    
    scanResultsContainer.innerHTML = '';
    if (!gateways || gateways.length === 0) {
        scanResultsContainer.innerHTML = '<p>No gateways found.</p>';
        return;
    }

    const list = document.createElement('div');
    list.className = 'scan-result-list';
    
    gateways.forEach(gw => {
        const item = document.createElement('div');
        item.className = 'scan-result-item setup-card';
        item.dataset.ip = gw.ip; 
        item.innerHTML = `
            <div>
                <input type="checkbox" class="gateway-checkbox" data-ip="${gw.ip}" data-id="${gw.gatewayId}" style="margin-right: 10px;">
                <strong>Gateway ID: ${gw.gatewayId}</strong><br>
                <small>${gw.ip}</small>
            </div>
            <button class="button select-gateway-btn" data-ip="${gw.ip}" data-id="${gw.gatewayId}">Select</button>
        `;
        list.appendChild(item);
    });
    
    scanResultsContainer.appendChild(list);

    const bulkContainer = document.createElement('div');
    bulkContainer.className = 'bulk-actions';
    bulkContainer.style = "margin-top: 20px; display: flex; justify-content: center;";
    bulkContainer.innerHTML = `<button id="add-selected-gateways" class="button secondary-btn">Add Selected Gateways</button>`;
    scanResultsContainer.appendChild(bulkContainer);

    document.querySelectorAll('.select-gateway-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            selectedGatewayIp = e.target.dataset.ip;
            selectedGatewayId = e.target.dataset.id;
            document.querySelectorAll('.setup-card').forEach(c => c.classList.remove('selected'));
            e.target.closest('.setup-card').classList.add('selected');
            const prompt = document.getElementById('select-gateway-prompt');
            if (prompt) prompt.classList.add('hidden');
            
            socket.emit('get-gateway-setup-details', selectedGatewayIp);
            if (typeof showLoadingModal === 'function') showLoadingModal("Connecting to gateway...");
        });
    });
}

function validateStep(stepIndex) {
    const currentStepId = getCurrentStepId();
    if (currentStepId === 'step-1-scan') {
        if (!selectedGatewayIp) {
            const prompt = document.getElementById('select-gateway-prompt');
            if (prompt) prompt.classList.remove('hidden');
            return false;
        }
    }
    return true;
}

function navigateToStep(stepId) {
    stepHistory.push(stepId);
    updateWizardState();
}

function goToStep(index) {
    if (index === 1) {
        navigateToStep('step-2-analyze');
    }
}

function activateStep(stepId) {
    navigateToStep(stepId);
}

function analyzeGateway() {
    const gw = gatewayAnalysis;
    
    // STEP 1: Check HTTP Interface Access Mode FIRST
    if (gw.isReadOnly) {
        // Show write-access modal - this is the primary blocker
        const modal = document.getElementById('read-only-confirm-modal');
        if (modal) modal.classList.remove('hidden');
        return;
    }
    
    // STEP 2: Check MODBUS TCP Interface (now that we have write-access)
    if (!gw.isModbusActive) {
        // Try to enable MODBUS since we have write-access
        window.modbusCommandTriggered = false;
        startDynamicPath(['step-action-enable-modbus']);
        return;
    }
    
    // STEP 3: Check Default Server Status (only after write-access is confirmed)
    const dsStatus = gw.defaultServerStatus ? gw.defaultServerStatus.toLowerCase() : '';
    
    if (dsStatus.includes('on') && dsStatus.includes('error')) {
        // Only show unlock message if server is "On and Server Error"
        startDynamicPath(['step-summary-hybrid-error']);
        return;
    }
    
    if (dsStatus.includes('on')) {
        // Server is working normally - proceed to hybrid mode
        startDynamicPath(['step-summary-perfect-hybrid']);
        return;
    }
    
    // Server is off - proceed to private mode
    startDynamicPath(['step-summary-perfect-private']);
}

function startDynamicPath(path) {
    dynamicPath = path;
    currentPathIndex = 0;
    updateWizardState();
}

function finishSetup() {
    console.log('[SETUP] finishSetup called. Setting active gateway:', selectedGatewayId);
    socket.emit('set-active-gateway', selectedGatewayId);
    
    dynamicPath = []; 
    stepHistory = ['step-finish']; 
    currentPathIndex = 0;
    
    updateWizardState();
}

function completeSetup() {
    console.log('[SETUP] Sending setup-complete event...');
    socket.emit('setup-complete');
}

function openSkipSetupModal() {
    const modal = document.getElementById('skip-setup-modal');
    const confirmBtn = document.getElementById('skip-setup-confirm-btn');
    if (confirmBtn) {
        confirmBtn.textContent = 'Yes, Skip Setup';
        confirmBtn.disabled = false;
    }
    if (modal) modal.classList.remove('hidden');
}

function resetWizard() {
    stepHistory = ['step-1-scan'];
    dynamicPath = [];
    currentPathIndex = 0;
    selectedGatewayIp = null;
    selectedGatewayId = null;
    gatewayAnalysis = {};
    window.modbusCommandTriggered = false;
    
    if (isScanning) {
        socket.emit('cancel-scan');
        isScanning = false;
        if (scanNetworkBtn) {
            scanNetworkBtn.disabled = false;
            scanNetworkBtn.textContent = "Scan Local Network";
        }
    }
    
    if (scanResultsContainer) scanResultsContainer.innerHTML = '';
    if (scanStatus) scanStatus.textContent = '';
    const prompt = document.getElementById('select-gateway-prompt');
    if (prompt) prompt.classList.add('hidden');

    updateWizardState();
}

/* ===========================================================
   INITIALIZATION
   =========================================================== */
document.addEventListener('DOMContentLoaded', () => {
    
    // FIX: Use window.socket directly without checking for window.api
    socket = window.socket;

    mainTitle = document.getElementById('main-title');
    wizardContainer = document.getElementById('setup-wizard');
    steps = document.querySelectorAll('.setup-step');
    nextBtn = document.getElementById('next-btn');
    prevBtn = document.getElementById('prev-btn');
    
    scanNetworkBtn = document.getElementById('scan-network-btn');
    scanStatus = document.getElementById('scan-status');
    scanResultsContainer = document.getElementById('scan-results-container');
    
    manualInput = document.getElementById('manual-input');
    addManualBtn = document.getElementById('add-manual-btn');

    const wizardFooter = document.createElement('div');
    wizardFooter.id = 'wizard-footer';
    wizardFooter.style.cssText = 'margin-top: 30px; padding-top: 15px; border-top: 1px solid var(--border-color); width: 100%; max-width: 800px; margin-left: auto; margin-right: auto;';

    const startOverLink = document.createElement('a');
    startOverLink.href = '#';
    startOverLink.textContent = 'Start Over';
    startOverLink.style.cssText = 'color: var(--danger-accent); text-decoration: underline; font-size: 0.9em; cursor: pointer;';
    startOverLink.addEventListener('click', (e) => {
        e.preventDefault();
        resetWizard();
    });
    wizardFooter.appendChild(startOverLink);

    const skipLink = document.createElement('a');
    skipLink.href = '#';
    skipLink.className = 'wizard-footer-manual-link';
    skipLink.textContent = "I'll add my gateway manually later";
    skipLink.style.cssText = 'color: var(--subtle-text-color); text-decoration: underline; font-size: 0.9em; cursor: pointer;';
    skipLink.addEventListener('click', (e) => {
        e.preventDefault();
        openSkipSetupModal();
    });
    wizardFooter.appendChild(skipLink);

    if (wizardContainer) {
        wizardContainer.appendChild(wizardFooter);
    }

    const skipSetupHeaderBtn = document.getElementById('skip-setup-header-btn');
    if (skipSetupHeaderBtn) {
        skipSetupHeaderBtn.addEventListener('click', () => openSkipSetupModal());
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (dynamicPath.length > 0 && currentPathIndex < dynamicPath.length - 1) {
                currentPathIndex++;
                updateWizardState();
            }
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (dynamicPath.length > 0 && currentPathIndex > 0) {
                currentPathIndex--;
                updateWizardState();
            } else if (stepHistory.length > 1) {
                stepHistory.pop();
                dynamicPath = []; 
                updateWizardState();
            }
        });
    }

    if (scanNetworkBtn) {
        scanNetworkBtn.addEventListener('click', () => {
            if (isScanning) return;
            startScan();
        });
    }

    if (addManualBtn) {
        addManualBtn.addEventListener('click', () => {
            const input = manualInput.value.trim();
            if (!input) return;
            
            if (input.includes('.') && !input.includes(':')) {
                socket.emit('find-gateway-ip', input);
                scanStatus.textContent = `Searching for IP ${input}...`;
            } else {
                socket.emit('find-gateway-mac', input);
                scanStatus.textContent = `Searching for MAC ${input}...`;
            }
        });
    }

    if (scanResultsContainer) {
        scanResultsContainer.addEventListener('click', (e) => {
            if (e.target.id === 'add-selected-gateways') {
                const checkedBoxes = document.querySelectorAll('.gateway-checkbox:checked');
                const gatewaysToAdd = Array.from(checkedBoxes).map(cb => {
                    return discoveredGateways.find(g => g.ip === cb.dataset.ip);
                }).filter(g => g !== undefined); 

                if (gatewaysToAdd.length > 0) {
                    // --- FIX: Wait for success confirmation before redirecting ---
                    socket.emit('add-gateways', gatewaysToAdd);
                }
            }
        });
    }

    const finishPrivateBtn = document.getElementById('finish-private-btn');
    if(finishPrivateBtn) {
        finishPrivateBtn.addEventListener('click', finishSetup);
    }
    
    const finishHybridBtn = document.getElementById('finish-hybrid-btn');
    if(finishHybridBtn) {
        finishHybridBtn.addEventListener('click', finishSetup);
    }

    const finishAnywayBtn = document.getElementById('finish-anyway-btn');
    if(finishAnywayBtn) {
        finishAnywayBtn.addEventListener('click', finishSetup);
    }

    const finishSetupBtn = document.getElementById('finish-setup-btn');
    if(finishSetupBtn) {
        finishSetupBtn.addEventListener('click', () => {
            completeSetup();
        });
    }
    
    const enableModbusBtn = document.getElementById('modbus-writable-enable-btn');
    if(enableModbusBtn) {
        enableModbusBtn.addEventListener('click', () => {
             socket.emit('setup-enable-modbus', selectedGatewayIp);
        });
    }
    
    const skipSetupModal = document.getElementById('skip-setup-modal');
    if (skipSetupModal) {
        const confirmBtn = document.getElementById('skip-setup-confirm-btn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                confirmBtn.textContent = "Processing...";
                confirmBtn.disabled = true;
                completeSetup();
            });
        }
        const cancelBtn = document.getElementById('skip-setup-cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                skipSetupModal.classList.add('hidden');
                const confirmBtn = document.getElementById('skip-setup-confirm-btn');
                if (confirmBtn) {
                    confirmBtn.textContent = 'Yes, Skip Setup';
                    confirmBtn.disabled = false;
                }
            });
        }
    }

    const triggerSkipModal = document.getElementById('trigger-skip-modal');
    if (triggerSkipModal) {
        triggerSkipModal.addEventListener('click', (e) => {
            e.preventDefault();
            openSkipSetupModal();
        });
    }

    socket.on('scan-status-update', (msg) => {
        if (scanStatus) scanStatus.textContent = msg;
        
        // --- FIX: Arrange Scan Progress Logs with most recent at top ---
        const el = document.getElementById('scan-progress-log');
        if (el) {
            const entry = document.createElement('div');
            entry.textContent = msg;
            el.prepend(entry);
        }
    });

    socket.on('scan-results', (gateways) => {
        isScanning = false;
        discoveredGateways = gateways;
        if (scanNetworkBtn) {
            scanNetworkBtn.disabled = false;
            scanNetworkBtn.textContent = "Scan Again";
        }
        renderScanResults(gateways);
        if (scanStatus) scanStatus.textContent = `Found ${gateways.length} gateways.`;
    });

    socket.on('gateway-find-result', (result) => {
        if (scanStatus) {
            if (result.success) {
                 scanStatus.textContent = result.message;
            } else {
                 scanStatus.textContent = `Error: ${result.message}`;
            }
        }
    });
    
    socket.on('known-gateways', (gateways) => {
        if (getCurrentStepId() === 'step-1-scan') {
             discoveredGateways = gateways; 
             renderScanResults(gateways);
        }
    });

    // --- FIX: Confirmation of bulk add success before redirecting ---
    socket.on('gateways-added-success', () => {
        window.location.href = 'index.html';
    });

    socket.on('gateway-setup-details', (response) => {
    if (response.success) {
        gatewayAnalysis = response.data;
        
        // Normalize the server status for consistent checking
        if (gatewayAnalysis.defaultServerStatus) {
            gatewayAnalysis.defaultServerStatus = gatewayAnalysis.defaultServerStatus.trim();
        }
        
        selectedGatewayIp = response.data.ip;
        selectedGatewayId = response.data.gatewayId;
        analyzeGateway(); 
    }
});

    socket.on('setup-modbus-enabled-success', () => {
         // Start polling for the gateway to come back
         let attempts = 0;
         const maxAttempts = 20; 
         
         const el = document.getElementById('enable-modbus-status');
         if (el) el.innerHTML = `<span style="color: var(--success-accent);">Command accepted.</span> The gateway is now rebooting. <br>Checking connectivity (Attempt ${attempts}/${maxAttempts})...`;

         // Wait 30 seconds before starting the status checks to allow the gateway to cycle
         setTimeout(() => {
             const pollReboot = setInterval(() => {
                 attempts++;
                 if (el) el.innerHTML = `Checking connectivity... <br>(Attempt ${attempts}/${maxAttempts})`;
                 socket.emit('get-gateway-setup-details', selectedGatewayIp);
             }, 5000);

             window.isRebooting = true;
             window.rebootInterval = pollReboot;
         }, 30000);
    });
    
    socket.on('setup-modbus-enabled-fail', (data) => {
        window.modbusCommandTriggered = false; // Allow manual retry if needed
        const el = document.getElementById('enable-modbus-status');
        if (el) {
            el.style.color = 'var(--danger-accent)';
            el.innerHTML = `Failed: ${data.message}. <br>Please enable MODBUS TCP manually through the gateway's HTTP interface.`;
        }
    });

    socket.on('setup-saved-ok-redirect', () => {
        window.location.href = 'index.html';
    });

    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.write-access-info-trigger')) {
            const modal = document.getElementById('write-access-info-modal');
            if(modal) modal.classList.remove('hidden');
        }
        const closeButton = e.target.closest('.modal .close-button, .modal .info-ok-btn');
        if (closeButton) {
            const modal = closeButton.closest('.modal');
            if(modal) modal.classList.add('hidden');
        }
    });

    updateWizardState();
});