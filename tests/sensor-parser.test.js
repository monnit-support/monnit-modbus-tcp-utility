import { createRequire } from 'module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const { parseSensorData } = require('../public/sensor-parser.cjs');

describe('parseSensorData (sensor-parser.cjs)', () => {
    it('parses basic temperature (device type 2)', () => {
        const result = parseSensorData({
            deviceType: 2,
            data: [250, 0, 0, 0, 0, 0, 0, 0]
        });
        expect(result.name).toBe('Temperature');
        expect(result.displayString).toMatch(/°C/);
    });
});
