// MF Portfolio API. The app is wired here; the work lives in:
//   routes/    auth (sign-in, demo, session check), portfolio (one route per page), recommendations
//   services/  the maths for each asset: funds, navHistory, fds, metals, epf, timeline, calendar, overview,
//              and the AI recommendations
//   lib/       config loading, dates, XIRR, responses, and the outside data sources (lib/sources: MFapi
//              NAVs, Yahoo's Nifty 50 level, bullions.co.in metal prices)
const path = require('path');
// first, so every module below sees the settings when it loads
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const { demoRewrite, authRoutes, requireSession } = require('./routes/auth');
const portfolioRoutes = require('./routes/portfolio');
const recommendationRoutes = require('./routes/recommendations');

const app = express();

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:5173',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));

// Order matters: /api/demo/* is rewritten to /api/* (marked as the demo) before anything else, sign-in and
// sign-out come before the session check, and everything after it needs a session.
app.use(demoRewrite);
app.use(authRoutes);
app.use('/api', requireSession);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api', portfolioRoutes);

const PORT = process.env.PORT ?? 3002;
app.listen(PORT, () => {
    console.log(`🚀 MF Portfolio API running on port ${PORT}`);
    console.log(`   Endpoints: /api/health  /api/portfolio/overview  /api/portfolio/complete  /api/recommendations`);
});

module.exports = app;
