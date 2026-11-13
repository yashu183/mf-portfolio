const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

test('PIN authentication protects portfolio APIs', async () => {
    const port = 23000 + Math.floor(Math.random() * 10000);
    const server = spawn(process.execPath, ['server.js'], {
        cwd: __dirname,
        env: { ...process.env, PORT: String(port), AUTH_ACCESS_CODE: '012345', NODE_ENV: 'test' },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
            server.stdout.on('data', () => { clearTimeout(timeout); resolve(); });
            server.once('exit', () => { clearTimeout(timeout); reject(new Error('Server exited before startup')); });
        });
        const base = `http://localhost:${port}`;
        for (const route of ['/api/portfolio/fds', '/api/portfolio/overview', '/api/recommendations']) {
            const response = await fetch(`${base}${route}`, {
                method: route.includes('recommendations') ? 'POST' : 'GET',
            });
            assert.equal(response.status, 401, `${route} must require authentication`);
        }
        const verify = (code, origin = 'http://localhost:5173') => fetch(`${base}/api/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: origin },
            body: JSON.stringify({ code }),
        });
        assert.equal((await verify('999999')).status, 401);
        assert.equal((await verify(12345)).status, 400);
        assert.equal((await verify('012345', 'https://untrusted.example')).status, 403);
        const accepted = await verify('012345');
        assert.equal(accepted.status, 200);
        const cookie = accepted.headers.get('set-cookie');
        assert.match(cookie, /HttpOnly/i);
        assert.match(cookie, /SameSite=Strict/i);
        assert.ok(!cookie.includes('012345'));
        const payload = await accepted.json();
        assert.ok(!JSON.stringify(payload).includes('012345'));
        const authenticated = await fetch(`${base}/api/portfolio/fds`, {
            headers: { Cookie: cookie.split(';')[0] },
        });
        assert.equal(authenticated.status, 200);
        const forged = await fetch(`${base}/api/portfolio/fds`, {
            headers: { Cookie: 'portfolio_session=forged' },
        });
        assert.equal(forged.status, 401);
        const logout = (origin = 'http://localhost:5173') => fetch(`${base}/api/auth/logout`, {
            method: 'POST',
            headers: { Cookie: cookie.split(';')[0], Origin: origin },
        });
        assert.equal((await logout('https://untrusted.example')).status, 403);
        const loggedOut = await logout();
        assert.equal(loggedOut.status, 200);
        assert.match(loggedOut.headers.get('set-cookie'), /portfolio_session=;/);
        const afterLogout = await fetch(`${base}/api/portfolio/fds`, {
            headers: { Cookie: cookie.split(';')[0] },
        });
        assert.equal(afterLogout.status, 401, 'a locked session must not reach the API');
        for (let attempt = 0; attempt < 10; attempt += 1) await verify('999999');
        assert.equal((await verify('012345')).status, 429);
    } finally {
        server.kill();
    }
});

test('the demo is open, serves only the demo portfolio, and never opens the real one', async () => {
    const port = 23000 + Math.floor(Math.random() * 10000);
    const server = spawn(process.execPath, ['server.js'], {
        cwd: __dirname,
        env: { ...process.env, PORT: String(port), AUTH_ACCESS_CODE: '012345', NODE_ENV: 'test' },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    try {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
            server.stdout.on('data', () => { clearTimeout(timeout); resolve(); });
            server.once('exit', () => { clearTimeout(timeout); reject(new Error('Server exited before startup')); });
        });
        const base = `http://localhost:${port}`;
        const demoConfig = require('./demoConfig.json');

        // open without a session, and it is the demo's data
        const fds = await fetch(`${base}/api/demo/portfolio/fds`);
        assert.equal(fds.status, 200);
        const { data } = await fds.json();
        assert.deepEqual(data.fixedDeposits.map((d) => d.id), demoConfig.fixedDeposits.map((d) => d.id));
        assert.deepEqual(data.fixedDeposits.map((d) => d.bank), demoConfig.fixedDeposits.map((d) => d.bank));

        // the AI advice is the saved sample, never a Bedrock call
        const recs = await fetch(`${base}/api/demo/recommendations`, { method: 'POST' });
        assert.equal(recs.status, 200);
        assert.deepEqual((await recs.json()).data, demoConfig.sampleRecommendations);

        // the login routes don't exist under the demo, so it can't start or end a real session
        for (const route of ['/api/demo/auth/verify', '/api/demo/auth/logout']) {
            assert.equal((await fetch(`${base}${route}`, { method: 'POST' })).status, 404, `${route} must not exist`);
        }

        // the real routes still need the code, and a look-alike prefix doesn't count as the demo
        for (const route of ['/api/portfolio/fds', '/api/demoportfolio/fds']) {
            assert.equal((await fetch(`${base}${route}`)).status, 401, `${route} must require authentication`);
        }
    } finally {
        server.kill();
    }
});
