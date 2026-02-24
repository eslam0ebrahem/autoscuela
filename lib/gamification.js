import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { startOfDay, addDays, isYesterday, isToday } from 'date-fns'

const MADRID_TZ = 'Europe/Madrid'

export function getMadridNow() {
  return toZonedTime(new Date(), MADRID_TZ)
}

export function getMadridStartOfDay(date = new Date()) {
  const madridDate = toZonedTime(date, MADRID_TZ)
  const startMadrid = startOfDay(madridDate)
  return fromZonedTime(startMadrid, MADRID_TZ)
}

export function shouldStreakBreak(lastStudyDate) {
  if (!lastStudyDate) return false
  const madridNow = getMadridNow()
  const lastMadrid = toZonedTime(new Date(lastStudyDate), MADRID_TZ)
  // Streak breaks if last study was more than yesterday
  const yesterday = addDays(startOfDay(madridNow), -1)
  return lastMadrid < yesterday
}

export function isTodayStudied(lastStudyDate) {
  if (!lastStudyDate) return false
  const madridNow = getMadridNow()
  const lastMadrid = toZonedTime(new Date(lastStudyDate), MADRID_TZ)
  return isToday(lastMadrid, { in: undefined })
}

// XP Rewards
export const XP = {
  EXAM_PASS: 10,
  EXAM_FAIL: 5,
  FLASHCARD_CORRECT: 1,
}

// Badge definitions
export const BADGES = [
  {
    id: 'first_gear',
    name: { es: 'Primera Marcha', en: 'First Gear' },
    description: { es: 'Completa tu primer examen de práctica', en: 'Complete your first mock exam' },
    icon: '🚗',
    color: '#10B981',
  },
  {
    id: 'flawless_drive',
    name: { es: 'Conducción Perfecta', en: 'Flawless Drive' },
    description: { es: 'Saca 30/30 en un examen oficial', en: 'Score 30/30 on an official DGT mock exam' },
    icon: '⭐',
    color: '#F59E0B',
  },
  {
    id: 'bilingual_driver',
    name: { es: 'Conductor Bilingüe', en: 'Bilingual Driver' },
    description: {
      es: 'Completa un examen en español y otro en inglés',
      en: 'Complete one exam in Spanish and one in English',
    },
    icon: '🌍',
    color: '#8B5CF6',
  },
  {
    id: 'marathoner',
    name: { es: 'Maratoniano', en: 'Marathoner' },
    description: { es: 'Responde 100 preguntas en un día', en: 'Answer 100 questions in a single day' },
    icon: '🏃',
    color: '#EF4444',
  },
  {
    id: 'week_warrior',
    name: { es: 'Guerrero Semanal', en: 'Week Warrior' },
    description: { es: '7 días de racha consecutivos', en: 'Maintain a 7-day study streak' },
    icon: '🔥',
    color: '#F97316',
  },
  {
    id: 'ai_ready',
    name: { es: 'Listo para el DGT', en: 'DGT Ready' },
    description: { es: 'Alcanza un 90% en la puntuación de preparación IA', en: 'Reach 90% AI Readiness Score' },
    icon: '🎓',
    color: '#2563EB',
  },
]

export function checkBadgeConditions(user, examSession, dailyAnswerCount) {
  const newBadges = []
  const earned = user.gamification?.earnedBadges || []

  if (!earned.includes('first_gear') && examSession) {
    newBadges.push('first_gear')
  }

  if (!earned.includes('flawless_drive') && examSession?.score === 30) {
    newBadges.push('flawless_drive')
  }

  if (!earned.includes('marathoner') && dailyAnswerCount >= 100) {
    newBadges.push('marathoner')
  }

  if (!earned.includes('week_warrior') && user.gamification?.currentStreak >= 7) {
    newBadges.push('week_warrior')
  }

  return newBadges
}
