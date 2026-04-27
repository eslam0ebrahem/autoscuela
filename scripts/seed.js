#!/usr/bin/env node
/**
 * Autoscuela Seed Script
 * 
 * Imports questions from your local MongoDB gala_exams database
 * into the Autoscuela schema format.
 * 
 * Run: node scripts/seed.js
 * 
 * Options:
 *   --topic-map    Auto-assign topic tags from help_html content
 *   --admin-email  Create an admin user (e.g. --admin-email=admin@test.com)
 *   --admin-pass   Admin password (default: admin123)
 */

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const SOURCE_URI = 'mongodb://localhost:27017/gala_exams'
const TARGET_URI = process.env.MONGODB_URI || 'mongodb+srv://eslam:052LZqFY6vjllpNG@cluster0.yvqtrkm.mongodb.net/vialia'

// --- Parse CLI args ---
const args = process.argv.slice(2)
const getArg = (name) => {
  const arg = args.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.split('=')[1] : null
}
const hasFlag = (name) => args.includes(`--${name}`)

const ADMIN_EMAIL = getArg('admin-email') || 'admin@autoscuela.com'
const ADMIN_PASS = getArg('admin-pass') || 'admin123'
const DO_TOPIC_MAP = hasFlag('topic-map') || true

// --- Topic keyword mapping ---
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

function assignTopicTag(question) {
  const text = [
    question.question?.es || '',
    question.question?.en || '',
    question.metadata?.help_html || '',
  ]
    .join(' ')
    .toLowerCase()

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      return { es: topic, en: topic } // Currently defaulting 'en' to 'es' name, would need a proper translation map in real life.
    }
  }

  return { es: 'General', en: 'General' }
}

// --- Mongoose schemas (minimal for seeding) ---
const optionSchema = new mongoose.Schema({ idx: Number, text_es: String, text_en: String })
const questionSchema = new mongoose.Schema({
  exam_id: Number,
  question_number: Number,
  correct_option_idx: Number,
  topic_tag: {
    es: String,
    en: String
  },
  isActive: { type: Boolean, default: true },
  metadata: { image_url: String, help_html: String },
  options: [optionSchema],
  question: { es: String, en: String },
})

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  passwordHash: String,
  nickname: String,
  role: { type: String, default: 'user' },
  preferences: { language: { type: String, default: 'es' } },
  subscription: { status: { type: String, default: 'inactive' } },
  gamification: { currentStreak: Number, totalXP: Number },
  premiumOverride: { type: Boolean, default: false },
})

async function seed() {
  console.log('\n🌱 Autoscuela Seed Script')
  console.log('='.repeat(50))

  // Connect to source (gala_exams)
  console.log(`\n📡 Connecting to source: ${SOURCE_URI}`)
  const sourceConn = await mongoose.createConnection(SOURCE_URI).asPromise()

  // Get all collections in gala_exams to find questions
  const collections = await sourceConn.db.listCollections().toArray()
  console.log(`📦 Found collections: ${collections.map((c) => c.name).join(', ')}`)

  let sourceQuestions = []

  // Try to find questions collection (may be named differently)
  for (const col of collections) {
    const sample = await sourceConn.db.collection(col.name).findOne()
    if (sample && (sample.question || sample.pregunta || sample.exam_id)) {
      console.log(`✅ Found questions in collection: ${col.name}`)
      sourceQuestions = await sourceConn.db.collection(col.name).find({}).toArray()
      break
    }
  }

  if (sourceQuestions.length === 0) {
    console.log('⚠️  No questions found. Please check your gala_exams database structure.')
    console.log('   The seed script expects documents with: question, options, correct_option_idx fields')
    process.exit(0)
  }

  console.log(`📝 Found ${sourceQuestions.length} questions to import`)

  // Connect to target
  console.log(`\n📡 Connecting to target: ${TARGET_URI}`)
  let targetConn
  if (SOURCE_URI === TARGET_URI) {
    targetConn = sourceConn
  } else {
    targetConn = await mongoose.createConnection(TARGET_URI).asPromise()
  }

  const Question = targetConn.model('Question', questionSchema, 'questions')
  const User = targetConn.model('User', userSchema, 'users')

  // Transform and import questions
  console.log('\n🔄 Transforming and importing questions...')
  let imported = 0
  let skipped = 0
  let errors = 0

  for (const src of sourceQuestions) {
    try {
      // Normalize document from various possible formats
      const normalized = {
        exam_id: src.exam_id || src.examId || 1,
        question_number: src.question_number || src.questionNumber || src.number || imported + 1,
        correct_option_idx: src.correct_option_idx ?? src.correctOptionIdx ?? src.answer ?? 0,
        isActive: true,
        metadata: {
          image_url: src.metadata?.image_url || src.imageUrl || src.image || null,
          help_html: src.metadata?.help_html || src.helpHtml || src.explanation || src.ayuda || '',
        },
        options: [],
        question: {
          es: src.question?.es || src.pregunta || src.text_es || src.question || '',
          en: src.question?.en || src.text_en || src.question_en || src.question?.es || src.pregunta || '',
        },
      }

      // Normalize options
      const rawOptions = src.options || src.opciones || []
      if (Array.isArray(rawOptions)) {
        normalized.options = rawOptions.map((opt, i) => ({
          idx: opt.idx ?? i,
          text_es: opt.text_es || opt.es || opt.text || opt.option || opt.toString(),
          text_en: opt.text_en || opt.en || opt.text_es || opt.es || opt.text || opt.option || '',
        }))
      }

      // Auto-assign topic tag
      if (DO_TOPIC_MAP) {
        normalized.topic_tag = assignTopicTag(normalized)
      }

      await Question.findOneAndUpdate(
        { exam_id: normalized.exam_id, question_number: normalized.question_number },
        { $set: normalized },
        { upsert: true, new: true }
      )

      imported++
      if (imported % 50 === 0) {
        process.stdout.write(`   Imported ${imported}/${sourceQuestions.length}...\r`)
      }
    } catch (err) {
      errors++
      if (errors < 5) console.error(`\n   Error on question: ${err.message}`)
    }
  }

  console.log(`\n✅ Questions: ${imported} imported, ${skipped} skipped, ${errors} errors`)

  // Create admin user
  console.log(`\n👤 Creating admin user: ${ADMIN_EMAIL}`)
  try {
    const passwordHash = await bcrypt.hash(ADMIN_PASS, 12)
    await User.findOneAndUpdate(
      { email: ADMIN_EMAIL },
      {
        $set: {
          email: ADMIN_EMAIL,
          passwordHash,
          nickname: 'Admin',
          role: 'admin',
          premiumOverride: true,
          preferences: { language: 'es' },
          subscription: { status: 'active' },
          gamification: { currentStreak: 0, totalXP: 0 },
        },
      },
      { upsert: true, new: true }
    )
    console.log(`✅ Admin user created: ${ADMIN_EMAIL} / ${ADMIN_PASS}`)
  } catch (err) {
    console.error(`❌ Admin creation failed: ${err.message}`)
  }

  // Summary
  const totalQ = await Question.countDocuments()
  console.log('\n' + '='.repeat(50))
  console.log('🎉 Seed complete!')
  console.log(`   📝 Total questions in DB: ${totalQ}`)
  console.log(`   🔑 Admin: ${ADMIN_EMAIL} / ${ADMIN_PASS}`)
  console.log('\n💡 Next steps:')
  console.log('   1. cp .env.example .env.local && fill in your API keys')
  console.log('   2. npm install')
  console.log('   3. npm run dev')
  console.log('   4. Visit http://localhost:3000\n')

  await sourceConn.close()
  if (targetConn !== sourceConn) await targetConn.close()
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
