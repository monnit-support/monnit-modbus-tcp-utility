// sensor-parser.js - Corrected with exact Monnit sensor names and fixed variable declarations

function parseSensorData(sensor) {
    const data = sensor.data || [];
    const toSigned16 = (value) => (value > 32767) ? value - 65536 : value;
    const parse32Bit = (high, low) => (high << 16) | low;

    const result = {
        name: 'Unknown Sensor',
        displayString: 'N/A',
        chartableData: [],
        allDataValues: []
    };

    // Store all 8 data values for alert selection
    for (let i = 0; i < 8; i++) {
        result.allDataValues.push({
            index: i,
            value: data[i],
            label: `Data[${i}]`
        });
    }

    switch (sensor.deviceType) {
        // === TEMPERATURE SENSORS ===
        case 2: // Temperature
        case 132: // Filtered Temperature
            const tempC = toSigned16(data[0]) / 10;
            const tempF = (tempC * 9/5) + 32;
            result.name = 'Temperature';
            result.displayString = `${tempC.toFixed(2)}°C / ${tempF.toFixed(2)}°F`;
            result.chartableData.push({ label: 'Temperature (°C)', value: tempC, dataIndex: 0 });
            break;

        case 35: // High Temperature
            const highTempC = toSigned16(data[0]) / 10;
            const highTempF = (highTempC * 9/5) + 32;
            result.name = 'High Temperature';
            result.displayString = `${highTempC.toFixed(2)}°C / ${highTempF.toFixed(2)}°F`;
            result.chartableData.push({ label: 'High Temperature (°C)', value: highTempC, dataIndex: 0 });
            break;

        case 46: // Low Temperature
            const lowTempC = toSigned16(data[0]) / 10;
            const lowTempF = (lowTempC * 9/5) + 32;
            result.name = 'Low Temperature';
            result.displayString = `${lowTempC.toFixed(2)}°C / ${lowTempF.toFixed(2)}°F`;
            result.chartableData.push({ label: 'Low Temperature (°C)', value: lowTempC, dataIndex: 0 });
            break;

        case 91: // Motion Temperature
            const motionTempC = toSigned16(data[0]) / 10;
            const motionTempF = (motionTempC * 9/5) + 32;
            result.name = 'Motion Temperature';
            result.displayString = `${motionTempC.toFixed(2)}°C / ${motionTempF.toFixed(2)}°F`;
            result.chartableData.push({ label: 'Motion Temperature (°C)', value: motionTempC, dataIndex: 0 });
            break;

        case 100: // QTIP Temperature
            const qtipTempC = toSigned16(data[0]) / 10;
            const qtipTempF = (qtipTempC * 9/5) + 32;
            result.name = 'QTIP Temperature';
            result.displayString = `${qtipTempC.toFixed(2)}°C / ${qtipTempF.toFixed(2)}°F`;
            result.chartableData.push({ label: 'QTIP Temperature (°C)', value: qtipTempC, dataIndex: 0 });
            break;

        case 128: // Handheld Food Probe
            const foodTempC = toSigned16(data[0]) / 10;
            const foodTempF = (foodTempC * 9/5) + 32;
            result.name = 'Handheld Food Probe';
            result.displayString = `${foodTempC.toFixed(2)}°C / ${foodTempF.toFixed(2)}°F`;
            result.chartableData.push({ label: 'Food Probe (°C)', value: foodTempC, dataIndex: 0 });
            break;

        case 136: // Digital Temperature (AA LCD Temperature per spec)
            const digitalTempC = toSigned16(data[0]) / 10;
            const digitalTempF = (digitalTempC * 9/5) + 32;
            result.name = 'Digital Temperature';
            result.displayString = `${digitalTempC.toFixed(2)}°C / ${digitalTempF.toFixed(2)}°F`;
            result.chartableData.push({ label: 'Digital Temperature (°C)', value: digitalTempC, dataIndex: 0 });
            break;

        case 71: // Temperature Summary
            const tempSummaryC = toSigned16(data[0]) / 10;
            const tempSummaryF = (tempSummaryC * 9/5) + 32;
            result.name = 'Temperature Summary';
            result.displayString = `${tempSummaryC.toFixed(1)}°C / ${tempSummaryF.toFixed(1)}°F`;
            result.chartableData.push({ label: 'Temperature Summary (°C)', value: tempSummaryC, dataIndex: 0 });
            break;

        // === HUMIDITY SENSORS ===
        case 16: // Humidity (GEN1)
        case 43: // Humidity (ALTA - per spec: Data0=Temp, Data1=Humidity)
            const tempHumC = toSigned16(data[0]) / 100;
            const humidity = toSigned16(data[1]) / 100;
            const tempHumF = (tempHumC * 9/5) + 32;
            result.name = 'Humidity';
            result.displayString = `${humidity.toFixed(2)}% RH, ${tempHumC.toFixed(2)}°C`;
            result.chartableData.push({ label: 'Temperature (°C)', value: tempHumC, dataIndex: 0 });
            result.chartableData.push({ label: 'Humidity (%RH)', value: humidity, dataIndex: 1 });
            break;

        case 30: // Humidity GPP
            const humidityGpp = toSigned16(data[0]) / 100;
            result.name = 'Humidity GPP';
            result.displayString = `${humidityGpp.toFixed(2)} GPP`;
            result.chartableData.push({ label: 'Humidity (GPP)', value: humidityGpp, dataIndex: 0 });
            break;

        // === WATER SENSORS ===
        case 4: // Water Detect
            const waterState = data[0] === 1 ? 'Water Detected' : 'Dry';
            result.name = 'Water Detect';
            result.displayString = `Status: ${waterState}`;
            result.chartableData.push({ label: 'Water Detection', value: data[0], dataIndex: 0 });
            break;

        case 78: // Water Area Sensor
            const waterAreaState = data[0] === 1 ? 'Water Detected' : 'Dry';
            result.name = 'Water Area Sensor';
            result.displayString = `Status: ${waterAreaState}`;
            result.chartableData.push({ label: 'Water Area Detection', value: data[0], dataIndex: 0 });
            break;

        // === WATER TEMPERATURE SENSORS ===
        case 25: // Water Temperature
        case 65: // Water Temperature
            const waterTempC = toSigned16(data[0]) / 10;
            const waterTempF = (waterTempC * 9/5) + 32;
            result.name = 'Water Temperature';
            result.displayString = `${waterTempC.toFixed(2)}°C / ${waterTempF.toFixed(2)}°F`;
            result.chartableData.push({ label: 'Water Temperature (°C)', value: waterTempC, dataIndex: 0 });
            break;

        // === MOTION/ACTIVITY SENSORS - FIXED NAMES ===
        case 5: // Activity Detect - FIXED NAME
            const activityDetectState = data[0] === 1 ? 'Active' : 'Inactive';
            result.name = 'Activity Detect';  // ← FIXED: Was "PIR Motion"
            result.displayString = `Status: ${activityDetectState}`;
            result.chartableData.push({ label: 'Activity Detection', value: data[0], dataIndex: 0 });
            break;

        case 23: // PIR Motion
            const motionState = data[0] === 1 ? 'Motion Detected' : 'No Motion';
            result.name = 'PIR Motion';  // ← CORRECT
            result.displayString = `Status: ${motionState}`;
            result.chartableData.push({ label: 'Motion Detection', value: data[0], dataIndex: 0 });
            break;

        case 101: // PIR - Alta
            const altaMotionState = data[0] === 1 ? 'Motion Detected' : 'No Motion';
            result.name = 'PIR - Alta';
            result.displayString = `Status: ${altaMotionState}`;
            result.chartableData.push({ label: 'PIR Motion', value: data[0], dataIndex: 0 });
            break;

        case 138: // Motion Plus
            const motionPlusState = data[0] === 1 ? 'Motion Detected' : 'No Motion';
            result.name = 'Motion Plus';
            result.displayString = `Status: ${motionPlusState}`;
            result.chartableData.push({ label: 'Motion Plus Detection', value: data[0], dataIndex: 0 });
            break;

        case 19: // Activity P2 - FIXED NAME
            const activityP2 = data[0];
            result.name = 'Activity P2';  // ← FIXED: Was "Activity"
            result.displayString = `Activity: ${activityP2}`;
            result.chartableData.push({ label: 'Activity P2', value: activityP2, dataIndex: 0 });
            break;

        case 42: // Activity Timer - FIXED NAME
            const activityTime = data[0] | (data[1] << 16);
            result.name = 'Activity Timer';  // ← CORRECT
            result.displayString = `Activity Time: ${activityTime} seconds`;
            result.chartableData.push({ label: 'Activity Time (seconds)', value: activityTime, dataIndex: 0 });
            break;

        // === CONTACT/OPEN-CLOSE SENSORS ===
        case 3: // Dry Contact
            const contactState = data[0] === 1 ? 'Open' : 'Closed';
            result.name = 'Dry Contact';
            result.displayString = `State: ${contactState}`;
            result.chartableData.push({ label: 'Contact State', value: data[0], dataIndex: 0 });
            break;

        case 9: // Open/Closed
            const openCloseState = data[0] === 1 ? 'Open' : 'Closed';
            result.name = 'Open/Closed';
            result.displayString = `State: ${openCloseState}`;
            result.chartableData.push({ label: 'Open/Closed State', value: data[0], dataIndex: 0 });
            break;

        case 127: // Quad Contact
            const contact1 = (data[0] & 1) ? 'Open' : 'Closed';
            const contact2 = (data[0] & 2) ? 'Open' : 'Closed';
            const contact3 = (data[0] & 4) ? 'Open' : 'Closed';
            const contact4 = (data[0] & 8) ? 'Open' : 'Closed';
            result.name = 'Quad Contact';
            result.displayString = `C1: ${contact1}, C2: ${contact2}, C3: ${contact3}, C4: ${contact4}`;
            result.chartableData.push({ label: 'Contact Status', value: data[0], dataIndex: 0 });
            break;

        case 151: // Five Input Dry Contact
            const contact5_1 = (data[0] & 1) ? 'Open' : 'Closed';
            const contact5_2 = (data[0] & 2) ? 'Open' : 'Closed';
            const contact5_3 = (data[0] & 4) ? 'Open' : 'Closed';
            const contact5_4 = (data[0] & 8) ? 'Open' : 'Closed';
            const contact5_5 = (data[0] & 16) ? 'Open' : 'Closed';
            result.name = 'Five Input Dry Contact';
            result.displayString = `C1: ${contact5_1}, C2: ${contact5_2}, C3: ${contact5_3}, C4: ${contact5_4}, C5: ${contact5_5}`;
            result.chartableData.push({ label: 'Contact Status', value: data[0], dataIndex: 0 });
            break;

        // === LIGHT SENSORS ===
        case 21: // Lux
        case 107: // Light Meter - u32 [Data1]+[Data0], divide by 100
            const lux = ((data[1] || 0) << 16 | (data[0] || 0)) / 100;
            result.name = 'Light Meter';
            result.displayString = `${lux.toFixed(2)} lux`;
            result.chartableData.push({ label: 'Light Level (lux)', value: lux, dataIndex: 0 });
            break;

        case 27: // Light Presence
            const lightPresence = data[0] === 1 ? 'Light Detected' : 'Dark';
            result.name = 'Light Presence';
            result.displayString = `Status: ${lightPresence}`;
            result.chartableData.push({ label: 'Light Presence', value: data[0], dataIndex: 0 });
            break;

        case 139: // Light Sensor PPFD
            const ppfd = data[0] | (data[1] << 16);
            result.name = 'Light Sensor PPFD';
            result.displayString = `${ppfd} μmol/m²/s`;
            result.chartableData.push({ label: 'PPFD (μmol/m²/s)', value: ppfd, dataIndex: 0 });
            break;

        // === PRESSURE SENSORS ===
        case 41: // Pressure Meter
            const pressure = (data[0] | (data[1] << 16)) / 1000;
            result.name = 'Pressure Meter';
            result.displayString = `${pressure.toFixed(3)} psi`;
            result.chartableData.push({ label: 'Pressure (psi)', value: pressure, dataIndex: 0 });
            break;

        case 79: // Pressure 50 PSI - u16 single register, divide by 10
            const pressure50 = (data[0] || 0) / 10;
            result.name = 'Pressure 50 PSI';
            result.displayString = `${pressure50.toFixed(1)} psi`;
            result.chartableData.push({ label: 'Pressure 50 PSI (psi)', value: pressure50, dataIndex: 0 });
            break;

        case 82: // Pressure 300 PSI - u16 single register, divide by 10
            const pressure300 = (data[0] || 0) / 10;
            result.name = 'Pressure 300 PSI';
            result.displayString = `${pressure300.toFixed(1)} psi`;
            result.chartableData.push({ label: 'Pressure 300 PSI (psi)', value: pressure300, dataIndex: 0 });
            break;

        case 83: // Pressure Custom - u16 single register, divide by 10
            const pressureCustom = (data[0] || 0) / 10;
            result.name = 'Pressure Custom';
            result.displayString = `${pressureCustom.toFixed(1)} psi`;
            result.chartableData.push({ label: 'Custom Pressure (psi)', value: pressureCustom, dataIndex: 0 });
            break;

        case 84: // Duct Temperature
            const ductTempC = toSigned16(data[0]) / 10;
            const ductTempF = (ductTempC * 9/5) + 32;
            result.name = 'Duct Temperature';
            result.displayString = `${ductTempC.toFixed(2)}°C / ${ductTempF.toFixed(2)}°F`;
            result.chartableData.push({ label: 'Duct Temperature (°C)', value: ductTempC, dataIndex: 0 });
            break;

        case 121: // Quartzdyne Pressure - not in spec; keep 32-bit /1000 if u32
            const quartzPressure = (data[0] | (data[1] << 16)) / 1000;
            result.name = 'Quartzdyne Pressure';
            result.displayString = `${quartzPressure.toFixed(3)} psi`;
            result.chartableData.push({ label: 'Quartzdyne Pressure (psi)', value: quartzPressure, dataIndex: 0 });
            break;

        case 144: // Pressure 750 PSI - u16 single register, divide by 10
            const pressure750 = (data[0] || 0) / 10;
            result.name = 'Pressure 750 PSI';
            result.displayString = `${pressure750.toFixed(1)} psi`;
            result.chartableData.push({ label: 'Pressure 750 PSI (psi)', value: pressure750, dataIndex: 0 });
            break;

        case 145: // Pressure 3000 PSI - u16 single register, divide by 10
            const pressure3000 = (data[0] || 0) / 10;
            result.name = 'Pressure 3000 PSI';
            result.displayString = `${pressure3000.toFixed(1)} psi`;
            result.chartableData.push({ label: 'Pressure 3000 PSI (psi)', value: pressure3000, dataIndex: 0 });
            break;

        // === CURRENT SENSORS ===
        case 22: // 0-20mA Current
            const currentMA = data[0] / 100;
            result.name = '0-20mA Current';
            result.displayString = `${currentMA.toFixed(2)} mA`;
            result.chartableData.push({ label: 'Current (mA)', value: currentMA, dataIndex: 0 });
            break;

        case 93: // Current Meter 20 Amp
            const amps20 = (data[0] | (data[1] << 16)) / 1000;
            result.name = 'Current Meter 20 Amp';
            result.displayString = `${amps20.toFixed(3)} Amps`;
            result.chartableData.push({ label: 'Current 20A (Amps)', value: amps20, dataIndex: 0 });
            break;

        case 94: // Current Meter 150 Amp
            const amps150 = (data[0] | (data[1] << 16)) / 1000;
            result.name = 'Current Meter 150 Amp';
            result.displayString = `${amps150.toFixed(3)} Amps`;
            result.chartableData.push({ label: 'Current 150A (Amps)', value: amps150, dataIndex: 0 });
            break;

        case 120: // Current Meter 500 Amp
            const amps500 = (data[0] | (data[1] << 16)) / 1000;
            result.name = 'Current Meter 500 Amp';
            result.displayString = `${amps500.toFixed(3)} Amps`;
            result.chartableData.push({ label: 'Current 500A (Amps)', value: amps500, dataIndex: 0 });
            break;

        case 137: // Three Phase 20 Amp Meter
            const amps3Phase20 = (data[0] | (data[1] << 16)) / 1000;
            result.name = 'Three Phase 20 Amp Meter';
            result.displayString = `${amps3Phase20.toFixed(3)} Amps`;
            result.chartableData.push({ label: '3-Phase Current 20A (Amps)', value: amps3Phase20, dataIndex: 0 });
            break;

        // === VOLTAGE SENSORS ===
        case 1: // Analog Voltage
            const analogVolts = data[0] / 1000;
            result.name = 'Analog Voltage';
            result.displayString = `${analogVolts.toFixed(3)} V`;
            result.chartableData.push({ label: 'Analog Voltage (V)', value: analogVolts, dataIndex: 0 });
            break;

        case 32: // 500V Meter
            const voltage500 = data[0] | (data[1] << 16);
            result.name = '500V Meter';
            result.displayString = `${voltage500} V`;
            result.chartableData.push({ label: 'Voltage (V)', value: voltage500, dataIndex: 0 });
            break;

        case 64: // AC Voltage Detection
            const acVoltage = data[0] | (data[1] << 16);
            result.name = 'AC Voltage Detection';
            result.displayString = `${acVoltage} VAC`;
            result.chartableData.push({ label: 'AC Voltage (VAC)', value: acVoltage, dataIndex: 0 });
            break;

        case 72: // 0-5V Measure
            const volts0to5 = data[0] / 1000;
            result.name = '0-5V Measure';
            result.displayString = `${volts0to5.toFixed(3)} V`;
            result.chartableData.push({ label: 'Voltage 0-5V (V)', value: volts0to5, dataIndex: 0 });
            break;

        case 74: // 0-10V Measure
            const volts0to10 = data[0] / 1000;
            result.name = '0-10V Measure';
            result.displayString = `${volts0to10.toFixed(3)} V`;
            result.chartableData.push({ label: 'Voltage 0-10V (V)', value: volts0to10, dataIndex: 0 });
            break;

        case 113: // Voltage Meter 200VDC - u32 [Data0]+[Data1], divide by 100
            const voltage200 = ((data[0] || 0) | ((data[1] || 0) << 16)) / 100;
            result.name = 'Voltage Meter - 200 VDC';
            result.displayString = `${voltage200.toFixed(2)} VDC`;
            result.chartableData.push({ label: 'DC Voltage 200V (VDC)', value: voltage200, dataIndex: 0 });
            break;

        case 122: // Voltage Meter 500VAC - u16 single register, divide by 100
            const voltage500AC = (data[0] || 0) / 100;
            result.name = 'Voltage Meter - 500 VAC';
            result.displayString = `${voltage500AC.toFixed(2)} VAC`;
            result.chartableData.push({ label: 'AC Voltage 500V (VAC)', value: voltage500AC, dataIndex: 0 });
            break;

        case 123: // Voltage Detection - 200 VDC
            const voltageDetect200 = data[0];
            result.name = 'Voltage Detection - 200 VDC';
            result.displayString = `${voltageDetect200} VDC`;
            result.chartableData.push({ label: 'DC Voltage Detection (VDC)', value: voltageDetect200, dataIndex: 0 });
            break;

        case 71: // DC Voltage Detection
            const dcVoltage = data[0] / 1000;
            result.name = 'DC Voltage Detection';
            result.displayString = `${dcVoltage.toFixed(3)} VDC`;
            result.chartableData.push({ label: 'DC Voltage (VDC)', value: dcVoltage, dataIndex: 0 });
            break;

        // === GAS SENSORS ===
        case 34: // CO Gas
            const coLevel = data[0];
            result.name = 'CO Gas';
            result.displayString = `${coLevel} ppm CO`;
            result.chartableData.push({ label: 'CO Level (ppm)', value: coLevel, dataIndex: 0 });
            break;

        case 106: // CO2 Meter
            const co2Level = data[0];
            result.name = 'CO2 Meter';
            result.displayString = `${co2Level} ppm CO2`;
            result.chartableData.push({ label: 'CO2 Level (ppm)', value: co2Level, dataIndex: 0 });
            break;

        case 116: // CO Meter
            const coMeterLevel = data[0];
            result.name = 'CO Meter';
            result.displayString = `${coMeterLevel} ppm CO`;
            result.chartableData.push({ label: 'CO Level (ppm)', value: coMeterLevel, dataIndex: 0 });
            break;

        // === ACCELEROMETER/VIBRATION SENSORS ===
        case 15: // Accelerometer P1
        case 20: // Accelerometer P2
            const accelX = toSigned16(data[0]) / 100;
            const accelY = toSigned16(data[1]) / 100;
            const accelZ = toSigned16(data[2]) / 100;
            result.name = 'Accelerometer';
            result.displayString = `X: ${accelX}g, Y: ${accelY}g, Z: ${accelZ}g`;
            result.chartableData.push({ label: 'Acceleration X (g)', value: accelX, dataIndex: 0 });
            result.chartableData.push({ label: 'Acceleration Y (g)', value: accelY, dataIndex: 1 });
            result.chartableData.push({ label: 'Acceleration Z (g)', value: accelZ, dataIndex: 2 });
            break;

        case 16: // Accelerometer P3 (different from P1/P2)
            const accelP3X = toSigned16(data[0]) / 100;
            const accelP3Y = toSigned16(data[1]) / 100;
            const accelP3Z = toSigned16(data[2]) / 100;
            result.name = 'Accelerometer P3';
            result.displayString = `X: ${accelP3X}g, Y: ${accelP3Y}g, Z: ${accelP3Z}g`;
            result.chartableData.push({ label: 'Acceleration X (g)', value: accelP3X, dataIndex: 0 });
            result.chartableData.push({ label: 'Acceleration Y (g)', value: accelP3Y, dataIndex: 1 });
            result.chartableData.push({ label: 'Acceleration Z (g)', value: accelP3Z, dataIndex: 2 });
            break;

        case 95: // Vibration Meter
            const vibration = data[0];
            result.name = 'Vibration Meter';
            result.displayString = `${vibration} vibration units`;
            result.chartableData.push({ label: 'Vibration', value: vibration, dataIndex: 0 });
            break;

        case 104: // Vibration800
            const vibration800 = data[0];
            result.name = 'Vibration800';
            result.displayString = `${vibration800} vibration units`;
            result.chartableData.push({ label: 'Vibration 800', value: vibration800, dataIndex: 0 });
            break;

        // === ADVANCED VIBRATION SENSORS ===
        case 111: // Advanced Vibration - ORIGINAL IMPLEMENTATION
            const vibrationMode = data[6];
            const vibrationTempC = toSigned16(data[7]) / 10;
            const vibrationTempF = (vibrationTempC * 9/5) + 32;
            
            let xVibration, yVibration, zVibration, xFreq, yFreq, zFreq;
            let vibrationUnits, frequencyUnits;
            
            switch(vibrationMode) {
                case 0: // Velocity RMS
                    vibrationUnits = 'mm/s';
                    frequencyUnits = 'Hz';
                    xVibration = toSigned16(data[0]) / 100;
                    yVibration = toSigned16(data[1]) / 100;
                    zVibration = toSigned16(data[2]) / 100;
                    break;
                case 1: // Acceleration RMS
                    vibrationUnits = 'mm/s²';
                    frequencyUnits = 'Hz';
                    xVibration = toSigned16(data[0]) * 10;
                    yVibration = toSigned16(data[1]) * 10;
                    zVibration = toSigned16(data[2]) * 10;
                    break;
                case 2: // Acceleration Time Peak
                    vibrationUnits = 'mm/s²';
                    frequencyUnits = 'Hz';
                    xVibration = toSigned16(data[0]) * 10;
                    yVibration = toSigned16(data[1]) * 10;
                    zVibration = toSigned16(data[2]) * 10;
                    break;
                case 4: // Displacement
                    vibrationUnits = 'mm';
                    frequencyUnits = 'Hz';
                    xVibration = toSigned16(data[0]) / 100;
                    yVibration = toSigned16(data[1]) / 100;
                    zVibration = toSigned16(data[2]) / 100;
                    break;
                default:
                    vibrationUnits = 'raw';
                    frequencyUnits = 'raw';
                    xVibration = toSigned16(data[0]);
                    yVibration = toSigned16(data[1]);
                    zVibration = toSigned16(data[2]);
            }
            
            xFreq = toSigned16(data[3]) / 5;  // Divide by 5 for 0.2 Hz resolution
            yFreq = toSigned16(data[4]) / 5;
            zFreq = toSigned16(data[5]) / 5;
            
            const modeNames = ['Velocity RMS', 'Acceleration RMS', 'Acceleration Time Peak', '', 'Displacement'];
            const modeName = modeNames[vibrationMode] || `Unknown Mode (${vibrationMode})`;
            
            result.name = 'Advanced Vibration';
            result.displayString = `${modeName}: X:${xVibration.toFixed(2)}${vibrationUnits}, Y:${yVibration.toFixed(2)}${vibrationUnits}, Z:${zVibration.toFixed(2)}${vibrationUnits}, Temp:${vibrationTempC.toFixed(1)}°C`;
            
            result.chartableData.push({ label: `X Vibration (${vibrationUnits})`, value: xVibration, dataIndex: 0 });
            result.chartableData.push({ label: `Y Vibration (${vibrationUnits})`, value: yVibration, dataIndex: 1 });
            result.chartableData.push({ label: `Z Vibration (${vibrationUnits})`, value: zVibration, dataIndex: 2 });
            result.chartableData.push({ label: 'X Frequency (Hz)', value: xFreq, dataIndex: 3 });
            result.chartableData.push({ label: 'Y Frequency (Hz)', value: yFreq, dataIndex: 4 });
            result.chartableData.push({ label: 'Z Frequency (Hz)', value: zFreq, dataIndex: 5 });
            result.chartableData.push({ label: 'Mode', value: vibrationMode, dataIndex: 6 });
            result.chartableData.push({ label: 'Temperature (°C)', value: vibrationTempC, dataIndex: 7 });
            break;

        case 142: // Advanced Vibration 2 - COMPLETELY DIFFERENT IMPLEMENTATION
            const vibration2Mode = data[6];
            const vibration2TempC = toSigned16(data[7]) / 10;
            const vibration2TempF = (vibration2TempC * 9/5) + 32;
            
            let xVib2, yVib2, zVib2, xFreq2, yFreq2, zFreq2;
            let vibration2Units, frequency2Units;
            
            switch(vibration2Mode) {
                case 0: // Velocity RMS
                    vibration2Units = 'mm/s';
                    frequency2Units = 'Hz';
                    xVib2 = toSigned16(data[0]) / 100;
                    yVib2 = toSigned16(data[1]) / 100;
                    zVib2 = toSigned16(data[2]) / 100;
                    break;
                case 1: // Acceleration RMS
                    vibration2Units = 'mm/s²';
                    frequency2Units = 'Hz';
                    xVib2 = toSigned16(data[0]) * 10;
                    yVib2 = toSigned16(data[1]) * 10;
                    zVib2 = toSigned16(data[2]) * 10;
                    break;
                case 4: // Displacement RMS (different from 111)
                    vibration2Units = 'mm p-p';
                    frequency2Units = 'Hz';
                    xVib2 = toSigned16(data[0]) / 100;
                    yVib2 = toSigned16(data[1]) / 100;
                    zVib2 = toSigned16(data[2]) / 100;
                    break;
                default:
                    vibration2Units = 'raw';
                    frequency2Units = 'raw';
                    xVib2 = toSigned16(data[0]);
                    yVib2 = toSigned16(data[1]);
                    zVib2 = toSigned16(data[2]);
            }
            
            // KEY DIFFERENCE: Divide by 10 for 1 decimal point resolution (not 5 like profile 111)
            xFreq2 = toSigned16(data[3]) / 10;
            yFreq2 = toSigned16(data[4]) / 10;
            zFreq2 = toSigned16(data[5]) / 10;
            
            const mode2Names = ['Velocity RMS', 'Acceleration RMS', '', '', 'Displacement RMS'];
            const mode2Name = mode2Names[vibration2Mode] || `Unknown Mode (${vibration2Mode})`;
            
            result.name = 'Advanced Vibration 2';
            result.displayString = `${mode2Name}: X:${xVib2.toFixed(2)}${vibration2Units}, Y:${yVib2.toFixed(2)}${vibration2Units}, Z:${zVib2.toFixed(2)}${vibration2Units}, Temp:${vibration2TempC.toFixed(1)}°C`;
            
            result.chartableData.push({ label: `X Vibration (${vibration2Units})`, value: xVib2, dataIndex: 0 });
            result.chartableData.push({ label: `Y Vibration (${vibration2Units})`, value: yVib2, dataIndex: 1 });
            result.chartableData.push({ label: `Z Vibration (${vibration2Units})`, value: zVib2, dataIndex: 2 });
            result.chartableData.push({ label: 'X Frequency (Hz)', value: xFreq2, dataIndex: 3 });
            result.chartableData.push({ label: 'Y Frequency (Hz)', value: yFreq2, dataIndex: 4 });
            result.chartableData.push({ label: 'Z Frequency (Hz)', value: zFreq2, dataIndex: 5 });
            result.chartableData.push({ label: 'Mode', value: vibration2Mode, dataIndex: 6 });
            result.chartableData.push({ label: 'Temperature (°C)', value: vibration2TempC, dataIndex: 7 });
            break;

        // === CONTROL/RELAY SENSORS ===
        case 12: // Control Unit
            const relay1 = (data[0] & 1) ? 'On' : 'Off';
            const relay2 = (data[0] & 2) ? 'On' : 'Off';
            result.name = 'Control Unit';
            result.displayString = `Relay 1: ${relay1}, Relay 2: ${relay2}`;
            result.chartableData.push({ label: 'Relay Status', value: data[0], dataIndex: 0 });
            break;

        // === LIQUID LEVEL SENSORS ===
        case 26: // Liquid Level 8"
            const level8 = data[0];
            result.name = 'Liquid Level 8"';
            result.displayString = `${level8}% full`;
            result.chartableData.push({ label: 'Liquid Level 8\" (%)', value: level8, dataIndex: 0 });
            break;

        case 36: // Liquid Level 24"
            const level24 = data[0];
            result.name = 'Liquid Level 24"';
            result.displayString = `${level24}% full`;
            result.chartableData.push({ label: 'Liquid Level 24\" (%)', value: level24, dataIndex: 0 });
            break;

        case 124: // Propane - Data0=Gas Level (s16), divide by 100 for %
            const propaneLevel = toSigned16(data[0]) / 100;
            result.name = 'Propane Tank Monitor';
            result.displayString = `${propaneLevel.toFixed(2)}% full`;
            result.chartableData.push({ label: 'Propane Level (%)', value: propaneLevel, dataIndex: 0 });
            break;

        // === TILT SENSORS ===
        case 75: // Tilt
            const tilt = toSigned16(data[0]) / 100;
            result.name = 'Tilt';
            result.displayString = `${tilt.toFixed(2)}° tilt`;
            result.chartableData.push({ label: 'Tilt (degrees)', value: tilt, dataIndex: 0 });
            break;

        case 130: // Tilt Detection
            const tiltDetect = toSigned16(data[0]) / 100;
            result.name = 'Tilt Detection';
            result.displayString = `${tiltDetect.toFixed(2)}° tilt`;
            result.chartableData.push({ label: 'Tilt Detection (degrees)', value: tiltDetect, dataIndex: 0 });
            break;

        // === PULSE COUNTER SENSORS ===
        case 47: // Multi Pulse Counter
        case 48: // Pulse Counter
        case 69: // Dual Input Pulse Counter
            const pulseCount = data[0] | (data[1] << 16);
            result.name = 'Pulse Counter';
            result.displayString = `${pulseCount} pulses`;
            result.chartableData.push({ label: 'Pulse Count', value: pulseCount, dataIndex: 0 });
            break;

        case 73: // Filtered Pulse Counter
            const filteredPulseCount = data[0] | (data[1] << 16);
            result.name = 'Filtered Pulse Counter';
            result.displayString = `${filteredPulseCount} pulses`;
            result.chartableData.push({ label: 'Filtered Pulse Count', value: filteredPulseCount, dataIndex: 0 });
            break;

        case 90: // Filtered Pulse Counter 64 bit
            const pulseCount64 = parse32Bit(data[1], data[0]); // Note: data[1] is high word
            result.name = 'Filtered Pulse Counter 64 bit';
            result.displayString = `${pulseCount64} pulses`;
            result.chartableData.push({ label: 'Pulse Count 64-bit', value: pulseCount64, dataIndex: 0 });
            break;

        case 153: // Dual Input Pulse Counter (duplicate ID)
            const dualPulseCount = data[0] | (data[1] << 16);
            result.name = 'Dual Input Pulse Counter';
            result.displayString = `${dualPulseCount} pulses`;
            result.chartableData.push({ label: 'Pulse Count', value: dualPulseCount, dataIndex: 0 });
            break;

        // === RESISTANCE SENSORS ===
        case 70: // Resistance - u32 [Data1]+[Data0], divide by 10
            const resistance = ((data[1] || 0) << 16 | (data[0] || 0)) / 10;
            result.name = 'Resistance';
            result.displayString = `${resistance.toFixed(1)} Ω`;
            result.chartableData.push({ label: 'Resistance (Ω)', value: resistance, dataIndex: 0 });
            break;

        case 99: // Resistance Delta
            const resistanceDelta = toSigned16(data[0]);
            result.name = 'Resistance Delta';
            result.displayString = `${resistanceDelta} Ω`;
            result.chartableData.push({ label: 'Resistance Delta (Ω)', value: resistanceDelta, dataIndex: 0 });
            break;

        case 154: // Resistive Bridge
            const resistiveBridge = data[0] | (data[1] << 16);
            result.name = 'Resistive Bridge';
            result.displayString = `${resistiveBridge} Ω`;
            result.chartableData.push({ label: 'Resistive Bridge (Ω)', value: resistiveBridge, dataIndex: 0 });
            break;

        case 92: // Quad Temp
        case 131: // Filtered Quad Temp - divide by 10 per spec
            const filteredQuadTemp1 = toSigned16(data[0]) / 10;
            const filteredQuadTemp2 = toSigned16(data[1]) / 10;
            const filteredQuadTemp3 = toSigned16(data[2]) / 10;
            const filteredQuadTemp4 = toSigned16(data[3]) / 10;
            result.name = sensor.deviceType === 92 ? 'Quad Temperature' : 'Filtered Quad Temperature';
            result.displayString = `T1: ${filteredQuadTemp1.toFixed(2)}°C, T2: ${filteredQuadTemp2.toFixed(2)}°C, T3: ${filteredQuadTemp3.toFixed(2)}°C, T4: ${filteredQuadTemp4.toFixed(2)}°C`;
            result.chartableData.push({ label: 'Filtered Temp 1 (°C)', value: filteredQuadTemp1, dataIndex: 0 });
            result.chartableData.push({ label: 'Filtered Temp 2 (°C)', value: filteredQuadTemp2, dataIndex: 1 });
            result.chartableData.push({ label: 'Filtered Temp 3 (°C)', value: filteredQuadTemp3, dataIndex: 2 });
            result.chartableData.push({ label: 'Filtered Temp 4 (°C)', value: filteredQuadTemp4, dataIndex: 3 });
            break;

        case 134: // Soot Blower
            const sootBlower = data[0];
            result.name = 'Soot Blower';
            result.displayString = `Soot Blower: ${sootBlower}`;
            result.chartableData.push({ label: 'Soot Blower', value: sootBlower, dataIndex: 0 });
            break;

        case 135: // Soil Moisture - Data0=Moisture(centibars), divide by 10
            const soilMoisture = (data[0] || 0) / 10;
            result.name = 'Soil Moisture';
            result.displayString = `${soilMoisture.toFixed(1)} Cb (centibars)`;
            result.chartableData.push({ label: 'Soil Moisture (%)', value: soilMoisture, dataIndex: 0 });
            break;

        case 143: // Site Survey
            const siteSurvey = data[0];
            result.name = 'Site Survey';
            result.displayString = `Site Survey: ${siteSurvey}`;
            result.chartableData.push({ label: 'Site Survey', value: siteSurvey, dataIndex: 0 });
            break;

        case 150: // Motion Temp Water
            const motionWaterTempC = toSigned16(data[0]) / 100;
            const motionWaterTempF = (motionWaterTempC * 9/5) + 32;
            result.name = 'Motion Temp Water';
            result.displayString = `${motionWaterTempC.toFixed(2)}°C / ${motionWaterTempF.toFixed(2)}°F`;
            result.chartableData.push({ label: 'Motion Temp Water (°C)', value: motionWaterTempC, dataIndex: 0 });
            break;

        // === VEHICLE DETECTION SENSORS ===
        case 33: // Vehicle Presence
            const vehiclePresence = data[0] === 1 ? 'Vehicle Present' : 'No Vehicle';
            result.name = 'Vehicle Presence';
            result.displayString = `Status: ${vehiclePresence}`;
            result.chartableData.push({ label: 'Vehicle Presence', value: data[0], dataIndex: 0 });
            break;

        case 39: // Vehicle Detector
            const vehicleDetect = data[0] === 1 ? 'Vehicle Detected' : 'No Vehicle';
            result.name = 'Vehicle Detector';
            result.displayString = `Status: ${vehicleDetect}`;
            result.chartableData.push({ label: 'Vehicle Detection', value: data[0], dataIndex: 0 });
            break;

        case 40: // Vehicle Speed
            const vehicleSpeed = data[0] / 100;
            result.name = 'Vehicle Speed';
            result.displayString = `${vehicleSpeed.toFixed(2)} mph`;
            result.chartableData.push({ label: 'Vehicle Speed (mph)', value: vehicleSpeed, dataIndex: 0 });
            break;

        case 119: // Vehicle Counter-Detection
            const vehicleCount = data[0] | (data[1] << 16);
            result.name = 'Vehicle Counter-Detection';
            result.displayString = `${vehicleCount} vehicles`;
            result.chartableData.push({ label: 'Vehicle Count', value: vehicleCount, dataIndex: 0 });
            break;

        // === ASSET LOCATION SENSORS ===
        case 117: // AssetLocationRepeater
            const repeaterId = data[0];
            result.name = 'Asset Location Repeater';
            result.displayString = `Repeater ID: ${repeaterId}`;
            result.chartableData.push({ label: 'Repeater ID', value: repeaterId, dataIndex: 0 });
            break;

        case 118: // AssetLocationTag
            const tagId = data[0];
            result.name = 'Asset Location Tag';
            result.displayString = `Tag ID: ${tagId}`;
            result.chartableData.push({ label: 'Tag ID', value: tagId, dataIndex: 0 });
            break;

        // === G-FORCE SENSOR ===
        case 126: // Accelerometer Max/Avg - u16 Data0-7, divide by 1000
            const gXMax = (data[0] || 0) / 1000, gYMax = (data[1] || 0) / 1000, gZMax = (data[2] || 0) / 1000;
            const gMaxMag = (data[3] || 0) / 1000, gXAvg = (data[4] || 0) / 1000, gYAvg = (data[5] || 0) / 1000;
            const gZAvg = (data[6] || 0) / 1000, gAvgMag = (data[7] || 0) / 1000;
            result.name = 'G-force - Max & Avg';
            result.displayString = `Max: X${gXMax.toFixed(3)}g Y${gYMax.toFixed(3)}g Z${gZMax.toFixed(3)}g | Avg: X${gXAvg.toFixed(3)}g Y${gYAvg.toFixed(3)}g Z${gZAvg.toFixed(3)}g`;
            result.chartableData.push({ label: 'X Max (g)', value: gXMax, dataIndex: 0 });
            result.chartableData.push({ label: 'Y Max (g)', value: gYMax, dataIndex: 1 });
            result.chartableData.push({ label: 'Z Max (g)', value: gZMax, dataIndex: 2 });
            result.chartableData.push({ label: 'Max Magnitude (g)', value: gMaxMag, dataIndex: 3 });
            result.chartableData.push({ label: 'X Avg (g)', value: gXAvg, dataIndex: 4 });
            result.chartableData.push({ label: 'Y Avg (g)', value: gYAvg, dataIndex: 5 });
            result.chartableData.push({ label: 'Z Avg (g)', value: gZAvg, dataIndex: 6 });
            result.chartableData.push({ label: 'Avg Magnitude (g)', value: gAvgMag, dataIndex: 7 });
            break;

        // === DIFFERENTIAL PRESSURE ===
        case 103: // Differential Pressure - Data0=Pressure(Pa), Data1=Temp; both s16, divide by 10
            const diffPressurePa = toSigned16(data[0]) / 10;
            const diffPressureTempC = toSigned16(data[1]) / 10;
            result.name = 'Differential Pressure';
            result.displayString = `${diffPressurePa.toFixed(1)} Pa, ${diffPressureTempC.toFixed(1)}°C`;
            result.chartableData.push({ label: 'Pressure (Pa)', value: diffPressurePa, dataIndex: 0 });
            result.chartableData.push({ label: 'Temperature (°C)', value: diffPressureTempC, dataIndex: 1 });
            break;

        // === DWELL TIME ===
        case 110: // DwellTime
            const dwellTime = data[0] | (data[1] << 16);
            result.name = 'DwellTime';
            result.displayString = `${dwellTime} seconds`;
            result.chartableData.push({ label: 'Dwell Time (seconds)', value: dwellTime, dataIndex: 0 });
            break;

        // === MAGNETIC PRESENCE ===
        case 6: // Magnetic Presence
            const magneticPresence = data[0] === 1 ? 'Magnet Present' : 'No Magnet';
            result.name = 'Magnetic Presence';
            result.displayString = `Status: ${magneticPresence}`;
            result.chartableData.push({ label: 'Magnetic Presence', value: data[0], dataIndex: 0 });
            break;

        // === BUTTON/SWITCH SENSORS ===
        case 11: // Button
            const buttonState = data[0] === 1 ? 'Pressed' : 'Released';
            result.name = 'Button';
            result.displayString = `Status: ${buttonState}`;
            result.chartableData.push({ label: 'Button State', value: data[0], dataIndex: 0 });
            break;

        // === FLEX/BEND SENSORS ===
        case 24: // Flex
            const flex = toSigned16(data[0]);
            result.name = 'Flex';
            result.displayString = `${flex} flex units`;
            result.chartableData.push({ label: 'Flex', value: flex, dataIndex: 0 });
            break;

        // === COMPASS SENSOR ===
        case 28: // Compass
            const heading = toSigned16(data[0]) / 10;
            result.name = 'Compass';
            result.displayString = `${heading.toFixed(1)}°`;
            result.chartableData.push({ label: 'Heading (degrees)', value: heading, dataIndex: 0 });
            break;

        // === LOCAL ALERT ===
        case 13: // Local Alert
            const localAlertState = data[0] === 1 ? 'Alert Active' : 'No Alert';
            result.name = 'Local Alert';
            result.displayString = `Status: ${localAlertState}`;
            result.chartableData.push({ label: 'Local Alert', value: data[0], dataIndex: 0 });
            break;

        // === 500V METER ===
        case 32: // 500V Meter
            const volts500 = data[0] | (data[1] << 16);
            result.name = '500V Meter';
            result.displayString = `${volts500} V`;
            result.chartableData.push({ label: 'Voltage (V)', value: volts500, dataIndex: 0 });
            break;

        // === POWER CT1MA ===
        case 55: // Power CT1MA
            const powerCT = (data[0] | (data[1] << 16)) / 1000;
            result.name = 'Power CT1MA';
            result.displayString = `${powerCT.toFixed(3)} kW`;
            result.chartableData.push({ label: 'Power (kW)', value: powerCT, dataIndex: 0 });
            break;

        // === BATTERY HEALTH ===
        case 59: // Battery Health
            const batteryHealth = data[0];
            result.name = 'Battery Health';
            result.displayString = `${batteryHealth}% health`;
            result.chartableData.push({ label: 'Battery Health (%)', value: batteryHealth, dataIndex: 0 });
            break;

        // === ASSET SENSORS ===
        case 66: // Asset
            const assetId = data[0];
            result.name = 'Asset';
            result.displayString = `Asset ID: ${assetId}`;
            result.chartableData.push({ label: 'Asset ID', value: assetId, dataIndex: 0 });
            break;

        case 85: // Short Range Asset
            const shortRangeAsset = data[0];
            result.name = 'Short Range Asset';
            result.displayString = `Short Range Asset: ${shortRangeAsset}`;
            result.chartableData.push({ label: 'Short Range Asset', value: shortRangeAsset, dataIndex: 0 });
            break;

        // === THERMOCOUPLE ===
        case 86: // Thermocouple - s16, divide by 10
            const thermocoupleTempC = toSigned16(data[0]) / 10;
            const thermocoupleTempF = (thermocoupleTempC * 9/5) + 32;
            result.name = 'Thermocouple';
            result.displayString = `${thermocoupleTempC.toFixed(2)}°C / ${thermocoupleTempF.toFixed(2)}°F`;
            result.chartableData.push({ label: 'Thermocouple (°C)', value: thermocoupleTempC, dataIndex: 0 });
            break;

        // === M1 CURRENT TRANSDUCER ===
        case 89: // M1 Current Transducer
            const m1Current = (data[0] | (data[1] << 16)) / 1000;
            result.name = 'M1 Current Transducer';
            result.displayString = `${m1Current.toFixed(3)} Amps`;
            result.chartableData.push({ label: 'M1 Current (Amps)', value: m1Current, dataIndex: 0 });
            break;

        // === BASIC CONTROL ===
        case 76: // Basic Control
            const basicControlState = data[0] === 1 ? 'Active' : 'Inactive';
            result.name = 'Basic Control';
            result.displayString = `Control: ${basicControlState}`;
            result.chartableData.push({ label: 'Basic Control', value: data[0], dataIndex: 0 });
            break;

        // === GRID EYE ===
        case 77: // Grid Eye
            const gridEye = data[0];
            result.name = 'Grid Eye';
            result.displayString = `Grid Eye: ${gridEye}`;
            result.chartableData.push({ label: 'Grid Eye', value: gridEye, dataIndex: 0 });
            break;

        // === SEAT SENSOR ===
        case 51: // Seat
            const seatState = data[0] === 1 ? 'Occupied' : 'Empty';
            result.name = 'Seat';
            result.displayString = `Status: ${seatState}`;
            result.chartableData.push({ label: 'Seat Occupancy', value: data[0], dataIndex: 0 });
            break;

        // === AIR FLOW ===
        case 52: // Air Flow
            const airFlow = data[0] | (data[1] << 16);
            result.name = 'Air Flow';
            result.displayString = `${airFlow} CFM`;
            result.chartableData.push({ label: 'Air Flow (CFM)', value: airFlow, dataIndex: 0 });
            break;

        // === THERMOSTAT ===
        case 97: // Thermostat
            const thermostatState = data[0] === 1 ? 'Active' : 'Inactive';
            result.name = 'Thermostat';
            result.displayString = `Status: ${thermostatState}`;
            result.chartableData.push({ label: 'Thermostat State', value: data[0], dataIndex: 0 });
            break;

        default:
            result.name = `Sensor Type ${sensor.deviceType}`;
            // Only report when we have data; no datums = no reason to report
            if (data && data.length > 0) {
                const slice = data.slice(0, 8);
                result.displayString = `Raw: [${slice.join(', ')}]`;
                for (let i = 0; i < slice.length; i++) {
                    result.chartableData.push({ label: `Data[${i}]`, value: slice[i], dataIndex: i });
                }
            } else {
                result.displayString = 'N/A';
            }
            break;
    }

    // Enrich chartableData with valueType, unit, and options for alert UI
    result.deviceType = sensor.deviceType;
    const discreteLabels = {
        4: { 0: 'Dry', 1: 'Water Detected' },
        78: { 0: 'Dry', 1: 'Water Detected' },
        5: { 0: 'Inactive', 1: 'Active' },
        23: { 0: 'No Motion', 1: 'Motion Detected' },
        101: { 0: 'No Motion', 1: 'Motion Detected' },
        138: { 0: 'No Motion', 1: 'Motion Detected' },
        3: { 0: 'Closed', 1: 'Open' },
        9: { 0: 'Closed', 1: 'Open' },
        27: { 0: 'Dark', 1: 'Light Detected' },
        11: { 0: 'Released', 1: 'Pressed' },
        13: { 0: 'No Alert', 1: 'Alert Active' }
    };
    const discreteDeviceTypes = new Set([3, 4, 5, 9, 11, 13, 23, 27, 78, 101, 138]);
    result.chartableData.forEach(d => {
        if (d.valueType) return;
        const isDiscrete = discreteDeviceTypes.has(sensor.deviceType);
        if (isDiscrete) {
            d.valueType = 'discrete';
            const labels = discreteLabels[sensor.deviceType];
            d.options = [
                { value: 0, label: (labels && labels[0]) || 'False' },
                { value: 1, label: (labels && labels[1]) || 'True' }
            ];
        } else {
            d.valueType = 'numeric';
            const m = d.label.match(/\(([^)]+)\)$/);
            d.unit = m ? m[1] : '';
        }
    });

    return result;
}

// Node/Electron main process: CommonJS export (use require from main.js)
module.exports = { parseSensorData };