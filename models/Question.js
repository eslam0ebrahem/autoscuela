import mongoose from 'mongoose'

const optionSchema = new mongoose.Schema({
  idx: { type: Number, required: true, min: 0, max: 3 },
  text_es: { type: String, required: true },
  text_en: { type: String, required: true },
})

const questionSchema = new mongoose.Schema(
  {
    exam_id: { type: Number, required: true, index: true },
    question_number: { type: Number, required: true },
    correct_option_idx: { type: Number, required: true, min: 0, max: 3 },
    topic_tag: {
      es: { type: String, required: true, index: true },
      en: { type: String, required: true },
    },
    isActive: { type: Boolean, default: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },

    metadata: {
      image_url: { type: String },
      help_html: { type: String },
    },

    options: {
      type: [optionSchema],
      validate: {
        validator: function (v) {
          return v && v.length >= 2 && v.length <= 4
        },
        message: 'Questions must have 2-4 options',
      },
    },

    question: {
      es: { type: String, required: true },
      en: { type: String, required: true },
    },

    // Stats tracking
    stats: {
      timesAnswered: { type: Number, default: 0 },
      timesCorrect: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
)

questionSchema.index({ exam_id: 1, question_number: 1 }, { unique: true })
questionSchema.index({ 'topic_tag.es': 1, isActive: 1 })
questionSchema.index({ isActive: 1, difficulty: 1 })

export default mongoose.models.Question || mongoose.model('Question', questionSchema)
