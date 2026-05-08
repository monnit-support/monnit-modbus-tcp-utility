// modbus-register-map.js - Formula and human-readable interpretation for MODBUS registers
// Aligns with EGW4 sensor block layout: 0-1=SensorID, 2=DeviceType, 3=DataAge, 4=Active, 5=Aware, 6=Voltage, 7=RSSI, 8-15=Data0-7

(function() {
    const DEVICE_TYPE_NAMES = { 2:'Temperature', 3:'Dry Contact', 4:'Water Detect', 5:'PIR Motion', 9:'Open/Closed', 11:'Button', 16:'Humidity', 23:'PIR Motion', 25:'Water Temp', 43:'Humidity', 65:'Water Temp', 79:'Pressure 50 PSI', 82:'Pressure 300 PSI', 86:'Thermocouple', 107:'Light Meter', 132:'Filtered Temp' };
    const toSigned16 = (v) => (v > 32767) ? v - 65536 : v;
    const parse32 = (high, low) => ((high || 0) << 16) | (low || 0);

    const SENSOR_BLOCK = [
        { name: 'Sensor ID (low)', formula: 'Low 16b of 32-bit ID', fn: (v, regs) => regs[0] },
        { name: 'Sensor ID (high)', formula: 'High 16b of 32-bit ID', fn: (v, regs) => regs[1] },
        { name: 'Device Type', formula: 'Sensor type code', fn: (v, regs) => v },
        { name: 'Data Age', formula: 'Countdown (seconds)', fn: (v) => v },
        { name: 'Active', formula: '1=has data', fn: (v) => v === 1 ? 'Yes' : 'No' },
        { name: 'Aware', formula: '1=Aware', fn: (v) => v === 1 ? 'Aware' : 'Not Aware' },
        { name: 'Voltage', formula: '÷ 100', fn: (v) => ((v || 0) / 100).toFixed(2) + ' V' },
        { name: 'RSSI', formula: 'as is', fn: (v) => (v || 0) + ' %' },
        { name: 'Data0', formula: '—', fn: (v) => String(v) },
        { name: 'Data1', formula: '—', fn: (v) => String(v) },
        { name: 'Data2', formula: '—', fn: (v) => String(v) },
        { name: 'Data3', formula: '—', fn: (v) => String(v) },
        { name: 'Data4', formula: '—', fn: (v) => String(v) },
        { name: 'Data5', formula: '—', fn: (v) => String(v) },
        { name: 'Data6', formula: '—', fn: (v) => String(v) },
        { name: 'Data7', formula: '—', fn: (v) => String(v) }
    ];

    // deviceType -> [ { formula, fn } ] for Data0..Data7
    const DATA_INTERPRET = {
        2: [{ f: 's16 ÷ 10', u: '°C', fn: (d) => (toSigned16(d[0]) / 10).toFixed(2) + ' °C' }],
        132: [{ f: 's16 ÷ 10', u: '°C', fn: (d) => (toSigned16(d[0]) / 10).toFixed(2) + ' °C' }],
        35: [{ f: 's16 ÷ 10', u: '°C', fn: (d) => (toSigned16(d[0]) / 10).toFixed(2) + ' °C' }],
        46: [{ f: 's16 ÷ 10', u: '°C', fn: (d) => (toSigned16(d[0]) / 10).toFixed(2) + ' °C' }],
        91: [{ f: 's16 ÷ 10', u: '°C', fn: (d) => (toSigned16(d[0]) / 10).toFixed(2) + ' °C' }],
        100: [{ f: 's16 ÷ 10', u: '°C', fn: (d) => (toSigned16(d[0]) / 10).toFixed(2) + ' °C' }],
        128: [{ f: 's16 ÷ 10', u: '°C', fn: (d) => (toSigned16(d[0]) / 10).toFixed(2) + ' °C' }],
        136: [{ f: 's16 ÷ 10', u: '°C', fn: (d) => (toSigned16(d[0]) / 10).toFixed(2) + ' °C' }],
        71: [{ f: 's16 ÷ 10', u: '°C', fn: (d) => (toSigned16(d[0]) / 10).toFixed(2) + ' °C' }],
        16: [{ f: 's16 ÷ 100', u: '°C', fn: (d) => (toSigned16(d[0]) / 100).toFixed(2) + ' °C' }, { f: 's16 ÷ 100', u: '%RH', fn: (d) => (toSigned16(d[1]) / 100).toFixed(2) + ' %RH' }],
        43: [{ f: 's16 ÷ 100', u: '°C', fn: (d) => (toSigned16(d[0]) / 100).toFixed(2) + ' °C' }, { f: 's16 ÷ 100', u: '%RH', fn: (d) => (toSigned16(d[1]) / 100).toFixed(2) + ' %RH' }],
        30: [{ f: 's16 ÷ 100', u: 'GPP', fn: (d) => (toSigned16(d[0]) / 100).toFixed(2) + ' GPP' }],
        4: [{ f: '0=Dry, 1=Water', u: '', fn: (d) => d[0] === 1 ? 'Water Detected' : 'Dry' }],
        78: [{ f: '0=Dry, 1=Water', u: '', fn: (d) => d[0] === 1 ? 'Water Detected' : 'Dry' }],
        25: [{ f: 's16 ÷ 10', u: '°C', fn: (d) => (toSigned16(d[0]) / 10).toFixed(2) + ' °C' }],
        65: [{ f: 's16 ÷ 10', u: '°C', fn: (d) => (toSigned16(d[0]) / 10).toFixed(2) + ' °C' }],
        5: [{ f: '0=Inactive, 1=Active', u: '', fn: (d) => d[0] === 1 ? 'Active' : 'Inactive' }],
        23: [{ f: '0=No Motion, 1=Motion', u: '', fn: (d) => d[0] === 1 ? 'Motion Detected' : 'No Motion' }],
        101: [{ f: '0=No Motion, 1=Motion', u: '', fn: (d) => d[0] === 1 ? 'Motion Detected' : 'No Motion' }],
        138: [{ f: '0=No Motion, 1=Motion', u: '', fn: (d) => d[0] === 1 ? 'Motion Detected' : 'No Motion' }],
        3: [{ f: '0=Closed, 1=Open', u: '', fn: (d) => d[0] === 1 ? 'Open' : 'Closed' }],
        9: [{ f: '0=Closed, 1=Open', u: '', fn: (d) => d[0] === 1 ? 'Open' : 'Closed' }],
        21: [{ f: 'u32 ÷ 100', u: 'lux', fn: (d) => (((d[1]||0)<<16|(d[0]||0))/100).toFixed(2) + ' lux' }],
        107: [{ f: 'u32 ÷ 100', u: 'lux', fn: (d) => (((d[1]||0)<<16|(d[0]||0))/100).toFixed(2) + ' lux' }],
        27: [{ f: '0=Dark, 1=Light', u: '', fn: (d) => d[0] === 1 ? 'Light Detected' : 'Dark' }],
        41: [{ f: 'u32 ÷ 1000', u: 'psi', fn: (d) => ((d[0]|(d[1]<<16))/1000).toFixed(3) + ' psi' }],
        79: [{ f: '÷ 10', u: 'psi', fn: (d) => ((d[0]||0)/10).toFixed(1) + ' psi' }],
        82: [{ f: '÷ 10', u: 'psi', fn: (d) => ((d[0]||0)/10).toFixed(1) + ' psi' }],
        83: [{ f: '÷ 10', u: 'psi', fn: (d) => ((d[0]||0)/10).toFixed(1) + ' psi' }],
        144: [{ f: '÷ 10', u: 'psi', fn: (d) => ((d[0]||0)/10).toFixed(1) + ' psi' }],
        145: [{ f: '÷ 10', u: 'psi', fn: (d) => ((d[0]||0)/10).toFixed(1) + ' psi' }],
        70: [{ f: '÷ 10', u: 'Ω', fn: (d) => ((d[0]||0)/10).toFixed(1) + ' Ω' }],
        103: [{ f: '÷ 10', u: 'Pa', fn: (d) => ((d[0]||0)/10).toFixed(1) + ' Pa' }],
        113: [{ f: '÷ 100', u: 'VDC', fn: (d) => ((d[0]||0)/100).toFixed(2) + ' VDC' }],
        122: [{ f: '÷ 100', u: 'VAC', fn: (d) => ((d[0]||0)/100).toFixed(2) + ' VAC' }],
        124: [{ f: 's16 ÷ 100', u: '%', fn: (d) => (toSigned16(d[0])/100).toFixed(2) + ' %' }],
        135: [{ f: '÷ 10', u: 'cb', fn: (d) => ((d[0]||0)/10).toFixed(1) + ' cb' }],
        86: [{ f: 's16 ÷ 10', u: '°C', fn: (d) => (toSigned16(d[0])/10).toFixed(2) + ' °C' }],
        11: [{ f: '0=Released, 1=Pressed', u: '', fn: (d) => d[0] === 1 ? 'Pressed' : 'Released' }],
        13: [{ f: '0=No Alert, 1=Alert', u: '', fn: (d) => d[0] === 1 ? 'Alert Active' : 'No Alert' }],
        42: [{ f: 'u32 (sec)', u: 's', fn: (d) => (d[0]|(d[1]<<16)) + ' s' }],
        59: [{ f: 'as is', u: '%', fn: (d) => (d[0]||0) + ' %' }],
        126: [{ f: '÷ 1000', u: 'g', fn: (d) => ((d[0]||0)/1000).toFixed(3) + ' g' }]
    };

    const GATEWAY_BLOCK = [
        { name: 'Reg 0', formula: '—', fn: (v) => String(v) },
        { name: 'Reg 1', formula: '—', fn: (v) => String(v) },
        { name: 'Reg 2', formula: '—', fn: (v) => String(v) },
        { name: 'Reg 3', formula: '—', fn: (v) => String(v) },
        { name: 'Reg 4', formula: '—', fn: (v) => String(v) }
    ];

    window.getModbusRegisterInterpretation = function(registerNum, value, allRegisters, start, count) {
        const idx = registerNum - start;

        if (start < 5 && count <= 5) {
            const g = GATEWAY_BLOCK[idx];
            return { formula: g ? g.formula : '—', humanReadable: g ? g.fn(value) : String(value) };
        }

        const isSensorBlock = start >= 100;
        const blockStart = isSensorBlock ? (100 + Math.floor((registerNum - 100) / 16) * 16) : 0;
        const relOffset = registerNum - blockStart;

        if (isSensorBlock && relOffset >= 0 && relOffset < 16) {
            const def = SENSOR_BLOCK[relOffset];
            let formula = def.formula;
            let humanReadable = def.fn(value, allRegisters);

            if (relOffset >= 8) {
                const dtIdx = blockStart + 2 - start;
                const deviceType = dtIdx >= 0 && dtIdx < allRegisters.length ? allRegisters[dtIdx] : null;
                const dataIndex = relOffset - 8;
                const dataInterp = deviceType != null && DATA_INTERPRET[deviceType];
                if (dataInterp && dataInterp[dataIndex]) {
                    const di = dataInterp[dataIndex];
                    formula = di.f + (di.u ? ' → ' + di.u : '');
                    const dataBase = blockStart + 8 - start;
                    const data = [];
                    for (let i = 0; i < 8; i++) {
                        data.push((dataBase + i >= 0 && dataBase + i < allRegisters.length) ? allRegisters[dataBase + i] : 0);
                    }
                    try {
                        humanReadable = di.fn(data);
                    } catch (_) {
                        humanReadable = String(value);
                    }
                }
            } else if (relOffset === 0 || relOffset === 1) {
                humanReadable = relOffset === 1 && idx >= 1
                    ? String(parse32(allRegisters[idx], allRegisters[idx - 1]))
                    : String(value);
            } else if (relOffset === 2) {
                humanReadable = (DEVICE_TYPE_NAMES[value] || 'Type ' + value) + ' (' + value + ')';
            }
            return { formula, humanReadable };
        }

        return { formula: '—', humanReadable: String(value) };
    };
})();
