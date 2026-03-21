import 'dart:math';

const badgeCatalog = <String, Map<String, String>>{
  'first_gear': {
    'title': 'Primera Marcha',
    'description': 'Completa tu primer examen de practica.',
  },
  'flawless_drive': {
    'title': 'Conduccion Perfecta',
    'description': 'Consigue una puntuacion perfecta en un examen oficial.',
  },
  'bilingual_driver': {
    'title': 'Conductor Bilingue',
    'description': 'Haz examenes en espanol y en ingles.',
  },
  'week_warrior': {
    'title': 'Guerrero Semanal',
    'description': 'Mantiene una racha de 7 dias.',
  },
  'marathoner': {
    'title': 'Maratoniano',
    'description': 'Responde 100 preguntas en un solo dia.',
  },
  'centurion': {
    'title': 'Centurion',
    'description': 'Responde 1000 preguntas en total.',
  },
  'flashcard_master': {
    'title': 'Maestro de Tarjetas',
    'description': 'Domina 100 tarjetas.',
  },
  'thousand_club': {
    'title': 'Club de los Mil',
    'description': 'Consigue 1000 XP.',
  },
};

String _normalizedEntityId(dynamic value) {
  final raw = value?.toString() ?? '';
  if (raw.isEmpty) {
    return '';
  }

  final match = RegExp(r'[0-9a-fA-F]{24}').firstMatch(raw);
  return match?.group(0)?.toLowerCase() ?? raw;
}

bool isSameStudyDay(DateTime? first, DateTime? second) {
  if (first == null || second == null) {
    return false;
  }

  final a = first.toLocal();
  final b = second.toLocal();
  return a.year == b.year && a.month == b.month && a.day == b.day;
}

bool shouldBreakStreak(DateTime? lastStudyDate, DateTime nowUtc) {
  if (lastStudyDate == null) {
    return false;
  }

  final now = nowUtc.toLocal();
  final last = lastStudyDate.toLocal();
  final yesterday = DateTime(now.year, now.month, now.day - 1);
  return last.isBefore(yesterday);
}

int calculateReadinessScore({
  required int totalAnswered,
  required int overallAccuracy,
  required int currentStreak,
}) {
  final accuracyComponent = overallAccuracy * 0.65;
  final volumeComponent = min(20, (totalAnswered / 250) * 20);
  final streakComponent = min(15, currentStreak * 1.5);
  return max(
    5,
    min(99, (accuracyComponent + volumeComponent + streakComponent).round()),
  );
}

String calculateSkillLevel({
  required int totalAnswered,
  required int overallAccuracy,
}) {
  if (totalAnswered >= 200 && overallAccuracy >= 90) {
    return 'expert';
  }
  if (totalAnswered >= 100 && overallAccuracy >= 80) {
    return 'hard';
  }
  if (totalAnswered >= 50 && overallAccuracy >= 65) {
    return 'medium';
  }
  if (totalAnswered >= 20) {
    return 'easy';
  }
  return 'beginner';
}

Map<String, dynamic> calculateSrs(
  Map<String, dynamic>? current, {
  required bool isCorrect,
  required int timeTakenSeconds,
}) {
  final existing = current ?? <String, dynamic>{};
  final repetitions = (existing['repetitions'] as num?)?.toInt() ?? 0;
  final interval = (existing['interval'] as num?)?.toInt() ?? 1;
  final easinessFactor =
      (existing['easinessFactor'] as num?)?.toDouble() ?? 2.5;

  int grade;
  if (!isCorrect) {
    grade = 1;
  } else if (timeTakenSeconds <= 15) {
    grade = 5;
  } else if (timeTakenSeconds <= 30) {
    grade = 4;
  } else {
    grade = 3;
  }

  final updatedEf = max(
    1.3,
    easinessFactor + 0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02),
  );

  late final int nextInterval;
  late final int nextRepetitions;
  if (grade < 3) {
    nextRepetitions = 0;
    nextInterval = 1;
  } else {
    nextRepetitions = repetitions + 1;
    if (nextRepetitions == 1) {
      nextInterval = 1;
    } else if (nextRepetitions == 2) {
      nextInterval = 6;
    } else {
      nextInterval = max(1, (interval * updatedEf).round());
    }
  }

  return <String, dynamic>{
    'easinessFactor': double.parse(updatedEf.toStringAsFixed(2)),
    'interval': nextInterval,
    'repetitions': nextRepetitions,
    'nextReviewAt': DateTime.now().toUtc().add(Duration(days: nextInterval)),
    'lastGrade': grade,
  };
}

List<Map<String, dynamic>> computeTopicStats(
  List<Map<String, dynamic>> answers,
) {
  final topics = <String, Map<String, dynamic>>{};

  for (final answer in answers) {
    final topicMap = Map<String, dynamic>.from(
      (answer['topic_tag'] as Map?)?.cast<String, dynamic>() ??
          (answer['topicTag'] as Map?)?.cast<String, dynamic>() ??
          {'es': 'General', 'en': 'General'},
    );
    final topic = topicMap['es']?.toString() ?? 'General';
    final bucket = topics.putIfAbsent(
      topic,
      () => <String, dynamic>{
        'tag': {'es': topic, 'en': topicMap['en']?.toString() ?? topic},
        'attempted': 0,
        'correct': 0,
        'timeSpentSeconds': 0,
      },
    );

    bucket['attempted'] = (bucket['attempted'] as int) + 1;
    if (answer['is_correct'] == true || answer['isCorrect'] == true) {
      bucket['correct'] = (bucket['correct'] as int) + 1;
    }
    bucket['timeSpentSeconds'] =
        (bucket['timeSpentSeconds'] as int) +
        ((answer['time_taken_seconds'] as num?)?.toInt() ??
            (answer['timeTakenSeconds'] as num?)?.toInt() ??
            0);
  }

  final stats =
      topics.values.map((topic) {
        final attempted = topic['attempted'] as int;
        final correct = topic['correct'] as int;
        final timeSpent = topic['timeSpentSeconds'] as int;
        return <String, dynamic>{
          ...topic,
          'accuracy': attempted == 0
              ? 0
              : ((correct / attempted) * 100).round(),
          'avgTimeSeconds': attempted == 0
              ? 0
              : (timeSpent / attempted).round(),
        };
      }).toList()..sort(
        (a, b) => (a['accuracy'] as int).compareTo(b['accuracy'] as int),
      );

  return stats;
}

Map<String, dynamic> buildCoachFeedback({
  required int accuracy,
  required bool passed,
  required List<Map<String, dynamic>> weakTopics,
}) {
  final focus = weakTopics.isEmpty
      ? 'Repasa los fundamentos generales.'
      : 'Prioriza ${((weakTopics.first['tag'] as Map)['es'])} en la siguiente sesion.';

  return <String, dynamic>{
    'headline': passed
        ? 'Vas por muy buen camino.'
        : 'Todavia hay margen claro de mejora.',
    'summary': passed
        ? 'Tu consistencia ya se parece a un examen real aprobado.'
        : 'Centrate en bajar errores repetidos antes de volver al examen oficial.',
    'focus': focus,
    'confidence': accuracy >= 85
        ? 'high'
        : accuracy >= 65
        ? 'medium'
        : 'low',
  };
}

List<String> determineNewBadges({
  required Map<String, dynamic> user,
  required int totalAnswered,
  required int questionsToday,
  required int currentStreak,
  required int totalXp,
  required bool perfectOfficialExam,
  required int masteredFlashcards,
  required List<String> examLanguages,
}) {
  final earned = <String>{
    ...(((user['gamification'] as Map?)?['earnedBadges'] as List?) ??
            const <dynamic>[])
        .map((badge) => badge.toString()),
    ...(((user['badges'] as List?) ?? const <dynamic>[])
        .map((badge) {
          if (badge is Map) {
            return badge['key'] ?? badge['id'];
          }
          return badge;
        })
        .map((badge) => badge?.toString() ?? '')
        .where((badge) => badge.isNotEmpty)),
  };
  final newBadges = <String>[];

  void award(String badgeId, bool condition) {
    if (condition && !earned.contains(badgeId)) {
      newBadges.add(badgeId);
    }
  }

  award('first_gear', totalAnswered > 0);
  award('flawless_drive', perfectOfficialExam);
  award('bilingual_driver', examLanguages.toSet().length >= 2);
  award('week_warrior', currentStreak >= 7);
  award('marathoner', questionsToday >= 100);
  award('centurion', totalAnswered >= 1000);
  award('flashcard_master', masteredFlashcards >= 100);
  award('thousand_club', totalXp >= 1000);

  return newBadges;
}

List<QuestionScore> scoreQuestions({
  required List<Map<String, dynamic>> candidates,
  required List<Map<String, dynamic>> answers,
  required String mode,
}) {
  final topicStats = computeTopicStats(answers);
  final topicAccuracy = <String, double>{
    for (final stat in topicStats)
      ((stat['tag'] as Map)['es']).toString(): (stat['accuracy'] as int) / 100,
  };

  final recentByQuestion = <String, DateTime>{};
  final wrongCountByQuestion = <String, int>{};
  for (final answer in answers) {
    final id = _normalizedEntityId(answer['questionId']);
    if (id.isEmpty) {
      continue;
    }
    final createdAt = answer['createdAt'] is DateTime
        ? (answer['createdAt'] as DateTime).toUtc()
        : DateTime.tryParse(answer['createdAt']?.toString() ?? '')?.toUtc() ??
              DateTime.now().toUtc();
    final previous = recentByQuestion[id];
    if (previous == null || createdAt.isAfter(previous)) {
      recentByQuestion[id] = createdAt;
    }
    if (answer['is_correct'] == false || answer['isCorrect'] == false) {
      wrongCountByQuestion[id] = (wrongCountByQuestion[id] ?? 0) + 1;
    }
  }

  final correctAnswers = answers
      .where(
        (answer) => answer['is_correct'] == true || answer['isCorrect'] == true,
      )
      .length;
  final accuracy = answers.isEmpty
      ? 0
      : ((correctAnswers / answers.length) * 100).round();

  final difficultyTarget = switch (calculateSkillLevel(
    totalAnswered: answers.length,
    overallAccuracy: accuracy,
  )) {
    'beginner' => 1.2,
    'easy' => 1.5,
    'medium' => 2.0,
    'hard' => 2.4,
    _ => 2.8,
  };

  const difficultyMap = <String, double>{'easy': 1, 'medium': 2, 'hard': 3};

  return candidates.map((question) {
    final id = _normalizedEntityId(question['_id']);
    final topic = ((question['topic_tag'] as Map?)?['es'] ?? 'General')
        .toString();
    final accuracyOnTopic = topicAccuracy[topic] ?? 0.5;
    final weaknessScore = 1 - accuracyOnTopic;
    final difficulty =
        difficultyMap[(question['difficulty'] ?? 'medium').toString()] ?? 2;
    final difficultyScore =
        1 - ((difficulty - difficultyTarget).abs() / 2).clamp(0, 1);
    final recentSeen = recentByQuestion[id];
    final freshnessScore = recentSeen == null
        ? 1
        : min(1, DateTime.now().toUtc().difference(recentSeen).inDays / 10);
    final mistakeBoost = (wrongCountByQuestion[id] ?? 0) * 0.15;

    var score =
        weaknessScore * 0.45 +
        freshnessScore * 0.25 +
        difficultyScore * 0.2 +
        Random().nextDouble() * 0.1;

    if (mode == 'mistakes') {
      score += mistakeBoost + 0.25;
    }
    if (mode == 'weak_topics') {
      score += weaknessScore * 0.2;
    }
    if (mode == 'bookmarks') {
      score += 0.15;
    }

    return QuestionScore(id: id, score: score);
  }).toList()..sort((a, b) => b.score.compareTo(a.score));
}

class QuestionScore {
  QuestionScore({required this.id, required this.score});

  final String id;
  final double score;
}
