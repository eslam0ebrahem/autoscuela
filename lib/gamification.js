import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { startOfDay, addDays, startOfWeek } from 'date-fns'

const MADRID_TZ = 'Europe/Madrid'

export function getMadridNow() {
  return toZonedTime(new Date(), MADRID_TZ)
}

export function getMadridStartOfDay(date = new Date()) {
  const madridDate = toZonedTime(date, MADRID_TZ)
  const startMadrid = startOfDay(madridDate)
  return fromZonedTime(startMadrid, MADRID_TZ)
}

export function getMadridStartOfWeek(date = new Date()) {
  const madridDate = toZonedTime(date, MADRID_TZ)
  const startMadrid = startOfWeek(madridDate, { weekStartsOn: 1 })
  return fromZonedTime(startMadrid, MADRID_TZ)
}

export function shouldStreakBreak(lastStudyDate) {
  if (!lastStudyDate) return false
  const madridNow = getMadridNow()
  const lastMadrid = toZonedTime(new Date(lastStudyDate), MADRID_TZ)
  const yesterday = addDays(startOfDay(madridNow), -1)
  return lastMadrid < yesterday
}

export function isTodayStudied(lastStudyDate) {
  if (!lastStudyDate) return false
  const madridNow = getMadridNow()
  const lastMadrid = toZonedTime(new Date(lastStudyDate), MADRID_TZ)
  const todayStart = startOfDay(madridNow)
  const lastStart = startOfDay(lastMadrid)
  return todayStart.getTime() === lastStart.getTime()
}

// XP Rewards
export const XP = {
  EXAM_PASS: 10,
  EXAM_FAIL: 5,
  FLASHCARD_CORRECT: 1,
  DAILY_CHALLENGE: 15,
  PERFECT_EXAM: 25,
}

// Badge definitions
export const BADGES = [
  {
    id: 'first_gear',
    name: { es: 'Primera Marcha', en: 'First Gear' },
    description: {
      es: 'Completa tu primer examen de practica',
      en: 'Complete your first mock exam',
    },
    icon: '🚗',
    color: '#10B981',
  },
  {
    id: 'flawless_drive',
    name: { es: 'Conduccion Perfecta', en: 'Flawless Drive' },
    description: {
      es: 'Saca 30/30 en un examen oficial',
      en: 'Score 30/30 on an official DGT mock exam',
    },
    icon: '⭐',
    color: '#F59E0B',
  },
  {
    id: 'bilingual_driver',
    name: { es: 'Conductor Bilingue', en: 'Bilingual Driver' },
    description: {
      es: 'Completa un examen en espanol y otro en ingles',
      en: 'Complete one exam in Spanish and one in English',
    },
    icon: '🌍',
    color: '#8B5CF6',
  },
  {
    id: 'marathoner',
    name: { es: 'Maratoniano', en: 'Marathoner' },
    description: {
      es: 'Responde 100 preguntas en un dia',
      en: 'Answer 100 questions in a single day',
    },
    icon: '🏃',
    color: '#EF4444',
  },
  {
    id: 'week_warrior',
    name: { es: 'Guerrero Semanal', en: 'Week Warrior' },
    description: { es: '7 dias de racha consecutivos', en: 'Maintain a 7-day study streak' },
    icon: '🔥',
    color: '#F97316',
  },
  {
    id: 'ai_ready',
    name: { es: 'Listo para el DGT', en: 'DGT Ready' },
    description: {
      es: 'Alcanza un 90% en la puntuacion de preparacion IA',
      en: 'Reach 90% AI Readiness Score',
    },
    icon: '🎓',
    color: '#2563EB',
  },
  {
    id: 'speed_demon',
    name: { es: 'Velocista', en: 'Speed Demon' },
    description: {
      es: 'Completa un examen oficial en menos de 15 minutos',
      en: 'Complete an official exam in under 15 minutes',
    },
    icon: '⚡',
    color: '#06B6D4',
  },
  {
    id: 'daily_devotee',
    name: { es: 'Devoto Diario', en: 'Daily Devotee' },
    description: { es: 'Completa 7 retos diarios', en: 'Complete 7 daily challenges' },
    icon: '📅',
    color: '#14B8A6',
  },
  {
    id: 'two_week_streak',
    name: { es: 'Dos Semanas de Fuego', en: 'Two Week Streak' },
    description: { es: '14 dias de racha consecutivos', en: 'Maintain a 14-day study streak' },
    icon: '💪',
    color: '#DC2626',
  },
  {
    id: 'centurion',
    name: { es: 'Centurion', en: 'Centurion' },
    description: { es: 'Responde 1000 preguntas en total', en: 'Answer 1000 questions total' },
    icon: '🏛️',
    color: '#7C3AED',
  },
  {
    id: 'night_owl',
    name: { es: 'Nocturno', en: 'Night Owl' },
    description: { es: 'Estudia despues de medianoche', en: 'Study after midnight' },
    icon: '🦉',
    color: '#4338CA',
  },
  {
    id: 'early_bird',
    name: { es: 'Madrugador', en: 'Early Bird' },
    description: { es: 'Estudia antes de las 7am', en: 'Study before 7am' },
    icon: '🐦',
    color: '#F97316',
  },
  {
    id: 'mistake_hunter',
    name: { es: 'Cazaerrores', en: 'Mistake Hunter' },
    description: {
      es: 'Corrige 50 errores del banco de errores',
      en: 'Correct 50 mistakes from mistake bank',
    },
    icon: '🎯',
    color: '#DC2626',
  },
  {
    id: 'topic_master',
    name: { es: 'Maestro del Tema', en: 'Topic Master' },
    description: {
      es: 'Alcanza 90%+ en un tema con 50+ preguntas',
      en: 'Reach 90%+ on a topic with 50+ questions',
    },
    icon: '👑',
    color: '#F59E0B',
  },
  {
    id: 'all_topics',
    name: { es: 'Enciclopedia', en: 'Encyclopedia' },
    description: {
      es: 'Responde preguntas de todos los temas',
      en: 'Answer questions from every topic',
    },
    icon: '📖',
    color: '#6366F1',
  },
  {
    id: 'streak_master',
    name: { es: 'Imparable', en: 'Unstoppable' },
    description: { es: '30 dias de racha consecutivos', en: '30-day study streak' },
    icon: '⚡',
    color: '#EAB308',
  },
  {
    id: 'five_hundred',
    name: { es: 'Quinientas', en: 'Five Hundred' },
    description: { es: 'Responde 500 preguntas', en: 'Answer 500 questions' },
    icon: '🎲',
    color: '#14B8A6',
  },
  {
    id: 'speed_learner',
    name: { es: 'Aprendiz Rapido', en: 'Speed Learner' },
    description: {
      es: 'Promedio menos de 20 seg/pregunta en examen oficial',
      en: 'Average under 20 sec/question on official exam',
    },
    icon: '🚀',
    color: '#0EA5E9',
  },
  {
    id: 'comeback_kid',
    name: { es: 'Remontada', en: 'Comeback Kid' },
    description: { es: 'Aprueba tras 3 suspensos seguidos', en: 'Pass after 3 consecutive fails' },
    icon: '💫',
    color: '#A855F7',
  },
  {
    id: 'perfectionist',
    name: { es: 'Perfeccionista', en: 'Perfectionist' },
    description: { es: 'Aprueba 5 examenes seguidos', en: 'Pass 5 exams in a row' },
    icon: '🏆',
    color: '#059669',
  },
  {
    id: 'thousand_club',
    name: { es: 'Club de los Mil', en: 'Thousand Club' },
    description: { es: 'Gana 1000 XP', en: 'Earn 1000 XP' },
    icon: '💎',
    color: '#2563EB',
  },
  {
    id: 'flashcard_master',
    name: { es: 'Maestro de Tarjetas', en: 'Flashcard Master' },
    description: { es: 'Domina 100 tarjetas', en: 'Master 100 flashcards' },
    icon: '🃏',
    color: '#7C3AED',
  },
]

export function checkBadgeConditions(user, examSession, dailyAnswerCount, options = {}) {
  const {
    examLanguages = [],
    newStreak,
    totalAnswered = 0,
    consecutiveFails = 0,
    consecutivePasses = 0,
    masteredFlashcards = 0,
    topicAccuracies = [],
    uniqueTopicsAnswered = 0,
    totalTopics = 0,
    avgTimePerQuestion = 0,
    studyHour = -1,
    correctedMistakes = 0,
  } = options

  const newBadges = []
  const earned = user.gamification?.earnedBadges || []
  const streak = newStreak ?? user.gamification?.currentStreak ?? 0
  const totalXP = user.gamification?.totalXP || 0

  // First Gear: complete first exam
  if (!earned.includes('first_gear') && examSession) {
    newBadges.push('first_gear')
  }

  // Flawless Drive: 30/30 on official exam
  if (
    !earned.includes('flawless_drive') &&
    examSession?.score === 30 &&
    examSession?.mode === 'official'
  ) {
    newBadges.push('flawless_drive')
  }

  // Marathoner: 100 questions in a day
  if (!earned.includes('marathoner') && dailyAnswerCount >= 100) {
    newBadges.push('marathoner')
  }

  // Week Warrior: 7-day streak
  if (!earned.includes('week_warrior') && streak >= 7) {
    newBadges.push('week_warrior')
  }

  // Two Week Streak: 14-day streak
  if (!earned.includes('two_week_streak') && streak >= 14) {
    newBadges.push('two_week_streak')
  }

  // Bilingual Driver: exams in both ES and EN
  if (!earned.includes('bilingual_driver') && examLanguages.length >= 2) {
    newBadges.push('bilingual_driver')
  }

  // AI Ready: readiness score >= 90
  if (!earned.includes('ai_ready') && user.aiInsights?.readinessScore >= 90) {
    newBadges.push('ai_ready')
  }

  // Daily Devotee: 7 daily challenges completed
  if (!earned.includes('daily_devotee') && (user.gamification?.dailyChallengeStreak || 0) >= 7) {
    newBadges.push('daily_devotee')
  }

  // Speed Demon: official exam in under 15 minutes (900 seconds)
  if (
    !earned.includes('speed_demon') &&
    examSession?.mode === 'official' &&
    examSession?.totalTimeTakenSeconds < 900
  ) {
    newBadges.push('speed_demon')
  }

  // Night Owl: studied after midnight (hour 0-1)
  if (!earned.includes('night_owl') && studyHour >= 0 && studyHour < 2) {
    newBadges.push('night_owl')
  }

  // Early Bird: studied before 7am
  if (!earned.includes('early_bird') && studyHour >= 5 && studyHour < 7) {
    newBadges.push('early_bird')
  }

  // Mistake Hunter: corrected 50 mistakes
  if (!earned.includes('mistake_hunter') && correctedMistakes >= 50) {
    newBadges.push('mistake_hunter')
  }

  // Topic Master: 90%+ on a topic with 50+ questions
  if (
    !earned.includes('topic_master') &&
    topicAccuracies.some((t) => t.accuracy >= 90 && t.attempted >= 50)
  ) {
    newBadges.push('topic_master')
  }

  // Encyclopedia: answered from all topics
  if (
    !earned.includes('all_topics') &&
    uniqueTopicsAnswered > 0 &&
    uniqueTopicsAnswered === totalTopics &&
    totalTopics >= 10
  ) {
    newBadges.push('all_topics')
  }

  // Streak Master: 30-day streak
  if (!earned.includes('streak_master') && streak >= 30) {
    newBadges.push('streak_master')
  }

  // Five Hundred: 500 total questions answered
  if (!earned.includes('five_hundred') && totalAnswered >= 500) {
    newBadges.push('five_hundred')
  }

  // Speed Learner: average < 20 sec/question on official exam
  if (
    !earned.includes('speed_learner') &&
    examSession?.mode === 'official' &&
    avgTimePerQuestion > 0 &&
    avgTimePerQuestion < 20
  ) {
    newBadges.push('speed_learner')
  }

  // Comeback Kid: passed after 3 consecutive fails
  if (!earned.includes('comeback_kid') && examSession?.passed && consecutiveFails >= 3) {
    newBadges.push('comeback_kid')
  }

  // Perfectionist: 5 consecutive passes
  if (!earned.includes('perfectionist') && consecutivePasses >= 5) {
    newBadges.push('perfectionist')
  }

  // Thousand Club: 1000 total XP
  if (!earned.includes('thousand_club') && totalXP >= 1000) {
    newBadges.push('thousand_club')
  }

  // Flashcard Master: mastered 100 flashcards
  if (!earned.includes('flashcard_master') && masteredFlashcards >= 100) {
    newBadges.push('flashcard_master')
  }

  return newBadges
}

export function shouldResetWeeklyXP(weeklyXPResetAt) {
  if (!weeklyXPResetAt) return true
  const currentWeekStart = getMadridStartOfWeek()
  return new Date(weeklyXPResetAt) < currentWeekStart
}

/**
 * Update the leaderboard rank for a user (fire-and-forget)
 * Call this after XP changes (exam submit, daily challenge, etc.)
 * Queries users with higher XP and counts them to get the rank
 */
export async function updateLeaderboardRank(userId) {
  try {
    // Dynamically import to avoid circular deps
    const User = (await import('@/models/User')).default

    const user = await User.findById(userId).select('gamification.weeklyXP')
    if (!user) return

    // Count users with higher weekly XP
    const userXP = user.gamification?.weeklyXP || 0
    const rank = await User.countDocuments({ 'gamification.weeklyXP': { $gt: userXP } })

    // Update rank asynchronously
    await User.findByIdAndUpdate(userId, {
      $set: { 'gamification.rank': rank + 1 },
    })
  } catch (err) {
    // Silently fail - rank update is non-critical
    console.warn('[gamification] updateLeaderboardRank failed (non-critical):', err.message)
  }
}
