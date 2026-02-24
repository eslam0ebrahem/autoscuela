import mongoose from 'mongoose'

const optionSchema = new mongoose.Schema({
  idx: { type: Number, required: true },
  text_es: { type: String, required: true },
  text_en: { type: String, required: true },
})

const questionSchema = new mongoose.Schema(
  {
    exam_id: { type: Number, required: true, index: true },
    question_number: { type: Number, required: true },
    correct_option_idx: { type: Number, required: true },
    topic_tag: { type: String, index: true },
    isActive: { type: Boolean, default: true },

    metadata: {
      image_url: { type: String },
      help_html: { type: String },
    },

    options: [optionSchema],

    question: {
      es: { type: String, required: true },
      en: { type: String, required: true },
    },
  },
  { timestamps: true }
)

questionSchema.index({ exam_id: 1, question_number: 1 })
questionSchema.index({ topic_tag: 1, isActive: 1 })

export default mongoose.models.Question || mongoose.model('Question', questionSchema)
