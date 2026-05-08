// public/js/auto-downloader.js
// Handles automatic data export/download scheduling

import { app } from 'electron';
import fs from 'fs';
import path from 'path';

class AutoDownloader {
    /**
     * @param {object} db - SQLite database instance
     * @param {function} logFunc - Logging callback
     * @param {function} pdfGenerator - Optional async helper function (html, path) => boolean
     */
    constructor(db, logFunc, pdfGenerator = null) {
        this.db = db;
        this.log = logFunc;
        this.pdfGenerator = pdfGenerator;
        this.intervalId = null;
    }

    // Initialize the scheduler
    init() {
        this.scheduleNextRun();
    }

    // Reload settings and reschedule
    reload() {
        this.scheduleNextRun();
    }

    // Calculate time until next run and set timeout
    scheduleNextRun() {
        if (this.intervalId) clearTimeout(this.intervalId);

        try {
            const enabled = this.getSetting('autoDownloadEnabled') === 'true';
            const frequency = this.getSetting('autoDownloadFrequency') || 'daily';
            
            // FIX: Check both enabled toggle AND frequency
            if (!enabled || frequency === 'disabled') {
                this.log('INFO', '[AutoDownload] Automatic download is disabled.');
                return;
            }
            
            const timeStr = this.getSetting('autoDownloadTime') || '00:00'; // HH:mm
            
            const now = new Date();
            // FIX: Use a reference time slightly in the future to prevent 
            // "double-triggering" if setTimeout fires a few milliseconds early.
            const referenceTime = new Date(now.getTime() + 5000);
            
            let nextRun = new Date();
            const [hours, minutes] = timeStr.split(':').map(Number);
            
            nextRun.setHours(hours, minutes, 0, 0);

            // If target time has passed relative to our reference, calculate the next cycle
            if (nextRun <= referenceTime) {
                if (frequency === 'hourly') {
                    nextRun = new Date(referenceTime);
                    nextRun.setMinutes(0, 0, 0);
                    nextRun.setHours(referenceTime.getHours() + 1);
                } else {
                    nextRun.setDate(nextRun.getDate() + 1);
                }
            }

            // Adjust date based on frequency
            if (frequency === 'weekly') {
                const nrDay = nextRun.getDay();
                const diff = (1 - nrDay + 7) % 7;
                nextRun.setDate(nextRun.getDate() + diff);
            } else if (frequency === 'monthly') {
                if (nextRun.getDate() !== 1) {
                    nextRun.setMonth(nextRun.getMonth() + 1);
                    nextRun.setDate(1);
                }
            } else if (frequency === 'hourly') {
                // Ensure hourly remains strictly in the future relative to the reference
                if(nextRun <= referenceTime) nextRun.setHours(nextRun.getHours() + 1);
            }

            const delay = nextRun.getTime() - now.getTime();
            this.log('INFO', `[AutoDownload] Next run scheduled for: ${nextRun.toLocaleString()} (${Math.round(delay/60000)} mins)`);

            this.intervalId = setTimeout(() => {
                this.executeDownload();
                this.scheduleNextRun(); // Reschedule after execution
            }, delay);

        } catch (err) {
            this.log('ERROR', `[AutoDownload] Failed to schedule: ${err.message}`);
        }
    }

    async executeDownload() {
        this.log('INFO', '[AutoDownload] Starting automatic data export...');
        
        try {
            const format = this.getSetting('autoDownloadFormat') || 'csv';
            const exportPath = path.join(app.getPath('documents'), 'Monnit_Data_Export');
            
            if (!fs.existsSync(exportPath)) {
                fs.mkdirSync(exportPath, { recursive: true });
            }

            const frequency = this.getSetting('autoDownloadFrequency') || 'daily';
            let startTime = 0;
            const endTime = Math.floor(Date.now() / 1000);
            
            if (frequency === 'hourly') startTime = endTime - 3600;
            else if (frequency === 'daily') startTime = endTime - 86400;
            else if (frequency === 'weekly') startTime = endTime - (7 * 86400);
            else if (frequency === 'monthly') startTime = endTime - (30 * 86400);

            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const localTimeString = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;

            // Export Monnit Sensors
            const sensors = this.db.prepare('SELECT * FROM sensor_data WHERE timestamp >= ? AND timestamp <= ?').all(startTime, endTime);
            if (sensors.length > 0) {
                const ext = format === 'csv' ? 'csv' : 'pdf';
                const filename = `Monnit_Sensors_${frequency}_${localTimeString}.${ext}`;
                const fullPath = path.join(exportPath, filename);
                
                if (format === 'csv') {
                    this.writeCsv(sensors, fullPath, false);
                } else {
                    await this.writePdf(sensors, fullPath, false);
                }
            }

            // Export External Devices
            const externalHistory = this.db.prepare('SELECT * FROM external_device_history WHERE timestamp >= ? AND timestamp <= ?').all(startTime, endTime);
            if (externalHistory.length > 0) {
                const ext = format === 'csv' ? 'csv' : 'pdf';
                const filename = `External_Devices_${frequency}_${localTimeString}.${ext}`;
                const fullPath = path.join(exportPath, filename);
                
                if (format === 'csv') {
                    // For CSV, create a readable format with all records
                    const csvHeaders = ['Timestamp', 'DeviceID', 'Data', 'AlertTriggered'];
                    const csvRows = externalHistory.map(row => {
                        const timestamp = new Date(row.timestamp * 1000).toISOString().replace('T', ' ').substring(0, 19);
                        const data = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
                        return `"${timestamp}","${row.deviceId}","${data.replace(/"/g, '""')}","${row.alertTriggered || 0}"`;
                    });
                    
                    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
                    fs.writeFileSync(fullPath, csvContent);
                } else {
                    await this.writePdf(externalHistory, fullPath, true);
                }
            }

            this.log('INFO', `[AutoDownload] Export complete. Files saved to: ${exportPath}`);
            this.saveSetting('autoDownloadLastRun', Date.now().toString());

        } catch (err) {
            this.log('ERROR', `[AutoDownload] Execution failed: ${err.message}`);
        }
    }

    // Parse signed 16-bit integer
    toSigned16(value) {
        return (value > 32767) ? value - 65536 : value;
    }

    // Get formatted reading based on device type
    getFormattedReading(deviceType, rawDataString) {
        try {
            if (!rawDataString || rawDataString.trim() === '') return 'N/A';
            const data = JSON.parse(rawDataString);
            
            switch (deviceType) {
                case 2: // Temperature
                case 71: // Temperature Summary
                    return (this.toSigned16(data[0]) / 10).toFixed(1) + ' °C';
                case 16: // Humidity
                    return (this.toSigned16(data[1]) / 100).toFixed(1) + ' %RH';
                case 25: // Water Temperature
                    return (this.toSigned16(data[0]) / 100).toFixed(1) + ' °C';
                case 41: // Pressure
                    return ((data[0] | (data[1] << 16)) / 1000).toFixed(2) + ' kPa';
                case 43: // AC Current
                    return ((data[0] | (data[1] << 16)) / 1000).toFixed(2) + ' A';
                case 3: // Dry Contact
                    return data[0] === 1 ? 'Open' : 'Closed';
                case 4: // Water Detect
                    return data[0] === 1 ? 'Dry' : 'Wet';
                case 5: // PIR Motion
                    return data[0] === 1 ? 'Motion Detected' : 'No Motion';
                case 21: // Light Meter
                    return data[0] + ' lux';
                default:
                    return 'N/A';
            }
        } catch (e) {
            return 'Error';
        }
    }

    writeCsv(data, filepath, isExternal) {
        if (!data || data.length === 0) return;

        // Define headers
        const sampleRow = data[0];
        let headers = [...Object.keys(sampleRow)];
        
        // For Monnit sensors, add Reading column before rawData
        if (!isExternal) {
            const rawDataIndex = headers.indexOf('rawData');
            if (rawDataIndex !== -1) {
                headers.splice(rawDataIndex, 0, 'Reading');
            }
        }

        const csvRows = data.map(row => {
            let values = [];
            
            headers.forEach(header => {
                let val = '';
                
                if (header === 'Reading' && !isExternal) {
                    // Generate formatted reading
                    val = this.getFormattedReading(row.deviceType, row.rawData);
                } else if (header === 'timestamp') {
                    // Format timestamp
                    if (row.timestamp) {
                        const date = new Date(row.timestamp * 1000);
                        val = date.toISOString().replace('T', ' ').substring(0, 19);
                    }
                } else if (header === 'rawData' && !isExternal) {
                    // Format rawData
                    try {
                        if (typeof row.rawData === 'string') {
                            const parsed = JSON.parse(row.rawData);
                            val = JSON.stringify(parsed);
                        } else {
                            val = JSON.stringify(row.rawData);
                        }
                    } catch (e) {
                        val = String(row.rawData);
                    }
                } else if (header === 'data' && isExternal) {
                    // Handle external device data
                    try {
                        if (typeof row.data === 'string') {
                            const parsed = JSON.parse(row.data);
                            val = JSON.stringify(parsed);
                        } else {
                            val = JSON.stringify(row.data);
                        }
                    } catch (e) {
                        val = String(row.data);
                    }
                } else {
                    // Default handling
                    val = row[header] !== null && row[header] !== undefined ? row[header] : '';
                }
                
                // Escape for CSV
                values.push(`"${String(val).replace(/"/g, '""')}"`);
            });
            
            return values.join(',');
        });

        const csvContent = [headers.join(','), ...csvRows].join('\n');
        fs.writeFileSync(filepath, csvContent);
    }

    async writePdf(data, filepath, isExternal) {
        let html = `
            <html>
            <head>
                <style>
                    body { font-family: sans-serif; padding: 20px; }
                    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 10px; }
                    th { background-color: #f2f2f2; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    h1 { color: #333; }
                </style>
            </head>
            <body>
                <h1>Data Export: ${isExternal ? 'External Devices' : 'Monnit Sensors'}</h1>
                <p>Generated: ${new Date().toLocaleString()}</p>
                <table>
        `;
        
        if (data.length > 0) {
            const headers = Object.keys(data[0]);
            html += '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
            
            data.forEach(row => {
                html += '<tr>' + headers.map(h => {
                    let val = row[h];
                    if (h === 'timestamp') {
                         val = new Date(val * 1000).toLocaleString();
                    }
                    return `<td>${val}</td>`;
                }).join('') + '</tr>';
            });
            html += '</tbody></table></body></html>';
        }
        
        if (this.pdfGenerator) {
            // FIX: Use the native PDF generator provided by main.js
            const success = await this.pdfGenerator(html, filepath);
            if (!success) {
                this.log('ERROR', `[AutoDownload] Native PDF generation failed for ${filepath}`);
            }
        } else {
            // Fallback: Write HTML if native generator is missing
            const htmlPath = filepath.replace(/\.pdf$/, ".html");
            fs.writeFileSync(htmlPath, html);
            this.log('WARN', `[AutoDownload] Native PDF generator not found. Saved as HTML: ${htmlPath}`);
        }
    }

    getSetting(key) {
        try {
            const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
            return row ? row.value : null;
        } catch (err) {
            return null;
        }
    }

    saveSetting(key, value) {
        try {
            this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
        } catch (err) {}
    }
}

export const autoDownloader = (db, log, pdfGenerator) => new AutoDownloader(db, log, pdfGenerator);