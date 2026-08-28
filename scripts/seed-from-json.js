#!/usr/bin/env node
/**
 * Advanced Seed from scraped_questions.json
 * 
 * Performs STRICT content-based deduplication (Question + Options).
 * Re-indexes unique questions into clean 30-question exams to satisfy 
 * the project's "Official Exam" requirements.
 */

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')

const TARGET_URI = process.env.MONGODB_URI || 'mongodb+srv://user:password@cluster.mongodb.net/dbname'
const JSON_PATH = path.resolve(__dirname, '..', 'scraped_questions.json')

const TOPIC_KEYWORDS = {
  'Señales de tráfico': ['señal', 'señales', 'sign', 'semáforo', 'traffic light', 'prohibición'],
  'Velocidad': ['velocidad', 'speed', 'km/h', 'velocidades máximas'],
  'Cinturones y seguridad': ['cinturón', 'seat belt', 'airbag', 'casco', 'seguridad pasiva'],
  'Preferencia de paso': ['prioridad', 'ceda el paso', 'right of way', 'intersección'],
  'Alcohol y drogas': ['alcohol', 'droga', 'tasa', 'alcohotest', 'bebida'],
  'Medicamentos y enfermedad': ['medicamento', 'enfermedad', 'medication', 'illness', 'fatiga', 'sueño'],
  'Distancias de seguridad': ['distancia', 'seguimiento', 'following distance', 'espacio'],
  'Adelantamiento': ['adelantamiento', 'overtake', 'adelantar'],
  'Estacionamiento': ['estacionamiento', 'aparcamiento', 'parking', 'aparcar'],
  'Alumbrado': ['luz', 'alumbrado', 'luces', 'faros', 'lights', 'visibilidad'],
  'Mecánica del vehículo': ['motor', 'frenos', 'brake', 'neumático', 'rueda', 'aceite'],
  'Contaminación y medio ambiente': ['contaminación', 'emisión', 'medio ambiente', 'CO2'],
  'Autopistas y autovías': ['autopista', 'autovía', 'motorway', 'highway'],
  'Animales en carretera': ['animal', 'ganado', 'animals'],
  'Accidentes y primeros auxilios': ['accidente', 'auxilio', 'socorro', 'emergencia', 'accident'],
}

const TOPIC_EN_MAP = {
  'Señales de tráfico': 'Traffic Signs',
  'Velocidad': 'Speed',
  'Cinturones y seguridad': 'Seatbelts & Safety',
  'Preferencia de paso': 'Right of Way',
  'Alcohol y drogas': 'Alcohol & Drugs',
  'Medicamentos y enfermedad': 'Medication & Illness',
  'Distancias de seguridad': 'Safety Distances',
  'Adelantamiento': 'Overtaking',
  'Estacionamiento': 'Parking',
  'Alumbrado': 'Lighting',
  'Mecánica del vehículo': 'Vehicle Mechanics',
  'Contaminación y medio ambiente': 'Pollution & Environment',
  'Autopistas y autovías': 'Motorways',
  'Animales en carretera': 'Animals on Road',
  'Accidentes y primeros auxilios': 'Accidents & First Aid',
  'General': 'General'
}

function assignTopicTag(qEs, qEn, explanation) {
  const text = [qEs, qEn, explanation].join(' ').toLowerCase()
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
      return { es: topic, en: TOPIC_EN_MAP[topic] || topic }
    }
  }
  return { es: 'General', en: 'General' }
}

const optionSchema = new mongoose.Schema({ idx: Number, text_es: String, text_en: String })
const questionSchema = new mongoose.Schema({
  exam_id: Number,
  question_number: Number,
  correct_option_idx: Number,
  topic_tag: { es: String, en: String },
  isActive: { type: Boolean, default: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  metadata: { image_url: String, help_html: String },
  options: [optionSchema],
  question: { es: String, en: String },
  stats: { timesAnswered: { type: Number, default: 0 }, timesCorrect: { type: Number, default: 0 } },
})

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  passwordHash: String,
  nickname: String,
  role: { type: String, default: 'user' },
  preferences: { language: { type: String, default: 'es' } },
  subscription: { status: { type: String, default: 'active' } },
  premiumOverride: { type: Boolean, default: true },
})

async function seed() {
  console.log('\n🚀 Starting Strict Content Deduplication Seed...')
  
  if (!fs.existsSync(JSON_PATH)) {
    console.error('❌ JSON not found at:', JSON_PATH); process.exit(1)
  }

  const rawData = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'))
  const uniquePool = new Map()

  console.log('🔍 Analyzing content duplicates...')
  for (const test of rawData) {
    for (const q of test.questions) {
      const qText = q.question?.es || ''
      const opts = (q.options || []).map(o => o.text?.es || '').sort().join('|')
      const contentHash = `${qText}@@@${opts}`

      if (!uniquePool.has(contentHash)) {
        uniquePool.set(contentHash, {
          question: q.question,
          options: q.options,
          correct_answer_index: q.correct_answer_index,
          image_url: q.image_url,
          explanation: q.explanation
        })
      }
    }
  }

  const uniqueQuestions = Array.from(uniquePool.values())
  console.log(`✅ Found ${uniqueQuestions.length} unique questions out of ${rawData.reduce((acc, t) => acc + t.questions.length, 0)} total entries.`)

  const conn = await mongoose.createConnection(TARGET_URI).asPromise()
  const Question = conn.model('Question', questionSchema, 'questions')
  const User = conn.model('User', userSchema, 'users')

  console.log('🗑️  Clearing old questions...')
  await Question.deleteMany({})

  console.log('📦 Re-indexing into 30-question exams...')
  const bulkOps = []
  uniqueQuestions.forEach((q, index) => {
    const examId = Math.floor(index / 30) + 1
    const qNum = (index % 30) + 1
    
    const helpHtml = q.explanation ? `${q.explanation.text || ''}\n\n${q.explanation.reference || ''}` : ''
    const topic = assignTopicTag(q.question?.es || '', q.question?.en || '', helpHtml)

    const doc = {
      exam_id: examId,
      question_number: qNum,
      correct_option_idx: (q.correct_answer_index || 1) - 1,
      topic_tag: topic,
      isActive: true,
      difficulty: 'medium',
      metadata: {
        image_url: q.image_url || null,
        help_html: helpHtml
      },
      options: (q.options || []).map((opt, i) => ({
        idx: i,
        text_es: opt.text?.es || '',
        text_en: opt.text?.en || ''
      })),
      question: {
        es: q.question?.es || '',
        en: q.question?.en || ''
      }
    }

    bulkOps.push({ insertOne: { document: doc } })
  })

  console.log(`📤 Inserting ${bulkOps.length} clean records...`)
  await Question.bulkWrite(bulkOps)

  console.log('👤 Ensuring admin user exists...')
  const passwordHash = await bcrypt.hash('admin123', 12)
  await User.findOneAndUpdate(
    { email: 'admin@autoscuela.com' },
    { $set: { email: 'admin@autoscuela.com', passwordHash, nickname: 'Admin', role: 'admin', premiumOverride: true, subscription: { status: 'active' } } },
    { upsert: true }
  )

  console.log('\n✨ Database Update Complete!')
  console.log(`📊 Final Unique Question Count: ${await Question.countDocuments()}`)
  console.log(`📋 Total Clean Exams Created: ${Math.ceil(uniqueQuestions.length / 30)}`)
  
  await conn.close()
  process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
