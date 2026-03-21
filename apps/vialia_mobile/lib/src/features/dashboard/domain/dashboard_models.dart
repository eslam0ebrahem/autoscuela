class TopicPerformance {
  const TopicPerformance({
    required this.name,
    required this.nameEn,
    required this.attempted,
    required this.correct,
    required this.accuracy,
    required this.avgTimeSeconds,
  });

  final String name;
  final String nameEn;
  final int attempted;
  final int correct;
  final int accuracy;
  final int avgTimeSeconds;

  factory TopicPerformance.fromJson(Map<String, dynamic> json) {
    final tag = Map<String, dynamic>.from(
      (json['tag'] as Map?)?.cast<String, dynamic>() ?? {},
    );
    return TopicPerformance(
      name: tag['es']?.toString() ?? json['topic']?.toString() ?? 'General',
      nameEn: tag['en']?.toString() ?? json['topicEn']?.toString() ?? 'General',
      attempted: (json['attempted'] as num?)?.toInt() ?? 0,
      correct: (json['correct'] as num?)?.toInt() ?? 0,
      accuracy: (json['accuracy'] as num?)?.toInt() ?? 0,
      avgTimeSeconds: (json['avgTimeSeconds'] as num?)?.toInt() ?? 0,
    );
  }
}

class LeaderboardEntry {
  const LeaderboardEntry({
    required this.rank,
    required this.nickname,
    required this.weeklyXp,
    required this.totalXp,
    required this.isCurrentUser,
  });

  final int rank;
  final String nickname;
  final int weeklyXp;
  final int totalXp;
  final bool isCurrentUser;

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) {
    return LeaderboardEntry(
      rank: (json['rank'] as num?)?.toInt() ?? 0,
      nickname: json['nickname']?.toString() ?? 'Anonymous',
      weeklyXp: (json['weeklyXP'] as num?)?.toInt() ?? 0,
      totalXp: (json['totalXP'] as num?)?.toInt() ?? 0,
      isCurrentUser: json['isCurrentUser'] == true,
    );
  }
}

class BadgeSummary {
  const BadgeSummary({
    required this.id,
    required this.title,
    required this.description,
    this.earned = true,
  });

  final String id;
  final String title;
  final String description;
  final bool earned;

  factory BadgeSummary.fromJson(Map<String, dynamic> json) {
    return BadgeSummary(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      earned: json['earned'] != false,
    );
  }
}

class CoachFeedback {
  const CoachFeedback({
    required this.headline,
    required this.summary,
    required this.focus,
    required this.confidence,
    this.trend,
    this.improvementPct,
    this.consistencyScore,
  });

  final String headline;
  final String summary;
  final String focus;
  final String confidence;
  final String? trend;
  final double? improvementPct;
  final int? consistencyScore;

  factory CoachFeedback.fromJson(Map<String, dynamic> json) {
    return CoachFeedback(
      headline: json['headline']?.toString() ?? '',
      summary: json['summary']?.toString() ?? '',
      focus: json['focus']?.toString() ?? '',
      confidence: json['confidence']?.toString() ?? 'medium',
      trend: json['trend']?.toString(),
      improvementPct: (json['improvementPct'] as num?)?.toDouble(),
      consistencyScore: (json['consistencyScore'] as num?)?.toInt(),
    );
  }

  Map<String, dynamic> toJson() => {
        'headline': headline,
        'summary': summary,
        'focus': focus,
        'confidence': confidence,
        'trend': trend,
        'improvementPct': improvementPct,
        'consistencyScore': consistencyScore,
      };
}

class StatsOverview {
  const StatsOverview({
    required this.totalQuestions,
    required this.correctAnswers,
    required this.incorrectAnswers,
    required this.accuracy,
    required this.currentStreak,
    required this.totalExams,
    required this.passedExams,
    required this.weeklyAccuracyChange,
    required this.readinessScore,
  });

  final int totalQuestions;
  final int correctAnswers;
  final int incorrectAnswers;
  final int accuracy;
  final int currentStreak;
  final int totalExams;
  final int passedExams;
  final int weeklyAccuracyChange;
  final int readinessScore;

  factory StatsOverview.fromJson(Map<String, dynamic> json) {
    return StatsOverview(
      totalQuestions: (json['totalQuestions'] as num?)?.toInt() ?? 0,
      correctAnswers: (json['correctAnswers'] as num?)?.toInt() ?? 0,
      incorrectAnswers: (json['incorrectAnswers'] as num?)?.toInt() ?? 0,
      accuracy: (json['accuracy'] as num?)?.toInt() ?? 0,
      currentStreak: (json['currentStreak'] as num?)?.toInt() ?? 0,
      totalExams: (json['totalExams'] as num?)?.toInt() ?? 0,
      passedExams: (json['passedExams'] as num?)?.toInt() ?? 0,
      weeklyAccuracyChange:
          (json['weeklyAccuracyChange'] as num?)?.toInt() ?? 0,
      readinessScore: (json['readinessScore'] as num?)?.toInt() ?? 0,
    );
  }
}

class TrendPoint {
  const TrendPoint({
    required this.date,
    required this.questions,
    required this.accuracy,
    required this.minutes,
  });

  final String date;
  final int questions;
  final int accuracy;
  final int minutes;

  factory TrendPoint.fromJson(Map<String, dynamic> json) {
    return TrendPoint(
      date: json['date']?.toString() ?? '',
      questions: (json['questions'] as num?)?.toInt() ?? 0,
      accuracy: (json['accuracy'] as num?)?.toInt() ?? 0,
      minutes: (json['minutes'] as num?)?.toInt() ?? 0,
    );
  }
}

class DashboardBundle {
  const DashboardBundle({
    required this.readinessScore,
    required this.skillLevel,
    required this.streak,
    required this.totalAnswered,
    required this.accuracy,
    required this.totalExams,
    required this.passedExams,
    required this.weakTopics,
    required this.leaderboard,
    required this.badges,
    required this.coachFeedback,
    required this.stats,
    required this.trend,
  });

  final int readinessScore;
  final String skillLevel;
  final int streak;
  final int totalAnswered;
  final int accuracy;
  final int totalExams;
  final int passedExams;
  final List<TopicPerformance> weakTopics;
  final List<LeaderboardEntry> leaderboard;
  final List<BadgeSummary> badges;
  final CoachFeedback coachFeedback;
  final StatsOverview stats;
  final List<TrendPoint> trend;
}
