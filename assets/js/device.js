/* Live SoftAP adapter with Demo mock fallback. */
(() => {
    const DEFAULT_BASE = 'http://192.168.4.1';
    const POLL_MS = 1000;
    const HEALTH_TIMEOUT_MS = 1500;
    const STATUS_TIMEOUT_MS = 1800;

    const params = (() => {
        try { return new URLSearchParams(location.search); }
        catch { return new URLSearchParams(); }
    })();

    let baseUrl = DEFAULT_BASE;
    try {
        const q = params.get('api');
        if (q && q.trim()) baseUrl = q.trim().replace(/\/$/, '');
        else if (window.BottleNet && typeof window.BottleNet.getApiBase === 'function')
            baseUrl = window.BottleNet.getApiBase();
    } catch { }

    const requested = (params.get('mode') || 'auto').toLowerCase();
    let mode = ['auto', 'live', 'demo'].includes(requested) ? requested : 'auto';
    let live = false;
    let pollTimer = null;
    let lastSeenKey = null;
    let started = false;

    function isLive() { return live; }

    function binFromTrash(level) {
        const t = String(level || '').toUpperCase();
        if (t === 'FULL') return 95;
        if (t === 'HALF FULL' || t === 'HALF') return 65;
        return 20;
    }

    function sizeKeyFromBottle(name) {
        const n = String(name || '').toUpperCase();
        if (n.includes('1L') || n.includes('COKE 1')) return 'large';
        if (n.includes('MISMO')) return 'mismo';
        if (n.includes('SAKTO')) return 'sakto';
        return null;
    }

    function minutesForBottle(name, rates, store) {
        const key = sizeKeyFromBottle(name);
        if (rates) {
            if (key === 'large' && rates.coke1l != null) return Number(rates.coke1l) || 0;
            if (key === 'mismo' && rates.mismo != null) return Number(rates.mismo) || 0;
            if (key === 'sakto' && rates.sakto != null) return Number(rates.sakto) || 0;
        }
        if (key && store.sizes && store.sizes[key]) return Number(store.sizes[key].minutes) || 0;
        return 0;
    }

    function setLive(next) {
        if (live === next) return;
        live = next;
        try {
            window.BottleNet.update(s => { s.mode = next ? 'live' : 'demo'; s.deviceOnline = next; });
        } catch { }
        window.dispatchEvent(new CustomEvent('bottlenet-mode', { detail: { mode: next ? 'live' : 'demo', live: next } }));
        updateBadges();
    }

    function updateBadges() {
        document.querySelectorAll('[data-bn-mode-badge], #mode-badge').forEach(el => {
            el.textContent = live ? 'Live' : 'Demo';
            el.dataset.tone = live ? 'live' : 'demo';
            el.classList.toggle('live', live);
            el.classList.toggle('demo', !live);
            if (el.classList.contains('mode-badge') || el.id === 'mode-badge')
                el.className = `mode-badge ${live ? 'live' : 'demo'}`;
            el.setAttribute('title', live ? 'Polling SoftAP /api/status' : 'Using mock station data');
        });
        const ws = document.getElementById('workspace-badge');
        if (ws) {
            ws.textContent = live ? 'Live workspace' : 'Demo workspace';
            ws.className = live ? 'badge green' : 'badge';
        }
        document.querySelectorAll('[data-bn-live-only]').forEach(el => {
            el.hidden = !live;
        });
        document.querySelectorAll('[data-bn-demo-only]').forEach(el => {
            el.hidden = live;
            if ('disabled' in el) el.disabled = live;
        });
        document.querySelectorAll('.demo-panel').forEach(panel => {
            if (live) {
                panel.setAttribute('data-live-locked', '1');
                panel.querySelectorAll('select, button, input').forEach(ctrl => { ctrl.disabled = true; });
                let note = panel.querySelector('[data-bn-live-note]');
                if (!note) {
                    note = document.createElement('p');
                    note.dataset.bnLiveNote = '1';
                    note.className = 'muted';
                    panel.appendChild(note);
                }
                note.textContent = 'Live device connected — Preview controls are disabled. Disconnect from PlasticBottle_WiFi or use ?mode=demo to simulate.';
            } else {
                panel.removeAttribute('data-live-locked');
                panel.querySelectorAll('select, button, input').forEach(ctrl => { ctrl.disabled = false; });
                const note = panel.querySelector('[data-bn-live-note]');
                if (note) note.remove();
            }
        });
    }

    async function fetchJson(path, timeoutMs) {
        const ctrl = new AbortController();
        const kill = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
            const res = await fetch(baseUrl.replace(/\/$/, '') + path, {
                signal: ctrl.signal,
                cache: 'no-store',
                headers: { Accept: 'application/json' }
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return await res.json();
        } finally {
            clearTimeout(kill);
        }
    }

    async function checkHealth() {
        const data = await fetchJson('/api/health', HEALTH_TIMEOUT_MS);
        return data && data.ok === true;
    }

    function applyStatus(status) {
        const store = window.BottleNet;
        const rem = Math.max(0, Number(status.wifiRemainingMs) || 0);
        const result = String(status.lastResult || 'Waiting');
        const bottle = status.lastBottle != null ? String(status.lastBottle) : 'None';
        const weight = Number(status.lastWeightG) || 0;
        const key = `${bottle}|${weight}|${result}`;
        const isDecision = result === 'ACCEPTED' || result === 'REJECTED';

        store.update(s => {
            s.mode = 'live';
            s.deviceOnline = status.online !== false;
            s.stationId = status.stationId || s.stationId || 'BN-001';
            s.stationName = status.stationName || s.stationName || 'Campus station 01';
            s.trashLevel = status.trashLevel || s.trashLevel;
            s.trashDistanceCm = Number(status.trashDistanceCm) || 0;
            s.lastBottle = bottle;
            s.lastWeightG = weight;
            s.lastResult = result;
            s.bin = binFromTrash(status.trashLevel);
            s.expiresAt = Date.now() + rem;
            if (rem > 0) s.sessionTotal = Math.max(Number(s.sessionTotal) || 0, rem);

            if (status.online === false) s.station = 'offline';
            else if (String(status.trashLevel || '').toUpperCase() === 'FULL') s.station = 'full';
            else if (s.station === 'offline' || s.station === 'full') s.station = 'ready';

            if (status.rates) {
                if (status.rates.coke1l != null && s.sizes.large) s.sizes.large.minutes = Number(status.rates.coke1l) || s.sizes.large.minutes;
                if (status.rates.mismo != null && s.sizes.mismo) s.sizes.mismo.minutes = Number(status.rates.mismo) || s.sizes.mismo.minutes;
                if (status.rates.sakto != null && s.sizes.sakto) s.sizes.sakto.minutes = Number(status.rates.sakto) || s.sizes.sakto.minutes;
                s.rate = s.sizes.large ? s.sizes.large.minutes : s.rate;
            }

            if (isDecision && key !== lastSeenKey) {
                const sizeKey = sizeKeyFromBottle(bottle);
                const minutes = result === 'ACCEPTED' ? minutesForBottle(bottle, status.rates, s) : 0;
                const accepted = result === 'ACCEPTED';
                s.transactions.unshift({
                    id: `BN-${Date.now()}`,
                    time: Date.now(),
                    session: 'Station SoftAP',
                    weight,
                    accepted,
                    minutes,
                    size: accepted ? sizeKey : null
                });
                if (accepted) {
                    s.lastReward = minutes || Number(status.wifiMinutesAwarded) || s.lastReward;
                    s.sessionBottles = (Number(s.sessionBottles) || 0) + 1;
                    s.bottles = (Number(s.bottles) || 0) + 1;
                    if (Array.isArray(s.collections) && s.collections.length)
                        s.collections[s.collections.length - 1] = s.bottles;
                } else {
                    s.lastReward = 0;
                }
            } else if (!isDecision && Number(status.wifiMinutesAwarded) > 0) {
                /* keep lastReward from prior accept */
            }
        });

        if (isDecision) lastSeenKey = key;
    }

    async function pollStatus() {
        if (mode === 'demo') {
            setLive(false);
            return null;
        }
        try {
            if (mode === 'auto' && !live) {
                const ok = await checkHealth();
                if (!ok) {
                    setLive(false);
                    return null;
                }
            } else if (mode === 'live' && !live) {
                await checkHealth();
            }
            const status = await fetchJson('/api/status', STATUS_TIMEOUT_MS);
            setLive(true);
            applyStatus(status);
            return status;
        } catch {
            if (mode === 'live') {
                /* stay marked live-attempt but fall UI to demo data */
            }
            setLive(false);
            return null;
        }
    }

    function schedule() {
        clearTimeout(pollTimer);
        pollTimer = setTimeout(async () => {
            await pollStatus();
            schedule();
        }, POLL_MS);
    }

    function start() {
        if (started) return;
        started = true;
        updateBadges();
        window.addEventListener('bottlenet-mode', updateBadges);
        pollStatus().finally(schedule);
    }

    function setMode(next) {
        const m = String(next || 'auto').toLowerCase();
        if (!['auto', 'live', 'demo'].includes(m)) return mode;
        mode = m;
        if (m === 'demo') setLive(false);
        pollStatus();
        return mode;
    }

    function ensureBadge(selector, attrs) {
        const host = typeof selector === 'string' ? document.querySelector(selector) : selector;
        if (!host) return null;
        let badge = host.querySelector('[data-bn-mode-badge]');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'badge bn-mode-badge';
            badge.dataset.bnModeBadge = '1';
            if (attrs && attrs.prepend) host.prepend(badge);
            else host.appendChild(badge);
        }
        updateBadges();
        return badge;
    }

    window.BottleNetDevice = {
        baseUrl,
        get mode() { return mode; },
        set mode(v) { return setMode(v); },
        pollStatus,
        isLive,
        start,
        ensureBadge,
        updateBadges
    };

    /* Bridge for portal.js / admin.js which call store.isLive() */
    if (window.BottleNet) {
        window.BottleNet.isLive = isLive;
        window.BottleNet.getMode = () => (live ? 'live' : 'demo');
        window.BottleNet.startDevicePoll = start;
    }

    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', start);
    else
        start();
})();
