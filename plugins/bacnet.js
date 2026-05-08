// plugins/bacnet.js
// Updated to use @bacnet-js/client v3.0.1 API
// FIX: This import handles the CJS/ESM interop issue.
// 'pkg' is the module object, and 'pkg.default' is the Client constructor.
import pkg from '@bacnet-js/client';
// --- DEBUGGING REMOVED ---
const Client = pkg.default; // This is the constructor
// FIX: Enums are properties on the default 'pkg' export, with slightly different names
const PropertyIds = pkg.PropertyIdentifier;
const ObjectTypes = pkg.ObjectType;
const ApplicationTags = pkg.ApplicationTag;
const ErrorClasses = pkg.ErrorClass;
const ErrorCodes = pkg.ErrorCode;


/**
 * BACnet (Broadcast) Plugin
 * * Exposes all Monnit sensors as BACnet/IP "Analog Value" (AV) objects.
 * * Acts as a BACnet server/device that can be discovered and polled by BMS/SCADA systems.
 */
class BacnetPlugin {
    constructor() {
        this.name = 'bacnet';
        this.config = {};
        this.deps = null;
        this.client = null;
        this.localDeviceProperties = {};
        this.sensorObjects = new Map(); // Maps BACnet instanceId to its properties
        this.sensorMap = new Map(); // Maps sensorId to BACnet instanceId
        this.logs = [];
        this.maxLogs = 100;
    }

    /**
     * Initializes the plugin, loading its configuration.
     * @param {object} pluginDeps - Dependencies injected by PluginManager.
     */
    async init(pluginDeps) {
        this.deps = pluginDeps;
        // FIX: Removed v${pkg.version} as it's not exposed
        this.deps.pluginLog('BACnet', `Initializing BACnet plugin with @bacnet-js/client...`);
        this.config = await this.getConfig();
        
        const initialState = { ...this.config, enabled: this.config.enabled, status: 'Disabled' };
        this.deps.updatePluginState(this.name, initialState);

        if (this.config.enabled) {
            this.startServer();
        }
    }

    /**
     * Retrieves the current configuration from the database.
     * @returns {object} The saved configuration.
     */
    async getConfig() {
        const config = {
            enabled: await this.deps.getSetting('bacnetEnabled', 'false') === 'true',
            deviceName: await this.deps.getSetting('bacnetDeviceName', 'Monnit Utility'),
            port: parseInt(await this.deps.getSetting('bacnetPort', '47808'), 10),
            nodeId: parseInt(await this.deps.getSetting('bacnetNodeId', '1200'), 10),
        };
        config.enabled = config.enabled && !!config.deviceName;
        return config;
    }

/**
 * Saves the configuration to the database.
 * @param {object} config - The new configuration to save.
 */
async saveConfig(config) {
    // Save to database first
    await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'bacnetEnabled', config.enabled.toString());
    await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'bacnetDeviceName', config.deviceName);
    await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'bacnetPort', config.port.toString());
    await this.deps.db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'bacnetNodeId', config.nodeId.toString());

    this.config = config;
    this.config.enabled = config.enabled && !!config.deviceName;
    
    this.addLog(`Configuration saved. Enabled: ${this.config.enabled}`);

    // Restart server if needed
    this.stopServer();
    if (this.config.enabled) {
        this.startServer();
    }
    
    // Update state AFTER everything is complete
    this.deps.updatePluginState(this.name, { 
        enabled: this.config.enabled, 
        status: this.config.enabled ? 'Active' : 'Disabled',
        deviceName: this.config.deviceName,
        port: this.config.port,
        nodeId: this.config.nodeId
    });
}

    /**
     * Stops the BACnet server.
     */
    stopServer() {
        if (this.client) {
            this.client.close();
            this.client = null;
            this.localDeviceProperties = {};
            this.sensorObjects.clear();
            this.sensorMap.clear();
            const msg = 'Server stopped.';
            this.deps.pluginLog('BACnet', msg);
            this.addLog(msg);
            // FIX: Update BOTH enabled and status for correct state
            this.deps.updatePluginState(this.name, { enabled: false, status: 'Disabled' });
        } else {
             // Ensure state is correct even if server was never running
             this.deps.updatePluginState(this.name, { enabled: false, status: 'Disabled' });
        }
    }

    /**
     * Starts the BACnet server.
     */
    startServer() {
        if (this.client) {
            this.deps.pluginLog('BACnet', 'Server already running. Restarting...');
            this.stopServer();
        }

        try {
            const msg = `Starting server on port ${this.config.port}...`;
            this.deps.pluginLog('BACnet', msg);
            this.addLog(msg);

            // FIX: Use the 'Client' variable we defined
            this.client = new Client({
                port: this.config.port,
                // interface: '0.0.0.0'
            });

            // --- Define the main DEVICE object (our server) ---
            // FIX: Access enums directly (e.g., PropertyIds)
            // FIX: Use correct shorter enum keys (e.g., OBJECT_IDENTIFIER, not PROP_OBJECT_IDENTIFIER)
            this.localDeviceProperties = {
                [PropertyIds.OBJECT_IDENTIFIER]: [{
                    type: ApplicationTags.OBJECT_ID,
                    value: { type: ObjectTypes.DEVICE, instance: this.config.nodeId }
                }],
                [PropertyIds.OBJECT_NAME]: [{
                    type: ApplicationTags.CHARACTER_STRING,
                    value: this.config.deviceName
                }],
                [PropertyIds.OBJECT_TYPE]: [{
                    type: ApplicationTags.ENUMERATED,
                    value: ObjectTypes.DEVICE
                }],
                [PropertyIds.SYSTEM_STATUS]: [{
                    type: ApplicationTags.ENUMERATED,
                    value: 0 // OPERATIONAL
                }],
                [PropertyIds.VENDOR_NAME]: [{
                    type: ApplicationTags.CHARACTER_STRING,
                    value: 'Monnit Utility'
                }],
                [PropertyIds.VENDOR_IDENTIFIER]: [{
                    type: ApplicationTags.UNSIGNED_INT,
                    value: 1337
                }],
                [PropertyIds.MODEL_NAME]: [{
                    type: ApplicationTags.CHARACTER_STRING,
                    value: 'Monnit-BACnet-Bridge'
                }],
                [PropertyIds.PROTOCOL_VERSION]: [{
                    type: ApplicationTags.UNSIGNED_INT,
                    value: 1
                }],
                [PropertyIds.PROTOCOL_SERVICES_SUPPORTED]: [{
                    type: ApplicationTags.BIT_STRING,
                    value: [0, 0, 0, 0, 0, 0, 0, 0] // No services supported yet, just read
                }],
                [PropertyIds.OBJECT_LIST]: [] // We will populate this dynamically
            };

            // --- Set up the ReadProperty handler ---
            // This function gets called by the BACnet stack when a remote device reads a property from us.
            this.client.on('readProperty', (request) => {
                this.handleReadProperty(request);
            });
            
            // Optional: Listen for whoIs to log activity
            this.client.on('whoIs', (device) => {
                const addr = device?.header?.sender?.address || 'unknown';
                this.deps.pluginLog('BACnet', `Received whoIs from ${addr}. Responding with iAm.`);

                // The client handles the 'iAm' response automatically.
            });

            this.client.on('iAm', (device) => {
                this.deps.pluginLog('BACnet', `Received iAm from ${device.address}`);
            });

            this.client.on('error', (err) => {
                const msg = `Server error: ${err.message}`;
                this.deps.pluginLog('BACnet', msg, 'ERROR');
                this.addLog(msg);
            });
            
            const statusMsg = `Server active as Device ${this.config.nodeId} on port ${this.config.port}.`;
            // FIX: Update BOTH enabled and status for correct state
            this.deps.updatePluginState(this.name, { enabled: true, status: 'Active', statusColor: 'var(--success-accent)' });
            this.deps.pluginLog('BACnet', statusMsg);
            this.addLog(statusMsg);

        } catch (error) {
            const msg = `Failed to start server: ${error.message}`;
            this.deps.pluginLog('BACnet', msg, 'ERROR');
            this.addLog(msg);
            // FIX: Update BOTH enabled and status for correct state
            this.deps.updatePluginState(this.name, { enabled: false, status: `Error: ${msg}`, statusColor: 'var(--danger-accent)' });
            this.config.enabled = false; // Ensure local config matches
        }
    }

    /**
     * Handles an incoming ReadProperty request from a remote device.
     * @param {object} request - The ReadProperty request object.
     */
    handleReadProperty(request) {
        const { objectIdentifier, propertyIdentifier } = request.request;
        const objectId = objectIdentifier.value.instance;
        const propId = propertyIdentifier.value;
        let value = null;

        // Check if they are requesting the main DEVICE object
        // FIX: Use correct shorter enum keys
        if (objectId === this.config.nodeId && objectIdentifier.value.type === ObjectTypes.DEVICE) {
            // Dynamically build the object list
            this.localDeviceProperties[PropertyIds.OBJECT_LIST] = [
                {
                    type: ApplicationTags.OBJECT_ID,
                    value: { type: ObjectTypes.DEVICE, instance: this.config.nodeId }
                },
                ...Array.from(this.sensorMap.values()).map(instanceId => ({
                    type: ApplicationTags.OBJECT_ID,
                    value: { type: ObjectTypes.ANALOG_VALUE, instance: instanceId }
                }))
            ];
            
            value = this.localDeviceProperties[propId];
        } else if (this.sensorObjects.has(objectId) && objectIdentifier.value.type === ObjectTypes.ANALOG_VALUE) {
            // They are requesting a specific sensor (Analog Value object)
            value = this.sensorObjects.get(objectId)[propId];
        }

        if (value) {
            // Property found, send the response
            this.client.readPropertyResponse(
                request.address,
                request.invokeId,
                objectIdentifier,
                propertyIdentifier,
                value
            );
        } else {
            // Property not found or object not found
            // FIX: Access enums directly
            this.client.errorResponse(
                request.address,
                request.invokeId,
                ErrorClasses.OBJECT, // FIX: Use correct shorter enum key
                ErrorCodes.UNKNOWN_OBJECT // FIX: Use correct shorter enum key
            );
        }
    }


    /**
     * Ingests new sensor data from the main app.
     * This function is called by the PluginManager with new sensor data.
     * @param {Array<object>} sensors - Array of sensor data.
     * @param {object} gateway - Gateway information.
     */
    async broadcast(sensors) {
        if (!this.client) return;

        for (const sensor of sensors) {
            let instanceId;
            // Get or create the BACnet instance ID for this sensor
            if (this.sensorMap.has(sensor.sensorId)) {
                instanceId = this.sensorMap.get(sensor.sensorId);
            } else {
                // Use the sensor slot as the BACnet instance ID. This is stable and unique.
                instanceId = sensor.slot;
                this.sensorMap.set(sensor.sensorId, instanceId);
            }

            // Get the numeric value from the sensor
            // We need to use the getNumericReading function from our dependencies
            const reading = this.deps.getNumericReading(sensor);
            const presentValue = (reading !== null) ? reading : 0;

            // Get sensor name and units
            const sensorName = this.deps.deviceTypeToName[sensor.deviceType] || `Sensor ${sensor.deviceType}`;
            const bacnetName = `${sensorName} (ID ${sensor.sensorId})`;

            // Create or update the BACnet object properties
            // FIX: Use correct shorter enum keys
            const newObject = {
                [PropertyIds.OBJECT_IDENTIFIER]: [{
                    type: ApplicationTags.OBJECT_ID,
                    value: { type: ObjectTypes.ANALOG_VALUE, instance: instanceId }
                }],
                [PropertyIds.OBJECT_NAME]: [{
                    type: ApplicationTags.CHARACTER_STRING,
                    value: bacnetName
                }],
                [PropertyIds.OBJECT_TYPE]: [{
                    type: ApplicationTags.ENUMERATED,
                    value: ObjectTypes.ANALOG_VALUE
                }],
                [PropertyIds.PRESENT_VALUE]: [{
                    type: ApplicationTags.REAL,
                    value: presentValue
                }],
                [PropertyIds.STATUS_FLAGS]: [{
                    type: ApplicationTags.BIT_STRING,
                    value: [0, 0, 0, 0] // [IN_ALARM, FAULT, OVERRIDDEN, OUT_OF_SERVICE]
                }],
                [PropertyIds.UNITS]: [{
                    type: ApplicationTags.ENUMERATED,
                    value: 95 // No units
                }]
            };

            // Set IN_ALARM flag
            if (sensor.isAware) {
                newObject[PropertyIds.STATUS_FLAGS][0].value[0] = 1;
            }

            // Store the object properties
            this.sensorObjects.set(instanceId, newObject);
            
            // Log only if this is a new sensor we haven't seen before
            if (!this.sensorMap.has(sensor.sensorId)) {
                // FIX: Corrected internal key reference
                const msg = `Added new object: ${newObject[PropertyIds.OBJECT_NAME][0].value} (AV:${instanceId})`;
                this.deps.pluginLog('BACnet', msg);
                this.addLog(msg);
            }
        }
    }

    /**
 * Broadcasts an alert.
 * @param {string} alertMessage - The formatted alert message.
 * @param {object} sensorReading - The sensor reading that triggered the alert.
 */
    async broadcastAlert(alertMessage, sensorReading) {
        if (!this.client || !this.sensorMap.has(sensorReading.sensorId)) {
            return; // Server not running or sensor not yet in BACnet
        }
        
        const instanceId = this.sensorMap.get(sensorReading.sensorId);
        if (this.sensorObjects.has(instanceId)) {
            const sensorObject = this.sensorObjects.get(instanceId);
            
            // Set the IN_ALARM flag
            // FIX: Use correct shorter enum key
            sensorObject[PropertyIds.STATUS_FLAGS][0].value[0] = 1;
            
            const msg = `Set IN_ALARM flag for ${sensorObject[PropertyIds.OBJECT_NAME][0].value} (AV:${instanceId})`;
            this.deps.pluginLog('BACnet', msg);
            this.addLog(msg);
        }
        // No need to send a specific BACnet "alert" (like a COV notification)
        // because the 'IN_ALARM' flag on the object is the standard BACnet way.
    }

    // --- FIX: New functions to manage the internal log ---
    /**
     * Adds a new message to the internal log array.
     * @param {string} message - The log message.
     */
    addLog(message) {
        const logEntry = { ts: Date.now(), msg: message };
        
        // FIX: Use push/shift to maintain chronological order for the frontend prepend-loop
        this.logs.push(logEntry);
        
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        const socket = this.deps.io();
        if (socket) {
            socket.emit('bacnet-log', this.logs);
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
export const bacnetPlugin = new BacnetPlugin();