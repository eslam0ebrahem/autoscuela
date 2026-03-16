import AuditLog from '@/models/AuditLog'
import logger from './logger'

/**
 * Log an admin action to the audit trail
 * @param {Object} params
 * @param {string} params.userId - ID of the admin performing the action
 * @param {string} params.action - Type of action (e.g., 'user_update', 'question_create')
 * @param {string} params.resourceType - Type of resource affected ('user', 'question', 'subscription')
 * @param {string} params.resourceId - ID of the affected resource
 * @param {Object} params.changes - Object describing what changed
 * @param {Object} params.metadata - Additional metadata (ipAddress, userAgent, details)
 * @returns {Promise<void>}
 */
export async function logAudit({
  userId,
  action,
  resourceType,
  resourceId,
  changes = {},
  metadata = {},
}) {
  try {
    await AuditLog.create({
      userId,
      action,
      resourceType,
      resourceId,
      changes,
      metadata,
    })

    logger.info(
      {
        userId,
        action,
        resourceType,
        resourceId,
        metadata,
      },
      `Audit: ${action} on ${resourceType}/${resourceId}`
    )
  } catch (error) {
    logger.error(
      { userId, action, resourceType, resourceId, error: error.message },
      'Failed to log audit action'
    )
    // Don't throw - audit failure shouldn't break the main operation
  }
}

/**
 * Helper to extract changes between old and new objects
 * @param {Object} oldData
 * @param {Object} newData
 * @returns {Object} Object containing only changed fields
 */
export function extractChanges(oldData, newData) {
  const changes = {}

  for (const key in newData) {
    const oldValue = oldData?.[key]
    const newValue = newData[key]

    // Skip if unchanged
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
      continue
    }

    changes[key] = {
      from: oldValue,
      to: newValue,
    }
  }

  return changes
}
