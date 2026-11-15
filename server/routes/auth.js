// Access-code sign-in, the public demo, and the session check every other /api route sits behind
const express = require('express');
const rateLimit = require('express-rate-limit');
const { randomBytes, timingSafeEqual } = require('node:crypto');

// ─── Public demo ──────────────────────────────────────────────────────────────
// /api/demo/<route> runs the same <route> against demoConfig.json (a made-up portfolio committed with
// the code) with no access code, so the app can be shown to anyone. Live NAVs and metal prices, real
// maths; the AI recommendation is a saved sample so visitors never start a Bedrock call.
const demoLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: parseInt(process.env.DEMO_RATE_LIMIT_MAX || '300', 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'The demo is busy. Please try again in a few minutes.' },
});
function demoRewrite(req, res, next) {
    if (req.url !== '/api/demo' && !req.url.startsWith('/api/demo/')) return next();
    if (req.url.startsWith('/api/demo/auth/') && req.url !== '/api/demo/auth/session') {
        return res.status(404).json({ status: 'error', message: 'Not available in the demo.' });
    }
    req.demo = true;
    req.url = `/api${req.url.slice('/api/demo'.length)}`;
    return demoLimiter(req, res, next);
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
const accessCode = process.env.AUTH_ACCESS_CODE;
const sessions = new Map();
const sessionDuration = 60 * 60 * 1000;
const authOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [
    'http://localhost:3000',
    'http://localhost:5173',
];
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many attempts. Please try again in 15 minutes.' },
});

const readSessionToken = (req) => (req.headers.cookie || '').split(';')
    .map(cookie => cookie.trim()).find(cookie => cookie.startsWith('portfolio_session='))
    ?.slice('portfolio_session='.length);

// Sign-in and sign-out; mounted before the session check
const authRoutes = express.Router();

authRoutes.post('/api/auth/verify', authLimiter, (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.headers.origin && !authOrigins.includes(req.headers.origin)) {
        return res.status(403).json({ status: 'error', message: 'Request origin not allowed.' });
    }
    if (!/^\d{6}$/.test(accessCode || '')) {
        return res.status(503).json({ status: 'error', message: 'Access code is not configured. Contact the administrator.' });
    }
    const code = req.body?.code;
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ status: 'error', message: 'Enter a six-digit access code.' });
    }
    if (!timingSafeEqual(Buffer.from(code), Buffer.from(accessCode))) {
        return res.status(401).json({ status: 'error', message: 'Incorrect access code. Please try again.' });
    }
    const now = Date.now();
    for (const [token, expiry] of sessions) {
        if (expiry <= now) sessions.delete(token);
    }
    const token = randomBytes(32).toString('hex');
    sessions.set(token, now + sessionDuration);
    res.cookie('portfolio_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: sessionDuration,
        path: '/api',
    });
    return res.json({ status: 'success' });
});

// Lock: ends the session on the server at once (not when the hour runs out) and clears the cookie.
// It sits before the session check so an already-expired session can still sign out cleanly.
authRoutes.post('/api/auth/logout', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.headers.origin && !authOrigins.includes(req.headers.origin)) {
        return res.status(403).json({ status: 'error', message: 'Request origin not allowed.' });
    }
    const token = readSessionToken(req);
    if (token) sessions.delete(token);
    res.clearCookie('portfolio_session', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api',
    });
    return res.json({ status: 'success' });
});

// Everything under /api after this needs a live session (or is the demo, or the health check)
function requireSession(req, res, next) {
    if (req.path === '/health' || req.demo) return next();
    res.set('Cache-Control', 'no-store');
    const token = readSessionToken(req);
    const expiry = sessions.get(token);
    if (!expiry || expiry <= Date.now()) {
        if (token) sessions.delete(token);
        return res.status(401).json({ status: 'error', message: 'Please enter your access code to continue.' });
    }
    return next();
}

module.exports = { demoRewrite, authRoutes, requireSession };
