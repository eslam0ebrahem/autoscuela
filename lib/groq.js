import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `You are an expert Spanish DGT (Dirección General de Tráfico) driving instructor and data analyst.
Your goal is to analyze a student's driving theory test performance data and provide a highly accurate readiness score and personalized study advice.

Rules:
1. Calculate a "readiness_score" between 0 and 100. A score of 90+ means they are ready for the real DGT exam (max 3 errors per 30 questions). Weight recent accuracy and topic mastery.
2. Identify the top 2 to 3 "weak_topics" based on low accuracy and high average time taken.
3. Write a "coach_message" in the user's preferred language. The message must be encouraging, maximum 3 sentences, and specifically mention their weakest topic and suggest a next step.
4. You MUST return ONLY valid JSON. Do not include markdown formatting like \`\`\`json or any conversational text outside the JSON object.

Expected output format:
{
  "readiness_score": 68,
  "weak_topics": ["Illness and Medication", "Right of Way"],
  "coach_message": "Your encouraging message here.",
  "recommended_action": {
    "type": "custom_exam",
    "filters": ["Illness and Medication", "Right of Way"]
  }
}`

export async function getAIInsights(userLanguage, aggregatedData) {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `User Preferred Language: ${userLanguage}\n\nStudent Performance Data:\n${JSON.stringify(aggregatedData, null, 2)}\n\nGenerate the JSON output.`,
        },
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.2,
      response_format: { type: 'json_object' },
    })

    const content = chatCompletion.choices[0].message.content
    return JSON.parse(content)
  } catch (error) {
    console.error('Groq AI Error:', error)
    // Graceful fallback
    return {
      readiness_score: null,
      weak_topics: [],
      coach_message:
        userLanguage === 'es'
          ? '¡Sigue estudiando! Completa otro examen de práctica para generar tus análisis personalizados con IA.'
          : 'Keep studying! Take another mock exam to generate your personalized AI insights.',
      recommended_action: { type: 'official_exam', filters: [] },
    }
  }
}

export default groq
