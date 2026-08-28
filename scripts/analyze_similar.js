const mongoose = require('mongoose')

const TARGET_URI = process.env.MONGODB_URI || 'mongodb+srv://user:password@cluster.mongodb.net/dbname'

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
  
  const groupsByText = new Map()

  for (const q of questions) {
    let textEs = q.question?.es || ''
    textEs = textEs.replace(/<[^>]*>?/gm, '').replace(/[^\w\s\u00C0-\u017F]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
    if (textEs.length < 5) continue;

    if (!groupsByText.has(textEs)) {
      groupsByText.set(textEs, [])
    }
    groupsByText.get(textEs).push(q)
  }

  let similarCount = 0

  for (const [text, group] of groupsByText.entries()) {
    if (group.length > 1) {
      // Check if they are actually the same question despite minor differences in options or images
      let isDuplicate = false;
      
      // Compare each pair in the group
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
            let opts1 = (group[i].options || []).map(o => (o.text_es || '').toLowerCase().replace(/[^\w\s\u00C0-\u017F]/g, '').trim()).sort().join(' ')
            let opts2 = (group[j].options || []).map(o => (o.text_es || '').toLowerCase().replace(/[^\w\s\u00C0-\u017F]/g, '').trim()).sort().join(' ')
            
            // If the options are somewhat similar (e.g., share a lot of words)
            // Or if image is the same
            let img1 = group[i].metadata?.image_url || ''
            let img2 = group[j].metadata?.image_url || ''
            
            if (opts1 === opts2 || img1 === img2) {
               isDuplicate = true;
            }
        }
      }
      
      if (isDuplicate) {
         similarCount++
         if (similarCount <= 3) {
           console.log(`\nExample of similar question: ${text}`)
           group.forEach(q => {
             console.log(`  - Image: ${q.metadata?.image_url || 'NONE'}`)
             console.log(`  - Options: ${(q.options||[]).map(o=>o.text_es).join(' | ')}`)
           })
         }
      }
    }
  }
  
  console.log(`\nFound ${similarCount} groups of suspiciously similar questions.`)
  await mongoose.disconnect()
}

run().catch(console.error)
