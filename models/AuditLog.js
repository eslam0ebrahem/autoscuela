import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        'user_create',
        'user_update',
        'user_delete',
        'user_role_change',
        'user_premium_grant',
        'user_premium_revoke',
        'question_create',
        'question_update',
        'question_delete',
        'question_import',
        'subscription_webhook',
        'admin_login',
        'admin_action',
      ],
      required: true,
      index: true,
    },
    resourceType: { type: String, enum: ['user', 'question', 'subscription'], required: true },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      details: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
)

// TTL index - keep audit logs for 90 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 })

export default mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema)
