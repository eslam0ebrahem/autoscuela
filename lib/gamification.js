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
    description: { es: 'Completa tu primer examen de practica', en: 'Complete your first mock exam' },
    icon: '🚗',
    color: '#10B981',
  },
  {
    id: 'flawless_drive',
    name: { es: 'Conduccion Perfecta', en: 'Flawless Drive' },
    description: { es: 'Saca 30/30 en un examen oficial', en: 'Score 30/30 on an official DGT mock exam' },
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
    description: { es: 'Responde 100 preguntas en un dia', en: 'Answer 100 questions in a single day' },
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
    description: { es: 'Alcanza un 90% en la puntuacion de preparacion IA', en: 'Reach 90% AI Readiness Score' },
    icon: '🎓',
    color: '#2563EB',
  },
  {
    id: 'speed_demon',
    name: { es: 'Velocista', en: 'Speed Demon' },
    description: { es: 'Completa un examen oficial en menos de 15 minutos', en: 'Complete an official exam in under 15 minutes' },
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
]

export function checkBadgeConditions(user, examSession, dailyAnswerCount, { examLanguages = [], newStreak } = {}) {
  const newBadges = []
  const earned = user.gamification?.earnedBadges || []
  const streak = newStreak ?? user.gamification?.currentStreak ?? 0

  // First Gear: complete first exam
  if (!earned.includes('first_gear') && examSession) {
    newBadges.push('first_gear')
  }

  // Flawless Drive: 30/30 on official exam
  if (!earned.includes('flawless_drive') && examSession?.score === 30 && examSession?.mode === 'official') {
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

  return newBadges
}

export function shouldResetWeeklyXP(weeklyXPResetAt) {
  if (!weeklyXPResetAt) return true
  const currentWeekStart = getMadridStartOfWeek()
  return new Date(weeklyXPResetAt) < currentWeekStart
}
