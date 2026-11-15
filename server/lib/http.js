// Standardised responses, and a wrapper that turns a thrown error into the usual 500 reply
const ok = (res, data, extra = {}) => res.json({ status: 'success', data, ...extra });
const fail = (res, statusCode, message) => res.status(statusCode).json({ status: 'error', message });

// `label` is what the log says went wrong; `message` is what the client sees outside development
const handle = (label, message, fn) => async (req, res) => {
    try {
        await fn(req, res);
    } catch (err) {
        console.error(`${label}:`, err);
        fail(res, 500, process.env.NODE_ENV === 'development' ? err.message : message);
    }
};

module.exports = { ok, fail, handle };
