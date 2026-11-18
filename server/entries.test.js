// Adding entries from the app: runs the server against a temporary copy of the example config, so the
// real portfolioConfig.json is never touched.
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('entries are saved to the config, checked, backed up, and refused in the demo', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vesta-entries-'));
    const configPath = path.join(dir, 'portfolioConfig.json');
    fs.copyFileSync(path.join(__dirname, 'portfolioConfig-example.json'), configPath);
    const port = 23000 + Math.floor(Math.random() * 10000);
    const server = spawn(process.execPath, ['server.js'], {
        cwd: __dirname,
        env: { ...process.env, PORT: String(port), AUTH_ACCESS_CODE: '012345', NODE_ENV: 'test', PORTFOLIO_CONFIG: configPath },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
            server.stdout.on('data', () => { clearTimeout(timeout); resolve(); });
            server.once('exit', () => { clearTimeout(timeout); reject(new Error('Server exited before startup')); });
        });
        const base = `http://localhost:${port}`;
        const post = (route, body, cookie) => fetch(`${base}${route}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
            body: JSON.stringify(body),
        });
        const read = () => JSON.parse(fs.readFileSync(configPath, 'utf-8'));

        // no session, no writes; the demo never writes
        assert.equal((await post('/api/entries/lumpsum', { fundId: 1, amount: 100, date: '2024-01-01' })).status, 401);
        assert.equal((await post('/api/demo/entries/lumpsum', { fundId: 1, amount: 100, date: '2024-01-01' })).status, 403);
        assert.equal((await fetch(`${base}/api/demo/entries/options`)).status, 200);

        const login = await fetch(`${base}/api/auth/verify`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: '012345' }),
        });
        const cookie = login.headers.get('set-cookie').split(';')[0];

        // lumpsum, kept in date order
        let r = await post('/api/entries/lumpsum', { fundId: 1, amount: 5000, date: '2023-01-01' }, cookie);
        assert.equal(r.status, 200);
        assert.deepEqual(read().funds[0].lumpsums[0], { amount: 5000, date: '2023-01-01' });

        // bad input is refused and nothing is written
        const before = fs.readFileSync(configPath, 'utf-8');
        for (const [route, body] of [
            ['/api/entries/lumpsum', { fundId: 99, amount: 5000, date: '2023-01-01' }],
            ['/api/entries/lumpsum', { fundId: 1, amount: -5, date: '2023-01-01' }],
            ['/api/entries/lumpsum', { fundId: 1, amount: 5, date: '2023-02-30' }],
            ['/api/entries/lumpsum', { fundId: 1, amount: 5, date: '2999-01-01' }],
            ['/api/entries/metal', { metal: 'gold', label: 'SGB 2024-I', set: 'x', purchaseDate: '2024-01-01', quantity: 1, purchasePrice: 1 }],
            ['/api/entries/sip-stop', { fundId: 1, sipIndex: 7, stopDate: '2026-01-01' }],
        ]) {
            const res = await post(route, body, cookie);
            assert.equal(res.status, 400, `${route} ${JSON.stringify(body)}`);
            assert.ok((await res.json()).message);
        }
        assert.equal(fs.readFileSync(configPath, 'utf-8'), before);

        // SIP, then stop it
        assert.equal((await post('/api/entries/sip', { fundId: 1, amount: 1500, startDate: '2026-01-05' }, cookie)).status, 200);
        const sips = read().funds[0].sips;
        assert.deepEqual(sips.at(-1), { amount: 1500, startDate: '2026-01-05', stopDate: null });
        assert.equal((await post('/api/entries/sip-stop', { fundId: 1, sipIndex: sips.length - 1, stopDate: '2025-12-01' }, cookie)).status, 400);
        assert.equal((await post('/api/entries/sip-stop', { fundId: 1, sipIndex: sips.length - 1, stopDate: '2026-03-06' }, cookie)).status, 200);
        assert.equal(read().funds[0].sips.at(-1).stopDate, '2026-03-06');

        // gold
        r = await post('/api/entries/metal', { metal: 'gold', label: 'Gold Bar-2', set: 'SGB 2024', purchaseDate: '2024-03-01', quantity: '10.5', purchasePrice: 6400 }, cookie);
        assert.equal(r.status, 200);
        assert.deepEqual(read().gold.at(-1), { id: 2, label: 'Gold Bar-2', set: 'SGB 2024', purchaseDate: '2024-03-01', quantity: 10.5, purchasePrice: 6400 });

        // a new FD, its maturity worked out from the term; then a renewal from that maturity
        r = await post('/api/entries/fd', { name: 'Me', bank: 'SBI', label: '1L - 400 d', principal: 100000, startDate: '2025-01-01', termDays: 400, rate: 7, interestBank: 7900 }, cookie);
        assert.equal(r.status, 200);
        const fd = read().fixedDeposits.at(-1);
        assert.equal(fd.id, 2);
        assert.deepEqual(fd.cycles, [{ termDays: 400, rate: 7, maturityDate: '2026-02-05', interestBank: 7900 }]);
        r = await post('/api/entries/fd-renewal', { fdId: 2, termDays: 365, rate: 6.5, interestBank: 7400 }, cookie);
        assert.equal(r.status, 200);
        assert.equal((await r.json()).data.amount, 107900);
        assert.deepEqual(read().fixedDeposits.at(-1).cycles[1], { termDays: 365, rate: 6.5, maturityDate: '2027-02-05', interestBank: 7400 });

        // the options reflect what was added; every save left a backup
        const options = (await (await fetch(`${base}/api/entries/options`, { headers: { Cookie: cookie } })).json()).data;
        assert.ok(options.gold.sets.includes('SGB 2024'));
        assert.equal(options.fds.at(-1).maturityDate, '2027-02-05');
        assert.equal(fs.readdirSync(path.join(dir, '.config-backups')).length, 6);
    } finally {
        server.kill();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
