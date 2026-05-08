// connection-pool.js - Modbus TCP Connection Pool Manager
import { Socket } from "net";
import jsmodbus from "jsmodbus";
import { EventEmitter } from "events";

class ModbusConnectionPool extends EventEmitter {
    constructor(options = {}) {
        super();
        this.connections = new Map(); // ip -> connection object
        this.pendingConnections = new Map(); // ip -> Promise (Fix for race conditions)
        this.pendingReconnectTimers = new Map(); // ip -> reconnect timeout (always track; close handler deletes conn before scheduleReconnect)
        this.connectionConfigs = new Map(); // ip -> config
        this.idleTimeouts = new Map(); // ip -> timeout handle
        this.reconnectAttempts = new Map(); // ip -> attempt count
        this.reconnectDelays = new Map(); // ip -> next reconnect delay

        // Configuration options
        this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
        this.baseReconnectDelay = options.baseReconnectDelay || 1000; // 1 second
        this.maxReconnectDelay = options.maxReconnectDelay || 30000; // 30 seconds
        this.idleTimeout = options.idleTimeout || 300000; // 5 minutes
        this.connectionTimeout = options.connectionTimeout || 5000; // 5 seconds
        this.heartbeatInterval = options.heartbeatInterval || 30000; // 30 seconds

        this.isShuttingDown = false;
        this.maintenanceInterval = null;

        // Start maintenance loop
        this.startMaintenance();
    }

    /** @returns {string|null} */
    normalizeIp(ip) {
        if (ip == null) return null;
        const s = typeof ip === 'string' ? ip.trim() : String(ip).trim();
        return s.length > 0 ? s : null;
    }

    clearReconnectTimer(ip) {
        const t = this.pendingReconnectTimers.get(ip);
        if (t) {
            clearTimeout(t);
            this.pendingReconnectTimers.delete(ip);
        }
    }

    // Get or create a connection for the specified IP
    async getConnection(ip) {
        const addr = this.normalizeIp(ip);
        if (!addr) {
            throw new Error('Invalid or missing Modbus gateway IP');
        }
        ip = addr;

        if (this.isShuttingDown) {
            throw new Error('Connection pool is shutting down');
        }

        // Clear any existing idle timeout for this IP
        this.clearIdleTimeout(ip);

        // FIX: Check if a connection attempt is already in progress
        if (this.pendingConnections.has(ip)) {
            return this.pendingConnections.get(ip);
        }

        let connection = this.connections.get(ip);

        if (connection && connection.isConnected) {
            this.emit('connection_reused', { ip });
            return connection;
        }

        // Create new connection if needed
        // FIX: Store the promise in pendingConnections to prevent race conditions
        const connectPromise = this.createConnection(ip).finally(() => {
            this.pendingConnections.delete(ip);
        });

        this.pendingConnections.set(ip, connectPromise);
        return connectPromise;
    }

    // Create a new Modbus TCP connection
    async createConnection(ip) {
        const addr = this.normalizeIp(ip);
        if (!addr) {
            return Promise.reject(new Error('Invalid or missing Modbus gateway IP'));
        }
        ip = addr;

        return new Promise((resolve, reject) => {
            const socket = new Socket();
            const client = new jsmodbus.client.TCP(socket, 1);

            const connection = {
                ip,
                socket,
                client,
                isConnected: false,
                isConnecting: true,
                lastUsed: Date.now(),
                reconnectTimer: null,
                heartbeatTimer: null,
                errorCount: 0
            };

            // Connection establishment timeout
            // FIX: Ensure this is cleared on success
            const establishmentTimeout = setTimeout(() => {
                if (connection.isConnecting) {
                    socket.destroy();
                    const err = new Error('Connection establishment timeout');
                    this.emit('connection_error', { ip, error: err.message });
                    reject(err);
                }
            }, this.connectionTimeout);

            // Connection event handlers
            socket.on('connect', () => {
                clearTimeout(establishmentTimeout);
                connection.isConnected = true;
                connection.isConnecting = false;
                connection.errorCount = 0;
                this.reconnectAttempts.set(ip, 0);
                this.reconnectDelays.set(ip, this.baseReconnectDelay);
                this.clearReconnectTimer(ip);

                this.connections.set(ip, connection);
                this.startHeartbeat(connection);

                this.emit('connection_established', { ip: connection.ip });
                resolve(connection);
            });

            socket.on('error', (error) => {
                // Ensure timeout is cleared on error too
                clearTimeout(establishmentTimeout);

                connection.isConnected = false;
                connection.isConnecting = false;
                connection.errorCount++;

                this.emit('connection_error', { ip: connection.ip, error: error.message });

                // Only reject if this was the initial connection attempt
                // Otherwise, existing connections handle errors via events
                if (this.pendingConnections.has(ip)) {
                    reject(error);
                } else {
                    this.scheduleReconnect(connection.ip);
                }
            });

            socket.on('close', (hadError) => {
                const endpoint = connection.ip;
                connection.isConnected = false;
                this.stopHeartbeat(connection);
                this.connections.delete(endpoint); // Remove from active map immediately

                this.emit('connection_closed', { ip: endpoint, hadError });

                if (!this.isShuttingDown && !connection.isConnecting) {
                    this.scheduleReconnect(endpoint);
                }
            });

            socket.on('timeout', () => {
                socket.destroy();
                this.emit('connection_timeout', { ip: connection.ip });
            });

            // Set socket options
            socket.setTimeout(this.connectionTimeout);

            // Initiate connection
            socket.connect({
                host: ip,
                port: 502
            });
        });
    }

    // Schedule automatic reconnection
    scheduleReconnect(ip) {
        const addr = this.normalizeIp(ip);
        if (!addr || this.isShuttingDown) return;
        ip = addr;

        // Don't schedule if already pending
        if (this.pendingConnections.has(ip)) return;

        const currentAttempts = this.reconnectAttempts.get(ip) || 0;

        if (currentAttempts >= this.maxReconnectAttempts) {
            this.emit('max_reconnect_attempts_reached', { ip });
            this.removeConnection(ip);
            return;
        }

        const currentDelay = this.reconnectDelays.get(ip) || this.baseReconnectDelay;
        const nextDelay = Math.min(currentDelay * 2, this.maxReconnectDelay);

        this.reconnectAttempts.set(ip, currentAttempts + 1);
        this.reconnectDelays.set(ip, nextDelay);

        const existingConnection = this.connections.get(ip);
        if (existingConnection && existingConnection.reconnectTimer) {
            clearTimeout(existingConnection.reconnectTimer);
        }
        this.clearReconnectTimer(ip);

        const timer = setTimeout(() => {
            this.pendingReconnectTimers.delete(ip);
            this.emit('reconnecting', { ip, attempt: currentAttempts + 1 });
            // Use public method to handle pending logic
            this.getConnection(ip).catch(() => {
                // Reconnection failed, will be handled by error handler
            });
        }, currentDelay);

        this.pendingReconnectTimers.set(ip, timer);

        if (existingConnection) {
            existingConnection.reconnectTimer = timer;
        }
    }

    // Start heartbeat to keep connection alive
    startHeartbeat(connection) {
        if (connection.heartbeatTimer) {
            clearInterval(connection.heartbeatTimer);
        }

        connection.heartbeatTimer = setInterval(() => {
            if (connection.isConnected && !this.isShuttingDown) {
                // Send a simple read request to keep connection alive
                this.performHeartbeat(connection).catch(() => {
                    // Heartbeat failed, connection will be handled by error handlers
                });
            }
        }, this.heartbeatInterval);
    }

    // Stop heartbeat
    stopHeartbeat(connection) {
        if (connection.heartbeatTimer) {
            clearInterval(connection.heartbeatTimer);
            connection.heartbeatTimer = null;
        }
    }

    // Perform heartbeat (simple read operation)
    async performHeartbeat(connection) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Heartbeat timeout'));
            }, 5000);

            connection.client.readHoldingRegisters(0, 1)
                .then(() => {
                    clearTimeout(timeout);
                    connection.lastUsed = Date.now();
                    resolve();
                })
                .catch((error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
        });
    }

    // Release a connection back to the pool
    releaseConnection(ip) {
        const addr = this.normalizeIp(ip);
        if (!addr) return;
        ip = addr;
        const connection = this.connections.get(ip);
        if (connection) {
            connection.lastUsed = Date.now();
            this.setIdleTimeout(ip);
        }
    }

    // Set idle timeout for connection cleanup
    setIdleTimeout(ip) {
        const addr = this.normalizeIp(ip);
        if (!addr) return;
        ip = addr;
        this.clearIdleTimeout(ip);

        const timer = setTimeout(() => {
            const connection = this.connections.get(ip);
            if (connection && connection.isConnected) {
                const idleTime = Date.now() - connection.lastUsed;
                if (idleTime >= this.idleTimeout) {
                    this.emit('connection_idle_timeout', { ip, idleTime });
                    this.removeConnection(ip);
                }
            }
        }, this.idleTimeout);

        this.idleTimeouts.set(ip, timer);
    }

    // Clear idle timeout
    clearIdleTimeout(ip) {
        const addr = this.normalizeIp(ip);
        if (!addr) return;
        ip = addr;
        const timer = this.idleTimeouts.get(ip);
        if (timer) {
            clearTimeout(timer);
            this.idleTimeouts.delete(ip);
        }
    }

    // Remove a connection from the pool
    removeConnection(ip) {
        const addr = this.normalizeIp(ip);
        if (!addr) return;
        ip = addr;

        const connection = this.connections.get(ip);
        if (connection) {
            this.stopHeartbeat(connection);

            if (connection.reconnectTimer) {
                clearTimeout(connection.reconnectTimer);
            }
            this.clearReconnectTimer(ip);

            if (connection.socket) {
                connection.socket.removeAllListeners();
                connection.socket.destroy();
            }

            this.connections.delete(ip);
            this.clearIdleTimeout(ip);
            this.reconnectAttempts.delete(ip);
            this.reconnectDelays.delete(ip);

            this.emit('connection_removed', { ip });
        }
    }

    // Start maintenance loop
    startMaintenance() {
        if (this.maintenanceInterval) {
            clearInterval(this.maintenanceInterval);
        }

        this.maintenanceInterval = setInterval(() => {
            this.performMaintenance();
        }, 60000); // Run every minute
    }

    // Perform maintenance tasks
    performMaintenance() {
        const now = Date.now();

        for (const [ip, connection] of this.connections) {
            // Check for stale connections
            if (connection.isConnected && (now - connection.lastUsed) > this.idleTimeout) {
                this.emit('connection_stale', { ip });
                this.removeConnection(ip);
            }

            // Check for connections with too many errors
            if (connection.errorCount > 10) {
                this.emit('connection_error_threshold', { ip, errorCount: connection.errorCount });
                this.removeConnection(ip);
            }
        }
    }

    // Graceful shutdown
    async shutdown() {
        this.isShuttingDown = true;

        if (this.maintenanceInterval) {
            clearInterval(this.maintenanceInterval);
        }

        // Clear all timeouts
        for (const timer of this.idleTimeouts.values()) {
            clearTimeout(timer);
        }

        // Close all connections
        const closePromises = [];
        for (const [, connection] of this.connections) {
            if (connection.reconnectTimer) {
                clearTimeout(connection.reconnectTimer);
            }

            this.stopHeartbeat(connection);

            if (connection.socket) {
                connection.socket.removeAllListeners();

                const closePromise = new Promise((resolve) => {
                    connection.socket.once('close', resolve);
                    connection.socket.destroy();

                    // Force resolve after timeout
                    setTimeout(resolve, 2000);
                });

                closePromises.push(closePromise);
            }
        }

        for (const t of this.pendingReconnectTimers.values()) {
            clearTimeout(t);
        }
        this.pendingReconnectTimers.clear();

        // Wait for all connections to close
        await Promise.all(closePromises);

        this.connections.clear();
        this.pendingConnections.clear(); // Clear pending map
        this.idleTimeouts.clear();
        this.reconnectAttempts.clear();
        this.reconnectDelays.clear();

        this.emit('shutdown_complete');
    }

    // Get connection statistics
    getStats() {
        const stats = {
            totalConnections: this.connections.size,
            activeConnections: 0,
            idleConnections: 0,
            reconnectingConnections: 0,
            pendingConnections: this.pendingConnections.size
        };

        for (const connection of this.connections.values()) {
            if (connection.isConnected) {
                stats.activeConnections++;
            } else if (connection.isConnecting) {
                stats.reconnectingConnections++;
            } else {
                stats.idleConnections++;
            }
        }

        return stats;
    }
}

export default ModbusConnectionPool;