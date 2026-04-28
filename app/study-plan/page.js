'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import Spinner from '@/components/ui/Spinner'
import {
  CalendarOutlined,
  ClockCircleOutlined,
  RobotOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  BulbOutlined,
  WarningOutlined,
} from '@ant-design/icons'

function StudyPlanContent() {
  const { user, t } = useAuth()
  const toast = useToast()
  const router = useRouter()
  
  const [targetDate, setTargetDate] = useState('')
  const [dailyMinutes, setDailyMinutes] = useState(30)
  const [loading, setLoading] = useState(false)
  const [planData, setPlanData] = useState(null)
  
  const lang = user?.preferences?.language || 'es'

  // Pre-fill target date to 30 days from now as default
  useEffect(() => {
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + 30)
    setTargetDate(defaultDate.toISOString().split('T')[0])
  }, [])

  const handleGeneratePlan = async (e) => {
    e.preventDefault()
    
    if (!targetDate) {
      toast?.error?.(t('Selecciona una fecha', 'Select a date'), t('Por favor ingresa la fecha de tu examen.', 'Please enter your exam date.'))
      return
    }

    const examDate = new Date(targetDate)
    const today = new Date()
    if (examDate <= today) {
      toast?.error?.(t('Fecha inválida', 'Invalid date'), t('La fecha del examen debe ser en el futuro.', 'Exam date must be in the future.'))
      return
    }

    setLoading(true)
    setPlanData(null)

    try {
      const res = await fetch(`/api/ai/study-plan?targetDate=${targetDate}&dailyMinutes=${dailyMinutes}&lang=${lang}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.message || t('Error al generar el plan', 'Error generating plan'))
      }

      setPlanData(data)
    } catch (error) {
      console.error('[StudyPlan] Error:', error)
      toast?.error?.(t('Error', 'Error'), error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container-wrapper space-y-6">
      {/* Header */}
      <div className="card bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 text-white border-0 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 scale-150 pointer-events-none">
          <CalendarOutlined style={{ fontSize: '120px' }} />
        </div>
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-3xl mb-4 shadow-lg border border-white/30">
            <RobotOutlined />
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-2 tracking-tight">
            {t('Tu Plan de Estudio Inteligente', 'Your Smart Study Plan')}
          </h1>
          <p className="text-indigo-100 font-medium text-sm md:text-base max-w-2xl">
            {t(
              'Nuestra IA analiza tus puntos débiles y tu tiempo disponible para crear el camino más rápido hacia tu aprobado.',
              'Our AI analyzes your weak spots and available time to build the fastest path to passing.'
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Configuration Form */}
        <div className="lg:col-span-4">
          <div className="card sticky top-20 bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-black text-ink dark:text-white mb-4 flex items-center gap-2">
              <CalendarOutlined className="text-primary" />
              {t('Configurar Plan', 'Configure Plan')}
            </h2>
            
            <form onSubmit={handleGeneratePlan} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-ink dark:text-slate-200 mb-1.5">
                  {t('Fecha del Examen', 'Exam Date')}
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-ink dark:text-slate-200 mb-1.5">
                  {t('Tiempo de estudio diario', 'Daily study time')}
                </label>
                <div className="relative flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition-all">
                  <div className="pl-4 text-slate-400">
                    <ClockCircleOutlined />
                  </div>
                  <select
                    value={dailyMinutes}
                    onChange={(e) => setDailyMinutes(Number(e.target.value))}
                    className="w-full bg-transparent border-none px-3 py-3 text-ink dark:text-white focus:outline-none appearance-none font-medium"
                  >
                    <option value={15} className="dark:bg-slate-800">15 {t('minutos', 'minutes')}</option>
                    <option value={30} className="dark:bg-slate-800">30 {t('minutos', 'minutes')}</option>
                    <option value={45} className="dark:bg-slate-800">45 {t('minutos', 'minutes')}</option>
                    <option value={60} className="dark:bg-slate-800">1 {t('hora', 'hour')}</option>
                    <option value={120} className="dark:bg-slate-800">2 {t('horas', 'hours')}</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3.5 flex items-center justify-center gap-2 font-bold text-lg"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" color="white" />
                    <span>{t('Generando...', 'Generating...')}</span>
                  </>
                ) : (
                  <>
                    <RocketOutlined />
                    <span>{t('Generar Plan', 'Generate Plan')}</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
              <div className="flex items-start gap-3">
                <BulbOutlined className="text-indigo-600 dark:text-indigo-400 text-lg mt-0.5" />
                <p className="text-xs font-medium text-indigo-900 dark:text-indigo-200 leading-relaxed">
                  {t(
                    'Este plan se adaptará dinámicamente si respondes más preguntas. Genera uno nuevo en cualquier momento para recalibrar tu progreso.',
                    'This plan adapts dynamically as you answer more questions. Generate a new one anytime to recalibrate your progress.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Results Area */}
        <div className="lg:col-span-8">
          {loading ? (
            <div className="card h-full min-h-[400px] flex flex-col items-center justify-center border border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur">
              <div className="w-20 h-20 mb-6 rounded-full border-4 border-indigo-100 dark:border-indigo-900 border-t-primary animate-spin" />
              <h3 className="text-xl font-bold text-ink dark:text-white mb-2 animate-pulse">
                {t('Analizando tu perfil...', 'Analyzing your profile...')}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-center max-w-md">
                {t(
                  'Estamos procesando tus estadísticas y calculando la mejor ruta de estudio...',
                  'We are processing your stats and calculating the best study path...'
                )}
              </p>
            </div>
          ) : planData?.plan ? (
            <div className="space-y-6 animate-fade-in">
              {/* Summary Card */}
              <div className="card bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-black text-ink dark:text-white mb-3">
                  {t('Resumen del Plan', 'Plan Summary')}
                </h3>
                <p className="text-ink-light dark:text-slate-300 mb-6 leading-relaxed">
                  {planData.plan.summary}
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                    <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">
                      {t('Rutina Diaria', 'Daily Routine')}
                    </div>
                    <div className="font-semibold text-ink dark:text-white">
                      {planData.plan.daily_routine}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
                    <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">
                      {t('Días Restantes', 'Days Remaining')}
                    </div>
                    <div className="font-semibold text-ink dark:text-white">
                      {planData.daysUntilExam} {t('días', 'days')}
                    </div>
                  </div>
                </div>

                {planData.plan.critical_warning && (
                  <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-start gap-3">
                    <WarningOutlined className="text-red-500 mt-0.5 text-lg" />
                    <div>
                      <h4 className="font-bold text-red-800 dark:text-red-300 text-sm mb-1">
                        {t('Atención', 'Warning')}
                      </h4>
                      <p className="text-sm text-red-700 dark:text-red-200">
                        {planData.plan.critical_warning}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Weekly Plan */}
              <div className="space-y-4">
                <h3 className="text-xl font-black text-ink dark:text-white px-2">
                  {t('Cronograma Semanal', 'Weekly Schedule')}
                </h3>
                
                <div className="space-y-4">
                  {planData.plan.weeks?.map((week, idx) => {
                    const focusArea = week.focus_area || week.focus || week.title || t('Progreso General', 'General Progress')
                    const tasks = Array.isArray(week.tasks) ? week.tasks : (Array.isArray(week.activities) ? week.activities : (typeof week === 'string' ? [week] : [t('Revisar temario asignado.', 'Review assigned topics.')]))
                    
                    return (
                      <div key={idx} className="card bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-6 relative overflow-hidden group hover:border-primary/30 transition-colors">
                        {/* Week Label */}
                        <div className="md:w-32 shrink-0 flex flex-col items-start justify-center">
                          <div className="text-primary font-black text-2xl">
                            {t('Semana', 'Week')} {week.week_number || (idx + 1)}
                          </div>
                          <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
                            {focusArea}
                          </div>
                        </div>
                        
                        {/* Divider */}
                        <div className="hidden md:block w-px bg-slate-200 dark:bg-slate-700 self-stretch my-2" />
                        
                        {/* Tasks */}
                        <div className="flex-1 space-y-3">
                          {tasks.map((task, tIdx) => (
                            <div key={tIdx} className="flex items-start gap-3">
                              <CheckCircleOutlined className="text-emerald-500 mt-1 shrink-0" />
                              <span className="text-ink dark:text-slate-300 font-medium leading-relaxed">
                                {typeof task === 'string' ? task : JSON.stringify(task)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Daily Tip */}
              {planData.plan.daily_tip && (
                <div className="card bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-xl border-0 relative overflow-hidden">
                  <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl shrink-0">
                      <BulbOutlined />
                    </div>
                    <div>
                      <h4 className="font-black text-lg mb-1">{t('Consejo de Oro', 'Golden Tip')}</h4>
                      <p className="font-medium text-emerald-50">{planData.plan.daily_tip}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Accept Plan Button */}
              <div className="mt-8 flex justify-center">
                <button
                  onClick={async () => {
                    try {
                      setLoading(true)
                      const res = await fetch('/api/study-plan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          targetDate: planData.targetDate || targetDate,
                          dailyMinutes: planData.dailyMinutes || dailyMinutes,
                          planData: planData.plan
                        })
                      })
                      if (!res.ok) throw new Error('Failed to save plan')
                      toast?.success?.(t('¡Plan guardado exitosamente!', 'Plan saved successfully!'))
                      router.push('/dashboard')
                    } catch (err) {
                      toast?.error?.(t('Error al guardar el plan', 'Failed to save plan'))
                      setLoading(false)
                    }
                  }}
                  className="btn btn-primary px-10 py-3 text-lg shadow-xl shadow-primary/20 hover:-translate-y-1 transition-transform animate-fade-in"
                >
                  <CalendarOutlined className="mr-2" />
                  {t('Aceptar y Guardar Plan', 'Accept and Save Plan')}
                </button>
              </div>
            </div>
          ) : (
            <div className="card h-full min-h-[400px] flex flex-col items-center justify-center text-center border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
              <div className="w-24 h-24 mb-4 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-4xl text-indigo-300 dark:text-indigo-700">
                <CalendarOutlined />
              </div>
              <h3 className="text-xl font-bold text-slate-400 dark:text-slate-500 mb-2">
                {t('Sin plan generado', 'No plan generated')}
              </h3>
              <p className="text-slate-400 dark:text-slate-600 max-w-sm">
                {t(
                  'Configura tu fecha de examen y tiempo diario para obtener una ruta de estudio diseñada por IA.',
                  'Set your exam date and daily time to get an AI-designed study path.'
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function StudyPlanPage() {
  return (
    <AppShell>
      <StudyPlanContent />
    </AppShell>
  )
}
