const AuditLog = require('../models/AuditLog');

const writeAudit = async ({ req, action, entity, entityId, before, after }) => {
    try {
        await AuditLog.create({
            actorId: req.user ? req.user._id : null,
            actorRole: req.user ? req.user.role : 'anonymous',
            action,
            entity,
            entityId,
            before,
            after,
            ip: req.ip,
            userAgent: req.get('user-agent')
        });
    } catch (err) {
        console.error('[audit] failed to write:', err.message);
    }
};

module.exports = { writeAudit };
