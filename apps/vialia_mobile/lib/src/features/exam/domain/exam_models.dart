import '../../dashboard/domain/dashboard_models.dart';

class TopicTag {
  const TopicTag({required this.es, required this.en});

  final String es;
  final String en;

  factory TopicTag.fromJson(Map<String, dynamic> json) {
    return TopicTag(
      es: json['es']?.toString() ?? 'General',
      en: json['en']?.toString() ?? 'General',
    );
  }

  Map<String, dynamic> toJson() => {'es': es, 'en': en};
}

class QuestionOption {
  const QuestionOption({
    required this.idx,
    required this.textEs,
    required this.textEn,
  });

  final int idx;
  final String textEs;
  final String textEn;

  factory QuestionOption.fromJson(Map<String, dynamic> json) {
    return QuestionOption(
      idx: (json['idx'] as num?)?.toInt() ?? 0,
      textEs: json['text_es']?.toString() ?? '',
      textEn: json['text_en']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() => {
        'idx': idx,
        'text_es': textEs,
        'text_en': textEn,
      };
}

class ExamQuestion {
  const ExamQuestion({
    required this.id,
    required this.questionEs,
    required this.questionEn,
    required this.options,
    required this.topicTag,
    required this.difficulty,
    required this.helpText,
    this.imageUrl,
    this.correctOptionIdx,
  });

  final String id;
  final String questionEs;
  final String questionEn;
  final List<QuestionOption> options;
  final TopicTag topicTag;
  final String difficulty;
  final String helpText;
  final String? imageUrl;
  final int? correctOptionIdx;

  factory ExamQuestion.fromJson(Map<String, dynamic> json) {
    final question = Map<String, dynamic>.from(
      (json['question'] as Map?)?.cast<String, dynamic>() ?? {},
    );
    final metadata = Map<String, dynamic>.from(
      (json['metadata'] as Map?)?.cast<String, dynamic>() ?? {},
    );
    return ExamQuestion(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      questionEs: question['es']?.toString() ?? '',
      questionEn: question['en']?.toString() ?? '',
      options: (json['options'] as List? ?? const [])
          .map(
            (item) =>
                QuestionOption.fromJson(Map<String, dynamic>.from(item as Map)),
          )
          .toList(),
      topicTag: TopicTag.fromJson(
        Map<String, dynamic>.from(
          (json['topicTag'] as Map?)?.cast<String, dynamic>() ?? {},
        ),
      ),
      difficulty: json['difficulty']?.toString() ?? 'medium',
      helpText: metadata['helpText']?.toString() ?? '',
      imageUrl: metadata['imageUrl']?.toString(),
      correctOptionIdx: (json['correctOptionIdx'] as num?)?.toInt(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'question': {'es': questionEs, 'en': questionEn},
        'options': options.map((o) => o.toJson()).toList(),
        'topicTag': topicTag.toJson(),
        'difficulty': difficulty,
        'metadata': {'helpText': helpText, 'imageUrl': imageUrl},
        'correctOptionIdx': correctOptionIdx,
      };

  String questionFor(String language) =>
      language == 'en' ? questionEn : questionEs;

  String optionLabelFor(QuestionOption option, String language) =>
      language == 'en' ? option.textEn : option.textEs;
}

class ExamAnswerRecord {
  const ExamAnswerRecord({
    required this.questionId,
    required this.selectedOptionIdx,
    required this.isCorrect,
    required this.timeTakenSeconds,
  });

  final String questionId;
  final int selectedOptionIdx;
  final bool isCorrect;
  final int timeTakenSeconds;

  factory ExamAnswerRecord.fromJson(Map<String, dynamic> json) {
    return ExamAnswerRecord(
      questionId: json['questionId']?.toString() ?? '',
      selectedOptionIdx: (json['selectedOptionIdx'] as num?)?.toInt() ?? 0,
      isCorrect: json['isCorrect'] == true,
      timeTakenSeconds: (json['timeTakenSeconds'] as num?)?.toInt() ?? 0,
    );
  }
}

class ExamSessionInfo {
  const ExamSessionInfo({
    required this.id,
    required this.mode,
    required this.status,
    required this.language,
    required this.assistanceMode,
    required this.currentQuestionIndex,
    required this.answers,
    this.score,
    this.passed,
  });

  final String id;
  final String mode;
  final String status;
  final String language;
  final String assistanceMode;
  final int currentQuestionIndex;
  final List<ExamAnswerRecord> answers;
  final int? score;
  final bool? passed;

  factory ExamSessionInfo.fromJson(Map<String, dynamic> json) {
    return ExamSessionInfo(
      id: json['id']?.toString() ?? '',
      mode: json['mode']?.toString() ?? 'official',
      status: json['status']?.toString() ?? 'in_progress',
      language: json['language']?.toString() ?? 'es',
      assistanceMode: json['assistanceMode']?.toString() ?? 'exam',
      currentQuestionIndex:
          (json['currentQuestionIndex'] as num?)?.toInt() ?? 0,
      answers: (json['answers'] as List? ?? const [])
          .map(
            (item) => ExamAnswerRecord.fromJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
      score: (json['score'] as num?)?.toInt(),
      passed: json['passed'] as bool?,
    );
  }
}

class ExamSessionBundle {
  const ExamSessionBundle({required this.session, required this.questions});

  final ExamSessionInfo session;
  final List<ExamQuestion> questions;

  factory ExamSessionBundle.fromJson(Map<String, dynamic> json) {
    return ExamSessionBundle(
      session: ExamSessionInfo.fromJson(
        Map<String, dynamic>.from(json['session'] as Map),
      ),
      questions: (json['questions'] as List? ?? const [])
          .map(
            (item) =>
                ExamQuestion.fromJson(Map<String, dynamic>.from(item as Map)),
          )
          .toList(),
    );
  }
}

class ExamAnswerFeedback {
  const ExamAnswerFeedback({
    required this.isCorrect,
    this.correctOptionIdx,
    this.explanation,
    this.helpText,
  });

  final bool isCorrect;
  final int? correctOptionIdx;
  final String? explanation;
  final String? helpText;

  factory ExamAnswerFeedback.fromJson(Map<String, dynamic> json) {
    return ExamAnswerFeedback(
      isCorrect: json['isCorrect'] == true,
      correctOptionIdx: (json['correctOptionIdx'] as num?)?.toInt(),
      explanation: json['explanation']?.toString(),
      helpText: json['helpText']?.toString(),
    );
  }
}

class ExamResultViewData {
  const ExamResultViewData({
    required this.score,
    required this.total,
    required this.errors,
    required this.passed,
    required this.accuracy,
    required this.xpEarned,
    required this.newStreak,
    required this.totalTimeSeconds,
    required this.readinessScore,
    required this.newBadges,
    required this.topicBreakdown,
    required this.coachFeedback,
  });

  final int score;
  final int total;
  final int errors;
  final bool passed;
  final int accuracy;
  final int xpEarned;
  final int newStreak;
  final int totalTimeSeconds;
  final int readinessScore;
  final List<BadgeSummary> newBadges;
  final List<TopicPerformance> topicBreakdown;
  final CoachFeedback coachFeedback;

  factory ExamResultViewData.fromJson(Map<String, dynamic> json) {
    return ExamResultViewData(
      score: (json['score'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toInt() ?? 0,
      errors: (json['errors'] as num?)?.toInt() ?? 0,
      passed: json['passed'] == true,
      accuracy: (json['accuracy'] as num?)?.toInt() ?? 0,
      xpEarned: (json['xpEarned'] as num?)?.toInt() ?? 0,
      newStreak: (json['newStreak'] as num?)?.toInt() ?? 0,
      totalTimeSeconds: (json['totalTimeSeconds'] as num?)?.toInt() ?? 0,
      readinessScore: (json['readinessScore'] as num?)?.toInt() ?? 0,
      newBadges: (json['newBadges'] as List? ?? const [])
          .map(
            (item) =>
                BadgeSummary.fromJson(Map<String, dynamic>.from(item as Map)),
          )
          .toList(),
      topicBreakdown: (json['topicBreakdown'] as List? ?? const [])
          .map(
            (item) => TopicPerformance.fromJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
      coachFeedback: CoachFeedback.fromJson(
        Map<String, dynamic>.from(
          (json['coachFeedback'] as Map?)?.cast<String, dynamic>() ?? {},
        ),
      ),
    );
  }

  Map<String, dynamic> toJson() => {
        'score': score,
        'total': total,
        'errors': errors,
        'passed': passed,
        'accuracy': accuracy,
        'xpEarned': xpEarned,
        'newStreak': newStreak,
        'totalTimeSeconds': totalTimeSeconds,
        'readinessScore': readinessScore,
        'coachFeedback': coachFeedback.toJson(),
      };
}
