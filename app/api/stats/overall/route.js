import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import UserAnswer from '@/models/UserAnswer'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request) {
  try {
    const tokenData = await getCurrentUser(request)
    if (!tokenData) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await connectDB()

    const today = new Date()
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)

    const [allTimeStats, thisWeekStats, lastWeekStats, user, totalDB, seenStats] =
      await Promise.all([
        // All-time stats
        UserAnswer.aggregate([
          { $match: { userId: new mongoose.Types.ObjectId(tokenData.userId) } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
            },
          },
        ]),
        // This week accuracy
        UserAnswer.aggregate([
          {
            $match: {
              userId: new mongoose.Types.ObjectId(tokenData.userId),
              createdAt: { $gte: lastWeek },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
            },
          },
        ]),
        // Last week accuracy (for trend)
        UserAnswer.aggregate([
          {
            $match: {
              userId: new mongoose.Types.ObjectId(tokenData.userId),
              createdAt: { $gte: twoWeeksAgo, $lt: lastWeek },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              correct: { $sum: { $cond: ['$is_correct', 1, 0] } },
            },
          },
        ]),
        User.findById(tokenData.userId).select('gamification.currentStreak'),
        mongoose.models.Question.countDocuments({ isActive: true }),
        // Unique questions seen
        UserAnswer.aggregate([
          { $match: { userId: new mongoose.Types.ObjectId(tokenData.userId) } },
          {
            $lookup: {
              from: 'questions',
              localField: 'questionId',
              foreignField: '_id',
              as: 'questionInfo',
            },
          },
          { $unwind: '$questionInfo' },
          { $match: { 'questionInfo.isActive': true } },
          { $group: { _id: '$questionId' } },
          { $count: 'uniqueCount' },
        ]),
      ])

    const allTime = allTimeStats[0] || { total: 0, correct: 0 }
    const thisWeek = thisWeekStats[0] || { total: 0, correct: 0 }
    const lastWeekData = lastWeekStats[0] || { total: 0, correct: 0 }
    const seenCount = seenStats[0]?.uniqueCount || 0

    const thisWeekAcc = thisWeek.total > 0 ? (thisWeek.correct / thisWeek.total) * 100 : 0
    const lastWeekAcc =
      lastWeekData.total > 0 ? (lastWeekData.correct / lastWeekData.total) * 100 : 0
    const weeklyAccuracyChange = Math.round(thisWeekAcc - lastWeekAcc)

    const stats = {
      answeredQuestions: allTime.total,
      correctAnswers: allTime.correct,
      incorrectAnswers: allTime.total - allTime.correct,
      currentStreak: user?.gamification?.currentStreak || 0,
      weeklyTrend: weeklyAccuracyChange !== 0,
      weeklyAccuracyChange,
      totalQuestionsInDB: totalDB,
      seenQuestions: seenCount,
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Overall stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch overall stats' }, { status: 500 })
  }
}
