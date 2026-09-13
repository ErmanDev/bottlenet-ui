/* Shared mock state. Network authorization belongs in a real backend/router integration. */
(() => {
    const KEY = 'bottlenet-demo-v1';
    const API_KEY = 'bottlenet-api-base';
    const DEFAULT_API = 'http://192.168.4.1';
    const SIZES = { large: { label: '1L bottle', short: '1L', minutes: 10, minWeight: 24, maxWeight: 45 }, mismo: { label: 'Mismo size', short: 'Mismo', minutes: 7, minWeight: 17, maxWeight: 24 }, sakto: { label: 'Sakto size', short: 'Sakto', minutes: 5, minWeight: 10, maxWeight: 17 } };
    const seed = () => ({ rate: 10, sizes: JSON.parse(JSON.stringify(SIZES)), minWeight: 10, maxWeight: 70, bin: 64, station: 'ready', bottles: 128, sessionBottles: 2, lastReward: 10, expiresAt: Date.now() + 1122000, sessionTotal: 1122000, depositOwner: null, depositUntil: 0, transactions: Array.from({ length: 8 }, (_, i) => { const weight = [18.4, 12.1, 7.3, 24.8, 16.2, 32.4, 11.8, 20.5][i], accepted = i !== 2, key = Object.keys(SIZES).find(k => weight >= SIZES[k].minWeight && weight < SIZES[k].maxWeight) || null; return { id: `BN-${1048 - i}`, time: Date.now() - i * 240000, session: i === 0 ? 'Your device' : `Device ${i + 1}`, weight, accepted, size: accepted ? key : null, minutes: accepted && key ? SIZES[key].minutes : 0 }; }), sessions: Array.from({ length: 7 }, (_, i) => ({ id: `device-${i + 2}`, name: `Device ${i + 2}`, expiresAt: Date.now() + (i + 1) * 360000, bottles: i + 1 })), collections: [48, 72, 59, 91, 84, 112, 128], armed: true, sensors: { lid: 'ok', tamper: 'ok', door: 'ok', weight: 'ok', power: 'ok' }, notify: { email: true, sms: false, siren: true }, alarms: [ { id: 'AL-2041', time: Date.now() - 420000, type: 'bin_opened', level: 'critical', ack: false }, { id: 'AL-2040', time: Date.now() - 5400000, type: 'door_open', level: 'warning', ack: false }, { id: 'AL-2039', time: Date.now() - 27000000, type: 'tamper', level: 'critical', ack: true }, { id: 'AL-2038', time: Date.now() - 79200000, type: 'power', level: 'warning', ack: true } ], mode: 'demo', stationId: 'BN-001', stationName: 'Campus station 01', trashLevel: 'NOT FULL', trashDistanceCm: 0, lastBottle: 'None', lastWeightG: 0, lastResult: 'Waiting', lastResultKind: 'waiting', deviceOnline: false });
    let fallback;
    function migrate(data) { const base = seed(); for (const key in base) if (!(key in data)) data[key] = base[key]; return data; }
    function get() { try {
        const raw = localStorage.getItem(KEY);
        if (raw)
            return migrate(JSON.parse(raw));
    }
    catch { } return fallback || reset(); }
    function save(data) { fallback = data; try {
        localStorage.setItem(KEY, JSON.stringify(data));
    }
    catch { } window.dispatchEvent(new Event('bottlenet-change')); return data; }
    function reset() { return save(seed()); }
    function update(fn) { const data = get(); fn(data); return save(data); }
    function time(ms) { const seconds = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
    function sizeFor(weight) { const list = Object.entries(get().sizes); const hit = list.find(([, v]) => weight >= v.minWeight && weight < v.maxWeight); return hit ? hit[0] : null; }
    function getApiBase() {
        try {
            const q = new URLSearchParams(location.search).get('api');
            if (q && q.trim())
                return q.trim().replace(/\/$/, '');
        }
        catch { }
        try {
            const stored = localStorage.getItem(API_KEY);
            if (stored && stored.trim())
                return stored.trim().replace(/\/$/, '');
        }
        catch { }
        return DEFAULT_API;
    }
    function setApiBase(url) {
        const next = String(url || DEFAULT_API).trim().replace(/\/$/, '') || DEFAULT_API;
        try {
            localStorage.setItem(API_KEY, next);
        }
        catch { }
        window.dispatchEvent(new CustomEvent('bottlenet-api-base', { detail: { base: next } }));
        return next;
    }
    window.BottleNet = { get, save, reset, update, time, sizeFor, SIZES, getApiBase, setApiBase };
})();
