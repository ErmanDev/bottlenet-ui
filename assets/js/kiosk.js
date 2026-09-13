/* Kiosk home screen: informational sheets for the menu rows. */
(() => {
    const $ = id => document.getElementById(id), store = window.BottleNet;
    const sheets = { rates: $('sheet-rates'), help: $('sheet-help'), report: $('sheet-report') };
    let lastFocus = null;
    function fillRates() {
        const sizes = store.get().sizes;
        Object.entries(sizes).forEach(([key, size]) => {
            $('rate-' + key).textContent = size.minutes + ' minutes';
            $('weight-' + key).textContent = size.minWeight + '–' + size.maxWeight + ' g';
        });
    }
    function open(name) {
        const sheet = sheets[name];
        if (!sheet) return;
        if (name === 'rates') fillRates();
        if (name === 'report') resetReport();
        lastFocus = document.activeElement;
        sheet.hidden = false;
        (name === 'report' ? $('report-type-button') : sheet.querySelector('.sheet-close')).focus();
    }
    /* Report form: demo only, the report is acknowledged locally. */
    let reportTimer, reportType = '';
    const options = [...document.querySelectorAll('#report-type-list .picker-option')];
    function clearReportError() {
        $('report-type-button').classList.remove('invalid');
        $('report-status').textContent = '';
        $('report-status').classList.remove('error');
    }
    function setType(value) {
        reportType = value;
        const label = $('report-type-value');
        label.textContent = value || 'Select a problem';
        label.classList.toggle('is-placeholder', !value);
        options.forEach(o => o.setAttribute('aria-selected', String(o.dataset.value === value)));
        if (value) clearReportError();
    }
    function openPicker(show) {
        const list = $('report-type-list'), button = $('report-type-button');
        list.hidden = !show;
        button.setAttribute('aria-expanded', String(show));
        button.classList.toggle('open', show);
        if (show) (options.find(o => o.dataset.value === reportType) || options[0]).focus();
    }
    const pickerOpen = () => !$('report-type-list').hidden;
    options.forEach(option => {
        option.tabIndex = -1;
        option.addEventListener('click', () => { setType(option.dataset.value); openPicker(false); $('report-type-button').focus(); });
        option.addEventListener('keydown', e => {
            const i = options.indexOf(option);
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); option.click(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); options[(i + 1) % options.length].focus(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); options[(i - 1 + options.length) % options.length].focus(); }
            else if (e.key === 'Escape') { e.stopPropagation(); openPicker(false); $('report-type-button').focus(); }
            else if (e.key === 'Tab') openPicker(false);
        });
    });
    $('report-type-button').addEventListener('click', () => openPicker(!pickerOpen()));
    $('report-type-button').addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openPicker(true); }
        else if (e.key === 'Escape' && pickerOpen()) { e.stopPropagation(); openPicker(false); }
    });
    document.addEventListener('click', e => { if (pickerOpen() && !$('report-type-picker').contains(e.target)) openPicker(false); });
    function resetReport() {
        clearTimeout(reportTimer);
        $('report-form').reset();
        openPicker(false);
        setType('');
        clearReportError();
        $('report-form').querySelector('.report-submit').disabled = false;
    }
    function stationTone() {
        const station = store.get().station;
        const label = { ready: 'SYSTEM READY', busy: 'STATION BUSY', full: 'BIN FULL', maintenance: 'MAINTENANCE', offline: 'SYSTEM OFFLINE' }[station] || 'SYSTEM READY';
        const tone = station === 'ready' ? 'ok' : station === 'offline' || station === 'maintenance' ? 'down' : 'warn';
        const ready = $('report-ready');
        ready.lastChild.textContent = label;
        ready.dataset.tone = tone;
    }
    $('report-form').addEventListener('submit', e => {
        e.preventDefault();
        const status = $('report-status');
        if (!reportType) {
            $('report-type-button').classList.add('invalid');
            status.textContent = 'Choose a problem type first.';
            status.classList.add('error');
            $('report-type-button').focus();
            return;
        }
        status.classList.remove('error');
        status.textContent = 'Report sent. Station staff have been notified.';
        e.target.querySelector('.report-submit').disabled = true;
        reportTimer = setTimeout(closeAll, 1800);
    });

    function closeAll() {
        clearTimeout(reportTimer);
        openPicker(false);
        Object.values(sheets).forEach(sheet => { sheet.hidden = true; });
        if (lastFocus) lastFocus.focus();
    }
    document.querySelectorAll('[data-sheet]').forEach(el => el.addEventListener('click', () => open(el.dataset.sheet)));
    document.querySelectorAll('.sheet-close').forEach(el => el.addEventListener('click', closeAll));
    Object.values(sheets).forEach(sheet => sheet.addEventListener('click', e => { if (e.target === sheet) closeAll(); }));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
    window.addEventListener('bottlenet-change', () => { if (!sheets.rates.hidden) fillRates(); stationTone(); });
    stationTone();
})();
