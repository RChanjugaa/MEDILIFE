const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
        actorRole: { type: String, index: true },
        action: { type: String, required: true, index: true },
        entity: { type: String, required: true, index: true },
        entityId: { type: mongoose.Schema.Types.ObjectId, index: true },
        before: { type: mongoose.Schema.Types.Mixed },
        after: { type: mongoose.Schema.Types.Mixed },
        ip: String,
        userAgent: String,
        createdAt: { type: Date, default: Date.now, index: true }
    },
    { versionKey: false }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
