'use client'

import React, { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts'
import { useAuth } from '@/components/AuthContext'

export default function StudyTrendsChart({ data }) {
  const { t } = useAuth()

  // Filter to last 14 days for a cleaner view by default, or just use all passed data if it's already filtered
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return []
    // The calendar endpoint returns 365 days. Let's show the last 30 days that have data, or just the last 30 days.
    return data.slice(-30).map((day) => ({
      ...day,
      // Format date for display (e.g. "Oct 12")
      displayDate: new Date(day.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
    }))
  }, [data])

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <p className="text-slate-400 dark:text-slate-500 text-sm">
          {t('No hay suficientes datos para mostrar la gráfica', 'Not enough data to display chart')}
        </p>
      </div>
    )
  }

  return (
    <div className="card w-full">
      <h3 className="font-bold text-ink dark:text-white mb-6">
        {t('Actividad de los últimos 30 días', 'Activity over the last 30 days')}
      </h3>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorQuestions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="displayDate"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
              dy={10}
              minTickGap={20}
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                color: '#0f172a'
              }}
            />
            <Legend verticalAlign="top" height={36} iconType="circle" />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="questions"
              name={t('Preguntas', 'Questions')}
              stroke="#4f46e5"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorQuestions)"
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="accuracy"
              name={t('Precisión %', 'Accuracy %')}
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorAccuracy)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
