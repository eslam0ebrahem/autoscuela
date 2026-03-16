import { z } from 'zod'

// ============================================================================
// Common Schemas
// ============================================================================

export const ObjectIdSchema = z.string().regex(/^[0-9a-f]{24}$/, 'Invalid MongoDB ObjectID')

export const LanguageSchema = z.enum(['es', 'en']).default('en')

export const RoleSchema = z.enum(['user', 'admin'])

// ============================================================================
// Auth Routes
// ============================================================================

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number'),
  nickname: z
    .string()
    .min(2, 'Nickname must be at least 2 characters')
    .max(20, 'Nickname must be at most 20 characters')
    .regex(/^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]+$/, 'Nickname can only contain letters, numbers, and spaces')
    .transform((n) => n.trim()),
  language: LanguageSchema.optional(),
})

export const LoginSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(true).optional(),
})

// ============================================================================
// Exam Routes
// ============================================================================

const VALID_EXAM_MODES = ['official', 'custom', 'mistakes', 'weak_topics', 'bookmarks']
const VALID_ASSISTANCE_MODES = ['instant', 'exam']

export const ExamGenerateSchema = z.object({
  mode: z.enum(VALID_EXAM_MODES).default('official'),
  topic_filter: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .nullable(),
  assistance_mode: z.enum(VALID_ASSISTANCE_MODES).default('exam'),
  num_questions: z
    .number()
    .int()
    .min(5, 'Minimum 5 questions')
    .max(100, 'Maximum 100 questions')
    .default(30)
    .optional(),
  source: z.string().default('standard').optional(),
})

export const ExamAnswerSchema = z.object({
  question_id: ObjectIdSchema,
  selected_option_idx: z
    .number()
    .int()
    .min(0, 'Option index must be 0-3')
    .max(3, 'Option index must be 0-3'),
  time_taken: z
    .number()
    .int()
    .min(0, 'Time taken cannot be negative')
    .max(1800, 'Time taken cannot exceed 30 minutes')
    .optional(),
})

export const ExamSubmitSchema = z.object({
  sessionId: ObjectIdSchema,
  // Body is typically empty, but allow optional fields for future expansion
  remarks: z.string().optional(),
})

// ============================================================================
// Bookmarks Routes
// ============================================================================

export const BookmarkToggleSchema = z.object({
  questionId: ObjectIdSchema,
})

export const BookmarkQuerySchema = z.object({
  idsOnly: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  page: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).default(1))
    .optional(),
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(100).default(20))
    .optional(),
})

// ============================================================================
// Admin Routes
// ============================================================================

export const AdminUserUpdateSchema = z.object({
  role: z.enum(['user', 'admin']).optional(),
  premiumOverride: z.boolean().optional(),
})

export const AdminQuestionImportSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(5, 'Question text required'),
        options: z.array(z.string()).length(4, 'Must have exactly 4 options'),
        correct_option_idx: z.number().int().min(0).max(3),
        topic_tag: z
          .object({
            es: z.string(),
            en: z.string(),
          })
          .optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
        metadata: z
          .object({
            help_html: z.string().optional(),
            source: z.string().optional(),
          })
          .optional(),
      })
    )
    .min(1, 'At least 1 question required')
    .max(500, 'Maximum 500 questions per import'),
})

// ============================================================================
// AI Routes
// ============================================================================

export const AIHintSchema = z.object({
  sessionId: ObjectIdSchema,
  questionId: ObjectIdSchema,
  lang: LanguageSchema.optional(),
})

export const AIExplainSchema = z.object({
  sessionId: ObjectIdSchema,
  questionId: ObjectIdSchema,
  selectedIdx: z.number().int().min(0).max(3),
  lang: LanguageSchema.optional(),
})

export const AIRecommendSchema = z.object({
  examMode: z.enum(VALID_EXAM_MODES).optional(),
  lang: LanguageSchema.optional(),
})

export const AICoachSchema = z.object({
  sessionId: ObjectIdSchema.optional(),
  statsContext: z
    .object({
      totalExams: z.number().int().min(0).optional(),
      averageScore: z.number().min(0).max(100).optional(),
      weakTopics: z.array(z.string()).optional(),
    })
    .optional(),
  lang: LanguageSchema.optional(),
})

// ============================================================================
// Dashboard & Stats Routes
// ============================================================================

export const DashboardQuerySchema = z.object({
  timeframe: z.enum(['week', 'month', 'all']).default('week').optional(),
})

export const StatsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'all']).default('month').optional(),
})

// ============================================================================
// Gamification Routes
// ============================================================================

export const GamificationLeaderboardSchema = z.object({
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(100).default(50))
    .optional(),
  timeframe: z.enum(['day', 'week', 'month', 'all']).default('all').optional(),
})

// ============================================================================
// Mistakes Routes
// ============================================================================

export const MistakesQuerySchema = z.object({
  limit: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(1).max(100).default(20))
    .optional(),
  offset: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(z.number().int().min(0).default(0))
    .optional(),
})

// ============================================================================
// Helper function to parse and validate schemas
// ============================================================================

/**
 * Safe parser that returns validated data or null + error
 * Usage: const { data, error } = parseSchema(MySchema, rawData)
 */
export function parseSchema(schema, data) {
  try {
    return { data: schema.parse(data), error: null }
  } catch (err) {
    if (err instanceof z.ZodError) {
      const messages = err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }))
      return { data: null, error: { status: 400, messages } }
    }
    return { data: null, error: { status: 400, messages: [{ message: 'Validation failed' }] } }
  }
}

/**
 * Parse URL query parameters
 * Usage: const params = parseQueryParams(request, QuerySchema)
 */
export function parseQueryParams(request, schema) {
  const { searchParams } = new URL(request.url)
  const obj = Object.fromEntries(searchParams.entries())
  return parseSchema(schema, obj)
}

/**
 * Parse URL path parameters
 * Usage: const { data, error } = parsePathParams({ id: 'xyz' }, z.object({ id: ObjectIdSchema }))
 */
export function parsePathParams(params, schema) {
  return parseSchema(schema, params)
}
