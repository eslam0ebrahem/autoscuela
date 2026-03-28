// Re-exporting from modularized services to maintain backward compatibility during migration
import groq from './services/ai/provider.js'

export {
  getAIInsights,
  getExamCoachFeedback,
  getExamRecommendation,
  getStudyPlan,
  getSessionQuickSummary,
} from './services/ai/coachService.js'

export {
  getQuestionExplanation,
  getSmartHint,
  getMistakePatterns,
  getQuestionDeepDive,
} from './services/ai/explanationService.js'

export default groq
