import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:convert';
import '../../../core/database/data_exception.dart';
import '../../../core/network/groq_client.dart';

final aiRepositoryProvider = Provider<AiRepository>((ref) {
  return AiRepository(groq: ref.watch(groqClientProvider));
});

class AiRepository {
  AiRepository({required GroqClient groq}) : _groq = groq;

  final GroqClient _groq;

  Future<String> getHint({
    required String questionId,
    required String language,
    // Note: We need the question content directly in independent mode
    // since we don't have a backend to fetch it by ID on the fly.
    // However, the repository could fetch from MongoDB if needed.
    // But for the prompt, passing data is easier if the UI has it.
    Map<String, dynamic>? questionData,
  }) async {
    if (questionData == null) return 'Piense en la regla general de conducción.';

    try {
      final qText = language == 'en'
          ? (questionData['question']['en'] ?? questionData['question']['es'])
          : (questionData['question']['es'] ?? questionData['question']['en']);

      final opts = (questionData['options'] as List)
          .asMap()
          .entries
          .map((e) {
            final idx = ['A', 'B', 'C', 'D'][e.key];
            final text = language == 'en' ? e.value['text_en'] : e.value['text_es'];
            return '$idx) $text';
          })
          .join('\n');

      const systemPrompt = '''
You are a helpful DGT driving theory tutor.
Give a helpful HINT for a question WITHOUT revealing the correct answer.
Focus on the key concept or rule the question is testing.

Return JSON:
{
  "hint": "a helpful clue (1-2 sentences) in the student's language",
  "concept": "the key driving concept being tested (3-6 words)",
  "difficulty": "easy" | "medium" | "hard"
}
Return ONLY valid JSON.
''';

      final result = await _groq.chatCompletion(
        useFastModel: true,
        messages: [
          {'role': 'system', 'content': systemPrompt},
          {
            'role': 'user',
            'content': 'Language: $language\nQuestion: $qText\nOptions:\n$opts\nGive a hint.'
          },
        ],
      );

      final data = _groq.safeParseJson(result);
      return data?['hint'] ?? 'Piense en la regla general.';
    } catch (e) {
      throw AppDataException('AI Hint error: $e');
    }
  }

  Future<String> getExplanation({
    required String questionId,
    required String language,
    required int selectedIdx,
    Map<String, dynamic>? questionData,
  }) async {
    if (questionData == null) return 'No hay explicación adicional.';

    try {
      final qText = language == 'en'
          ? (questionData['question']['en'] ?? questionData['question']['es'])
          : (questionData['question']['es'] ?? questionData['question']['en']);

      final correctIdx = questionData['correctOptionIdx'] as int? ?? 0;
      final helpHtml = questionData['metadata']?['helpText']?.toString() ?? '';

      final opts = (questionData['options'] as List)
          .asMap()
          .entries
          .map((e) {
            final label = ['A', 'B', 'C', 'D'][e.key];
            final text = language == 'en' ? e.value['text_en'] : e.value['text_es'];
            final mark = e.key == correctIdx ? ' ✅ CORRECT' : e.key == selectedIdx ? ' ❌ SELECTED' : '';
            return '$label) $text$mark';
          })
          .join('\n');

      const systemPrompt = '''
You are a friendly Spanish DGT driving theory tutor.
A student just answered a question. Explain clearly WHY the correct answer is right
and why the wrong answers are wrong. Use the student's language.

Return JSON:
{
  "summary": "one-sentence verdict (correct/incorrect + why)",
  "correct_explanation": "why the correct answer is right (2-3 sentences)",
  "wrong_explanation": "why the chosen answer is wrong (if applicable, 1-2 sentences)",
  "memory_tip": "a memorable tip or mnemonic to remember this rule",
  "law_reference": "optional: relevant DGT regulation or article (string or null)"
}
Return ONLY valid JSON.
''';

      final result = await _groq.chatCompletion(
        useFastModel: true,
        messages: [
          {'role': 'system', 'content': systemPrompt},
          {
            'role': 'user',
            'content': [
              'Language: $language',
              'Question: $qText',
              'Options:\n$opts',
              'Manual Reference: $helpHtml',
              'Student chose: ${['A', 'B', 'C', 'D'][selectedIdx]}',
              'Correct answer: ${['A', 'B', 'C', 'D'][correctIdx]}',
              'Explain.'
            ].join('\n')
          },
        ],
      );

      final data = _groq.safeParseJson(result);
      if (data == null) return 'Error parsing explanation.';

      final sText = data['summary'] ?? '';
      final cText = data['correct_explanation'] ?? '';
      final wText = data['wrong_explanation'] != null ? '\n\n${data['wrong_explanation']}' : '';
      final mText = data['memory_tip'] != null ? '\n\n💡 Tip: ${data['memory_tip']}' : '';

      return '$sText\n\n$cText$wText$mText';
    } catch (e) {
      throw AppDataException('AI Explanation error: $e');
    }
  }

  Future<Map<String, dynamic>> getCoachFeedback({
    required String sessionId,
    required String language,
    Map<String, dynamic>? examSummary,
  }) async {
    try {
      const systemPrompt = '''
You are an expert DGT driving theory coach reviewing a student's exam.
Analyze their performance and give personalized, actionable feedback.

Return JSON:
{
  "verdict": "passed" | "failed" | "close",
  "headline": "one bold motivational headline in user's language",
  "summary": "2-3 sentences summarizing performance in user's language",
  "strengths": ["list of 1-2 strong topics/patterns (strings)"],
  "weaknesses": ["list of 1-3 specific areas to improve (strings)"],
  "next_step": "one concrete recommended next action in user's language",
  "priority_topics": ["Spanish tag values to study next", ...],
  "confidence_boost": "one short motivational quote in user's language"
}
Return ONLY valid JSON.
''';

      final result = await _groq.chatCompletion(
        messages: [
          {'role': 'system', 'content': systemPrompt},
          {
            'role': 'user',
            'content': 'Language: $language\nExam Results:\n${jsonEncode(examSummary)}\nGenerate coach feedback.'
          },
        ],
      );

      final data = _groq.safeParseJson(result);
      return data ?? {'headline': 'Keep going!', 'summary': 'Continue practicing for better results.'};
    } catch (e) {
      throw AppDataException('AI Coach error: $e');
    }
  }

  Future<Map<String, dynamic>> getStudyPlan({
    required String targetDate,
    int dailyMinutes = 30,
    String language = 'es',
    Map<String, dynamic>? skillProfile,
  }) async {
    try {
      final daysUntilExam = DateTime.parse(targetDate).difference(DateTime.now()).inDays;

      final prompt = '''
You are a DGT Spanish driving exam coach. Create a personalized study plan.
Student profile:
- Skill Data: ${jsonEncode(skillProfile)}
- Days until exam: $daysUntilExam
- Daily study time: $dailyMinutes minutes

Return JSON:
{
  "summary": "2-sentence overview of plan and goal",
  "estimated_pass_ready": "ISO date string when user should be ready, or null",
  "weeks": [
    {
      "week_number": 1,
      "theme": "theme name",
      "focus_topics": ["Tag1", "Tag2"],
      "exam_modes": ["official", "weak_topics"],
      "milestone_target": "specific goal"
    }
  ],
  "daily_tip": "one habit"
}
Language: $language. Return ONLY valid JSON.
''';

      final result = await _groq.chatCompletion(
        messages: [{'role': 'user', 'content': prompt}],
      );

      final data = _groq.safeParseJson(result);
      if (data == null) throw AppDataException('Study plan parsing failed.');

      // Format for UI (we used 'recommendations' in the screen previously, matching dashboard_tab.dart expectations)
      final summary = data['summary'] ?? '';
      final tip = data['daily_tip'] ?? '';
      final weeksCount = (data['weeks'] as List?)?.length ?? 0;

      return {
        'recommendations': '$summary\n\nPlan for $weeksCount weeks:\n$tip\n\nGood luck!'
      };
    } catch (e) {
      throw AppDataException('AI Study Plan error: $e');
    }
  }

  Future<Map<String, dynamic>> getMistakePatterns({
    String language = 'es',
    List<Map<String, dynamic>>? mistakeGroups,
  }) async {
    try {
      final groupsText = jsonEncode(mistakeGroups);

      final prompt = '''
You are a DGT Spanish driving exam expert. Analyze these mistake patterns and identify conceptual knowledge gaps.
Data: $groupsText

Return JSON:
{
  "patterns": [
    {
      "concept": "concept name",
      "root_cause": "why user gets it wrong",
      "fix_strategy": "how to study it"
    }
  ],
  "priority_fix": "the most impactful fix",
  "study_tip": "one tip"
}
Language: $language. Return ONLY valid JSON.
''';

      final result = await _groq.chatCompletion(
        messages: [{'role': 'user', 'content': prompt}],
      );

      final data = _groq.safeParseJson(result);
      if (data == null) throw AppDataException('Mistake analysis parsing failed.');

      final priority = data['priority_fix'] ?? '';
      final tip = data['study_tip'] ?? '';
      final patternsList = (data['patterns'] as List?)
              ?.map((p) => "- ${p['concept']}: ${p['root_cause']}")
              .join('\n') ??
          '';

      return {
        'analysis': 'Priority: $priority\n\nDetected Patterns:\n$patternsList\n\nStudy Tip: $tip'
      };
    } catch (e) {
      throw AppDataException('AI Mistake Analysis error: $e');
    }
  }
}
