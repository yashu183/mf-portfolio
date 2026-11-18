// Adding entries from the app instead of editing portfolioConfig.json by hand on the Pi.
//   GET  /api/entries/options      what the Add sheet's pickers offer (funds and their running SIPs, metal sets, FDs)
//   POST /api/entries/lumpsum      { fundId, amount, date }
//   POST /api/entries/sip          { fundId, amount, startDate }
//   POST /api/entries/sip-stop     { fundId, sipIndex, stopDate }
//   POST /api/entries/metal        { metal: 'gold' | 'silver', label, set, purchaseDate, quantity, purchasePrice }
//   POST /api/entries/fd           { name, bank, label, principal, startDate, termDays, rate, interestBank }
//   POST /api/entries/fd-renewal   { fdId, termDays, rate, interestBank }
// They sit behind the session check like every other /api route. The demo can read the options (so the
// sheet can be shown) but never writes.
const express = require('express');
const { ok, fail, handle } = require('../lib/http');
const { loadConfig } = require('../lib/config');
const { updateConfig } = require('../lib/configStore');
const { parseLocalDate, isoDay } = require('../lib/dates');

const router = express.Router();

// ─── Checking what came in ────────────────────────────────────────────────────
class EntryError extends Error {}
const bad = (message) => { throw new EntryError(message); };

const todayIso = () => isoDay(new Date());
function date(value, field, { notFuture = false } = {}) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) bad(`${field} must be a date.`);
    const d = parseLocalDate(value);
    if (Number.isNaN(d.getTime()) || isoDay(d) !== value) bad(`${field} is not a real date.`);
    if (value < '1990-01-01') bad(`${field} is too far back.`);
    if (notFuture && value > todayIso()) bad(`${field} can't be in the future.`);
    return value;
}
function amount(value, field, { max = 1e9, integer = false } = {}) {
    const n = typeof value === 'string' ? Number(value) : value;
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) bad(`${field} must be more than zero.`);
    if (n > max) bad(`${field} looks too large.`);
    if (integer && !Number.isInteger(n)) bad(`${field} must be a whole number.`);
    return Math.round(n * 1000) / 1000;
}
function text(value, field, { max = 60 } = {}) {
    if (typeof value !== 'string' || !value.trim()) bad(`${field} is required.`);
    const t = value.trim().replace(/\s+/g, ' ');
    if (t.length > max) bad(`${field} is too long.`);
    return t;
}
const nextId = (list) => list.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
const addDays = (iso, days) => { const d = parseLocalDate(iso); d.setDate(d.getDate() + days); return isoDay(d); };

function findFund(config, fundId) {
    const fund = (config.funds ?? []).find((f) => f.id === Number(fundId));
    return fund ?? bad('That fund is not in the portfolio.');
}
const isRunning = (sip, today) => !sip.stopDate || sip.stopDate >= today;

// The money an FD holds when its last cycle matures: the principal plus every cycle's interest
const fdMaturity = (fd) => (fd.cycles ?? []).reduce((sum, c) => sum + (c.interestBank || 0), fd.principal);
const fdLastMaturity = (fd) => fd.cycles?.length ? fd.cycles[fd.cycles.length - 1].maturityDate : fd.startDate;

// A save: run the change, reply with what was added. A checking error is the user's to fix (400).
const save = (label, change) => handle(label, 'Could not save the entry', async (req, res) => {
    if (req.demo) return fail(res, 403, 'The demo is read-only. Saving works in your own portfolio.');
    try {
        const added = await updateConfig((config) => change(config, req.body ?? {}));
        return ok(res, added);
    } catch (err) {
        if (err instanceof EntryError) return fail(res, 400, err.message);
        throw err;
    }
});

// ─── What the pickers offer ───────────────────────────────────────────────────
router.get('/options', handle('Entry options error', 'Failed to load the entry options', async (req, res) => {
    const config = await loadConfig(req);
    const today = todayIso();
    const metal = (list = []) => ({
        sets: [...new Set(list.map((h) => h.set).filter(Boolean))],
        labels: list.map((h) => h.label),
        last: list.length ? list.reduce((a, b) => ((b.purchaseDate ?? '') >= (a.purchaseDate ?? '') ? b : a)) : null,
    });
    ok(res, {
        today,
        funds: (config.funds ?? []).map((f) => ({
            id: f.id,
            name: f.shortName || f.name,
            category: f.category,
            sips: (f.sips ?? []).map((s, index) => ({ index, amount: s.amount, startDate: s.startDate, stopDate: s.stopDate ?? null }))
                .filter((s) => isRunning(s, today)),
        })),
        gold: metal(config.gold),
        silver: metal(config.silver),
        fds: (config.fixedDeposits ?? []).map((fd) => ({
            id: fd.id,
            name: fd.name,
            bank: fd.bank,
            label: fd.label,
            principal: fd.principal,
            maturityAmount: fdMaturity(fd),
            maturityDate: fdLastMaturity(fd),
            lastTermDays: fd.cycles?.at(-1)?.termDays ?? null,
            lastRate: fd.cycles?.at(-1)?.rate ?? null,
        })),
        fdNames: [...new Set((config.fixedDeposits ?? []).map((fd) => fd.name).filter(Boolean))],
        fdBanks: [...new Set((config.fixedDeposits ?? []).map((fd) => fd.bank).filter(Boolean))],
    });
}));

// ─── Mutual funds ─────────────────────────────────────────────────────────────
router.post('/lumpsum', save('Add lumpsum error', (config, body) => {
    const fund = findFund(config, body.fundId);
    const entry = { amount: amount(body.amount, 'Amount'), date: date(body.date, 'Date', { notFuture: true }) };
    fund.lumpsums = [...(fund.lumpsums ?? []), entry].sort((a, b) => a.date.localeCompare(b.date));
    return { kind: 'lumpsum', fund: fund.shortName || fund.name, ...entry };
}));

router.post('/sip', save('Add SIP error', (config, body) => {
    const fund = findFund(config, body.fundId);
    const entry = { amount: amount(body.amount, 'Monthly amount'), startDate: date(body.startDate, 'Start date'), stopDate: null };
    fund.sips = [...(fund.sips ?? []), entry];
    return { kind: 'sip', fund: fund.shortName || fund.name, ...entry };
}));

router.post('/sip-stop', save('Stop SIP error', (config, body) => {
    const fund = findFund(config, body.fundId);
    const sip = Number.isInteger(body.sipIndex) ? fund.sips?.[body.sipIndex] : null;
    if (!sip) bad('That SIP is not in this fund.');
    if (!isRunning(sip, todayIso())) bad('That SIP has already stopped.');
    const stopDate = date(body.stopDate, 'Stop date');
    if (stopDate < sip.startDate) bad('A SIP can\'t stop before it started.');
    sip.stopDate = stopDate;
    return { kind: 'sip-stop', fund: fund.shortName || fund.name, amount: sip.amount, startDate: sip.startDate, stopDate };
}));

// ─── Gold and silver ──────────────────────────────────────────────────────────
router.post('/metal', save('Add metal error', (config, body) => {
    const metal = body.metal === 'gold' || body.metal === 'silver' ? body.metal : bad('Pick gold or silver.');
    const list = config[metal] ?? (config[metal] = []);
    const label = text(body.label, 'Label');
    if (list.some((h) => h.label?.toLowerCase() === label.toLowerCase())) bad(`There is already a ${metal} entry called "${label}".`);
    const entry = {
        id: nextId(list),
        label,
        set: text(body.set, 'Set', { max: 40 }),
        purchaseDate: date(body.purchaseDate, 'Purchase date', { notFuture: true }),
        quantity: amount(body.quantity, 'Grams', { max: 1e6 }),
        purchasePrice: amount(body.purchasePrice, 'Price per gram', { max: 1e6 }),
    };
    list.push(entry);
    return { kind: metal, ...entry };
}));

// ─── Fixed deposits ───────────────────────────────────────────────────────────
function cycle(body, from) {
    const termDays = amount(body.termDays, 'Term', { max: 3650 * 2, integer: true });
    return {
        termDays,
        rate: amount(body.rate, 'Rate', { max: 30 }),
        maturityDate: addDays(from, termDays),
        interestBank: amount(body.interestBank, 'Interest', { max: 1e9 }),
    };
}

router.post('/fd', save('Add FD error', (config, body) => {
    const list = config.fixedDeposits ?? (config.fixedDeposits = []);
    const startDate = date(body.startDate, 'Start date', { notFuture: true });
    const entry = {
        id: nextId(list),
        name: text(body.name, 'Name'),
        bank: text(body.bank, 'Bank'),
        label: text(body.label, 'Label'),
        principal: amount(body.principal, 'Principal'),
        startDate,
        cycles: [cycle(body, startDate)],
    };
    list.push(entry);
    return { kind: 'fd', ...entry };
}));

router.post('/fd-renewal', save('Renew FD error', (config, body) => {
    const fd = (config.fixedDeposits ?? []).find((f) => f.id === Number(body.fdId)) ?? bad('That FD is not in the portfolio.');
    const next = cycle(body, fdLastMaturity(fd));
    fd.cycles = [...(fd.cycles ?? []), next];
    return { kind: 'fd-renewal', label: fd.label, bank: fd.bank, renewedOn: fdLastMaturity({ ...fd, cycles: fd.cycles.slice(0, -1) }), amount: fdMaturity({ ...fd, cycles: fd.cycles.slice(0, -1) }), ...next };
}));

module.exports = router;
