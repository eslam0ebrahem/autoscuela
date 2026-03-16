/**
 * Error codes for standardized API responses
 * Used for i18n on frontend - error codes are language-agnostic
 */
export const ERROR_CODES = {
  // Auth errors
  INVALID_EMAIL: 'ERR_AUTH_001',
  INVALID_PASSWORD: 'ERR_AUTH_002',
  EMAIL_ALREADY_EXISTS: 'ERR_AUTH_003',
  USER_NOT_FOUND: 'ERR_AUTH_004',
  INVALID_CREDENTIALS: 'ERR_AUTH_005',
  INVALID_TOKEN: 'ERR_AUTH_006',
  TOKEN_EXPIRED: 'ERR_AUTH_007',
  EMAIL_NOT_VERIFIED: 'ERR_AUTH_008',
  WEAK_PASSWORD: 'ERR_AUTH_009',

  // Validation errors
  INVALID_INPUT: 'ERR_VALID_001',
  MISSING_REQUIRED_FIELD: 'ERR_VALID_002',
  INVALID_JSON: 'ERR_VALID_003',
  INVALID_ENUM_VALUE: 'ERR_VALID_004',

  // Exam errors
  EXAM_NOT_FOUND: 'ERR_EXAM_001',
  QUESTION_NOT_FOUND: 'ERR_EXAM_002',
  EXAM_ALREADY_SUBMITTED: 'ERR_EXAM_003',
  INVALID_ANSWER: 'ERR_EXAM_004',
  ANSWER_NOT_FOUND: 'ERR_EXAM_005',

  // Bookmark errors
  BOOKMARK_NOT_FOUND: 'ERR_BOOKMARK_001',
  BOOKMARK_ALREADY_EXISTS: 'ERR_BOOKMARK_002',

  // Gamification errors
  LEADERBOARD_UNAVAILABLE: 'ERR_GAME_001',
  STREAK_ERROR: 'ERR_GAME_002',

  // AI errors
  AI_SERVICE_UNAVAILABLE: 'ERR_AI_001',
  AI_RATE_LIMIT: 'ERR_AI_002',
  AI_INVALID_REQUEST: 'ERR_AI_003',

  // Permission errors
  UNAUTHORIZED: 'ERR_PERM_001',
  FORBIDDEN: 'ERR_PERM_002',
  ADMIN_ONLY: 'ERR_PERM_003',

  // Billing errors
  STRIPE_ERROR: 'ERR_BILL_001',
  PAYMENT_FAILED: 'ERR_BILL_002',
  SUBSCRIPTION_ERROR: 'ERR_BILL_003',

  // Rate limiting
  TOO_MANY_REQUESTS: 'ERR_RATE_001',

  // Server errors
  DATABASE_ERROR: 'ERR_SERVER_001',
  INTERNAL_ERROR: 'ERR_SERVER_002',
  SERVICE_UNAVAILABLE: 'ERR_SERVER_003',

  // CSRF/Security
  CSRF_FAILURE: 'ERR_SEC_001',
}

/**
 * Map error codes to default messages (for fallback)
 * Frontend should use i18n to translate these
 */
export const ERROR_MESSAGES = {
  ERR_AUTH_001: 'Invalid email format',
  ERR_AUTH_002: 'Password does not meet requirements',
  ERR_AUTH_003: 'Email already registered',
  ERR_AUTH_004: 'User not found',
  ERR_AUTH_005: 'Invalid email or password',
  ERR_AUTH_006: 'Invalid or corrupted token',
  ERR_AUTH_007: 'Token has expired',
  ERR_AUTH_008: 'Email not verified',
  ERR_AUTH_009: 'Password is too weak',

  ERR_VALID_001: 'Invalid input provided',
  ERR_VALID_002: 'Required field is missing',
  ERR_VALID_003: 'Invalid JSON format',
  ERR_VALID_004: 'Invalid enum value',

  ERR_EXAM_001: 'Exam not found',
  ERR_EXAM_002: 'Question not found',
  ERR_EXAM_003: 'Exam already submitted',
  ERR_EXAM_004: 'Invalid answer provided',
  ERR_EXAM_005: 'Answer not found',

  ERR_BOOKMARK_001: 'Bookmark not found',
  ERR_BOOKMARK_002: 'Question already bookmarked',

  ERR_GAME_001: 'Leaderboard temporarily unavailable',
  ERR_GAME_002: 'Error updating streak',

  ERR_AI_001: 'AI service temporarily unavailable',
  ERR_AI_002: 'AI rate limit exceeded',
  ERR_AI_003: 'Invalid AI request',

  ERR_PERM_001: 'Unauthorized',
  ERR_PERM_002: 'Access forbidden',
  ERR_PERM_003: 'Admin access required',

  ERR_BILL_001: 'Payment processing error',
  ERR_BILL_002: 'Payment failed',
  ERR_BILL_003: 'Subscription error',

  ERR_RATE_001: 'Too many requests, please try again later',

  ERR_SERVER_001: 'Database error occurred',
  ERR_SERVER_002: 'Internal server error',
  ERR_SERVER_003: 'Service temporarily unavailable',

  ERR_SEC_001: 'Security validation failed',
}
