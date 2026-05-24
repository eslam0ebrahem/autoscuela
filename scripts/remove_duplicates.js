const mongoose = require('mongoose')

const TARGET_URI = process.env.MONGODB_URI || 'mongodb+srv://eslam:052LZqFY6vjllpNG@cluster0.yvqtrkm.mongodb.net/vialia'

const questionSchema = new mongoose.Schema({
  question: { es: String, en: String },
  options: [{ idx: Number, text_es: String, text_en: String }],
  metadata: { image_url: String, help_html: String },
}, { strict: false })

async function run() {
  console.log('Connecting to database...')
  await mongoose.connect(TARGET_URI)
  const Question = mongoose.model('Question', questionSchema, 'questions')

  const questions = await Question.find({})
  
  const groups = new Map()

  for (const q of questions) {
    let textEs = q.question?.es || ''
    // Normalize question text heavily
    textEs = textEs.replace(/<[^>]*>?/gm, '')
                   .replace(/[^\w\s\u00C0-\u017F]/g, '')
                   .replace(/\s+/g, ' ')
                   .trim().toLowerCase()
    
    if (textEs.length < 5) continue;

    // Clean and sort options to be order-independent
    let optionsText = (q.options || [])
      .map(o => (o.text_es || '').replace(/<[^>]*>?/gm, '').replace(/[^\w\s\u00C0-\u017F]/g, '').replace(/\s+/g, ' ').trim().toLowerCase())
      .filter(t => t.length > 0)
      .sort()
      .join('|||')

    // Fingerprint relies purely on Question text + Options text
    const fingerprint = `${textEs}____${optionsText}`

    if (!groups.has(fingerprint)) {
      groups.set(fingerprint, [])
    }
    groups.get(fingerprint).push(q)
  }

  let deletedCount = 0
  let groupsFound = 0

  for (const [fingerprint, group] of groups.entries()) {
    if (group.length > 1) {
      groupsFound++
      console.log(`\n--- Duplicate Group ${groupsFound} ---`)
      console.log(`Question: ${group[0].question.es}`)
      
      // Keep the first one, delete the rest
      for (let i = 1; i < group.length; i++) {
        await Question.findByIdAndDelete(group[i]._id)
        deletedCount++
      }
    }
  }

  console.log(`\n✅ Safely deleted ${deletedCount} questions based on exact Question Text AND exact Options match.`)
  await mongoose.disconnect()
}

run().catch(console.error)
