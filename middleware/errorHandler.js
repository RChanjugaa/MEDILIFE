const notFound = (req, res) => {
    res.status(404).json({ message: `Not found: ${req.method} ${req.originalUrl}` });
};

const errorHandler = (err, req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) {
        console.error('[error]', err);
    }

    if (err.code === 11000) {
        return res.status(409).json({
            message: 'Duplicate value violates a unique constraint.',
            fields: Object.keys(err.keyValue || {})
        });
    }
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            message: 'Validation failed.',
            errors: Object.fromEntries(
                Object.entries(err.errors || {}).map(([k, v]) => [k, v.message])
            )
        });
    }
    if (err.name === 'CastError') {
        return res.status(400).json({ message: `Invalid ${err.path}: ${err.value}` });
    }

    res.status(status).json({
        message: err.publicMessage || (status >= 500 ? 'Server error.' : err.message)
    });
};

module.exports = { notFound, errorHandler };
