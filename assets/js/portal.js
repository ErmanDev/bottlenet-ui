(() => {
    const $ = id => document.getElementById(id), store = window.BottleNet;
    const owner = `portal-${Math.random().toString(36).slice(2)}`;
    let depositing = false, processing = false, message = '', messageUntil = 0, pendingDeposit;
    const statusLabels = { ready: 'Machine Ready', busy: 'Station Busy', full: 'Bin Full', maintenance: 'Under Maintenance', offline: 'Machine Offline' };
    const labels = { ready: 'Station ready for your next bottle', busy: 'Another deposit is in progress. Please wait.', full: 'Bin full. Deposits are temporarily unavailable.', maintenance: 'Station under maintenance. Please check back soon.', offline: 'Station offline. Please check back soon.' };
    function live() { return typeof store.isLive === 'function' ? store.isLive() : (window.BottleNetDevice && typeof window.BottleNetDevice.isLive === 'function' ? window.BottleNetDevice.isLive() : store.get().mode === 'live'); }
    function syncModeUi() {
        const on = live();
        const badge = $('mode-badge');
        if (badge) {
            badge.textContent = on ? 'Live' : 'Demo';
            badge.className = `mode-badge ${on ? 'live' : 'demo'}`;
            badge.title = on ? 'Connected to SoftAP device' : 'Using sample demo data';
        }
        const note = $('preview-live-note');
        if (note)
            note.hidden = !on;
        const summary = $('preview-summary');
        if (summary)
            summary.textContent = on ? 'Preview controls (Demo only)' : 'Preview controls';
        const panel = document.querySelector('.demo-panel');
        if (panel)
            panel.classList.toggle('is-live', on);
    }
    function render() {
        const d = store.get(), active = d.expiresAt > Date.now(), locked = d.depositUntil > Date.now() && d.depositOwner !== owner;
        const on = live();
        syncModeUi();
        if (depositing && (d.depositUntil <= Date.now() || d.station !== 'ready')) {
            depositing = false;
            processing = false;
        }
        const remaining = Math.max(0, d.expiresAt - Date.now()), total = Math.max(1, d.sessionTotal || remaining);
        $('timer').textContent = store.time(remaining);
        const percent = Math.max(0, Math.min(100, remaining / total * 100));
        $('timer-fill').style.width = percent + '%';
        $('timer-fill').parentElement.setAttribute('aria-valuenow', Math.round(percent));
        $('timer-fill').classList.toggle('low', active && remaining <= 60000);
        $('connection-label').textContent = active ? 'Connected' : 'Time expired';
        $('connection-badge').className = `conn-pill ${active ? 'on' : 'off'}`;
        $('session-bottles').textContent = d.sessionBottles;
        $('last-reward').textContent = `+${d.lastReward} min`;
        $('deposit-button').hidden = depositing;
        $('deposit-controls').hidden = !depositing;
        $('deposit-button').disabled = d.station !== 'ready' || locked;
        $('deposit-label').textContent = locked ? 'STATION BUSY' : active ? 'ADD MORE TIME' : 'INSERT BOTTLE';
        $('home-view').hidden = depositing;
        $('deposit-view').hidden = !depositing;
        $('session-banner').hidden = !active;
        $('status-text').textContent = locked ? 'Station Busy' : statusLabels[d.station];
        $('status-pill').dataset.tone = locked || d.station === 'busy' || d.station === 'full' ? 'warn' : d.station === 'ready' ? 'ok' : 'down';
        $('preview-state').disabled = processing || on;
        $('reset-demo').disabled = processing || on;
        let feedback = messageUntil > Date.now() ? message : depositing ? 'Deposit window open. Insert your bottle.' : locked ? labels.busy : labels[d.station];
        if (on && !depositing && messageUntil <= Date.now()) {
            const bottle = d.lastBottle && d.lastBottle !== 'None' ? d.lastBottle : '—';
            const weight = d.lastWeightG != null ? `${d.lastWeightG} g` : '—';
            const result = d.lastResult || 'Waiting';
            feedback = `${result} · Last bottle ${bottle} · ${weight}`;
        }
        $('deposit-feedback').textContent = feedback;
        $('deposit-feedback').classList.toggle('error', feedback.startsWith('Bottle rejected') || (on && String(d.lastResultKind || '').includes('reject')));
        const liveMeta = $('live-meta');
        if (liveMeta) {
            liveMeta.hidden = !on;
            if (on) {
                const bottle = d.lastBottle && d.lastBottle !== 'None' ? d.lastBottle : 'None';
                liveMeta.textContent = `${d.stationName || 'Station'} · ${d.lastResult || 'Waiting'} · ${bottle} · ${d.lastWeightG || 0} g · bin ${d.bin}%${d.trashLevel ? ` · ${d.trashLevel}` : ''}`;
            }
        }
    }
    function notify(text) { message = text; messageUntil = Date.now() + 6000; render(); }
    $('deposit-button').addEventListener('click', () => { const d = store.get(); if (d.station !== 'ready' || d.depositUntil > Date.now() && d.depositOwner !== owner)
        return; depositing = true; messageUntil = 0; store.update(s => { s.depositOwner = owner; s.depositUntil = Date.now() + 60000; }); render(); });
    function deposit(accepted, sizeKey) {
        if (processing || !depositing || live())
            return;
        processing = true;
        notify('Checking bottle...');
        pendingDeposit = setTimeout(() => {
            const d = store.get();
            if (d.station !== 'ready' || d.depositOwner !== owner || d.depositUntil <= Date.now()) {
                processing = false;
                depositing = false;
                notify('Deposit interrupted. No time was awarded.');
                return;
            }
            const keys = Object.keys(d.sizes), key = sizeKey && d.sizes[sizeKey] ? sizeKey : keys[Math.floor(Math.random() * keys.length)], size = d.sizes[key];
            const weight = accepted ? Math.round((size.minWeight + size.maxWeight) * 5) / 10 : Math.max(0, d.minWeight - 2.7);
            const minutes = accepted ? size.minutes : 0;
            store.update(s => {
                s.transactions.unshift({ id: `BN-${Date.now()}`, time: Date.now(), session: 'Your device', weight, accepted, minutes, size: accepted ? key : null });
                if (accepted) {
                    s.bottles++;
                    s.sessionBottles++;
                    s.lastReward = minutes;
                    s.expiresAt = Math.max(Date.now(), s.expiresAt) + minutes * 60000;
                    s.sessionTotal = s.expiresAt - Date.now();
                    s.bin = Math.min(100, s.bin + 1);
                    s.collections[6] = s.bottles;
                    if (s.bin === 100)
                        s.station = 'full';
                }
                s.depositUntil = Date.now() + 60000;
            });
            processing = false;
            notify(accepted ? `${size.label} accepted. +${minutes} minutes added.` : 'Bottle rejected. Weight is outside the accepted range.');
        }, 900);
    }
    $('finish-deposit').onclick = () => { depositing = false; store.update(d => { d.depositUntil = 0; d.depositOwner = null; }); notify('All set. Enjoy your connection.'); };
    $('preview-state').onchange = e => {
        if (live()) {
            e.target.value = store.get().station;
            notify('Preview is demo-only while Live.');
            return;
        }
        const [state, sizeKey] = e.target.value.split(':');
        if (state === 'accepted' || state === 'rejected') {
            const d = store.get();
            if (!depositing && d.station === 'ready') $('deposit-button').click();
            if (depositing) deposit(state === 'accepted', sizeKey);
            else notify('Station unavailable. Choose Ready before previewing a bottle.');
            e.target.value = d.station;
            return;
        }
        clearTimeout(pendingDeposit);
        processing = false;
        depositing = false; messageUntil = 0; store.update(d => { d.depositUntil = 0; d.depositOwner = null; if (state === 'expired') {
        d.expiresAt = Date.now();
        d.sessionTotal = 0;
        d.station = 'ready';
    }
    else
        d.station = state; }); render(); };
    $('reset-demo').onclick = () => {
        if (live()) {
            notify('Reset demo is available in Demo mode only.');
            return;
        }
        depositing = false; messageUntil = 0; store.reset(); $('preview-state').value = 'ready'; render();
    };
    window.addEventListener('storage', render);
    window.addEventListener('bottlenet-change', render);
    window.addEventListener('bottlenet-mode', render);
    setInterval(render, 1000);
    render();
})();
