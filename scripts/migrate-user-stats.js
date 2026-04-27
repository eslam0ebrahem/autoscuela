import mongoose from 'mongoose'
// import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// dotenv.config({ path: path.join(__dirname, '../.env') })

// Define simplified models to avoid Next.js module resolutions
const userSchema = new mongoose.Schema({
  email: String,
  stats: { type: mongoose.Schema.Types.Mixed }
}, { strict: false })

const userAnswerSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  topic_tag: { es: String, en: String },
  is_correct: Boolean,
  time_taken_seconds: Number
}, { strict: false })

const User = mongoose.model('User', userSchema)
const UserAnswer = mongoose.model('UserAnswer', userAnswerSchema)

async function migrate() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is missing')
    process.exit(1)
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB.')

    const users = await User.find({}).select('_id email').lean()
    console.log(`Found ${users.length} users to migrate.`)

    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      console.log(`Migrating user ${i + 1}/${users.length} (${user.email})...`)

      const answers = await UserAnswer.find({ userId: user._id }).lean()

      const stats = {
        totalAnswers: 0,
        correctAnswers: 0,
        topicStats: {}
      }

      for (const answer of answers) {
        stats.totalAnswers++
        if (answer.is_correct) stats.correctAnswers++

        const topic = answer.topic_tag?.es || 'General'
        if (!stats.topicStats[topic]) {
          stats.topicStats[topic] = { attempted: 0, correct: 0, totalTime: 0 }
        }

        stats.topicStats[topic].attempted++
        if (answer.is_correct) stats.topicStats[topic].correct++
        stats.topicStats[topic].totalTime += (answer.time_taken_seconds || 0)
      }

      await User.findByIdAndUpdate(user._id, { $set: { stats } })
    }

    console.log('Migration completed successfully.')
    process.exit(0)
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

migrate()
