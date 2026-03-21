import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mongo_dart/mongo_dart.dart' as mongo;

import '../../../core/database/data_exception.dart';
import '../../../core/database/mongo_database_service.dart';
import '../../../core/database/mongo_helpers.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../../core/utils/study_engine.dart';
import '../domain/dashboard_models.dart';

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  return DashboardRepository(
    databaseService: ref.watch(mongoDatabaseServiceProvider),
    secureStorage: ref.watch(secureStorageProvider),
  );
});

final dashboardProvider = FutureProvider<DashboardBundle>((ref) async {
  return ref.watch(dashboardRepositoryProvider).loadDashboard();
});

class DashboardRepository {
  DashboardRepository({
    required MongoDatabaseService databaseService,
    required SecureStorageService secureStorage,
  }) : _databaseService = databaseService,
       _secureStorage = secureStorage;

  final MongoDatabaseService _databaseService;
  final SecureStorageService _secureStorage;

  Future<DashboardBundle> loadDashboard() async {
    final userId = tryParseObjectId(await _secureStorage.readCurrentUserId());
    if (userId == null) {
      throw const AppDataException('Please log in first.');
    }

    final users = await _databaseService.users;
    final answersCollection = await _databaseService.userAnswers;
    final sessionsCollection = await _databaseService.examSessions;

    final user = await users.findOne(mongo.where.id(userId));
    if (user == null) {
      throw const AppDataException('User not found.');
    }

    final answers = await answersCollection
        .find(mongo.where.eq('userId', userId))
        .toList();
    final completedSessions = await sessionsCollection
        .find(mongo.where.eq('userId', userId).eq('status', 'completed'))
        .toList();
    final leaderboardUsers = await users.find().toList();
    final now = DateTime.now().toUtc();

    final correctAnswers = answers
        .where(
          (answer) =>
              answer['is_correct'] == true || answer['isCorrect'] == true,
        )
        .length;
    final accuracy = answers.isEmpty
        ? 0
        : ((correctAnswers / answers.length) * 100).round();
    final currentStreak =
        (((user['gamification'] as Map?)?['currentStreak'] as num?)?.toInt() ??
        0);
    final readinessScore = calculateReadinessScore(
      totalAnswered: answers.length,
      overallAccuracy: accuracy,
      currentStreak: currentStreak,
    );
    final weakTopicMaps = computeTopicStats(
      answers.map((answer) => Map<String, dynamic>.from(answer)).toList(),
    );

    leaderboardUsers.sort((a, b) {
      final aXp = effectiveWeeklyXp(Map<String, dynamic>.from(a), now);
      final bXp = effectiveWeeklyXp(Map<String, dynamic>.from(b), now);
      return bXp.compareTo(aXp);
    });

    final leaderboard = leaderboardUsers.take(10).toList().asMap().entries.map((
      entry,
    ) {
      final item = entry.value;
      return LeaderboardEntry(
        rank: entry.key + 1,
        nickname: item['nickname']?.toString() ?? 'Anonymous',
        weeklyXp: effectiveWeeklyXp(Map<String, dynamic>.from(item), now),
        totalXp:
            (((item['gamification'] as Map?)?['totalXP'] as num?)?.toInt() ??
            0),
        isCurrentUser:
            objectIdToString(item['_id']) == objectIdToString(userId),
      );
    }).toList();
    final fourteenDaysAgo = now.subtract(const Duration(days: 14));
    final groupedTrend = <String, Map<String, dynamic>>{};
    for (final answer in answers) {
      final createdAt = parseDate(answer['createdAt']);
      if (createdAt == null || createdAt.isBefore(fourteenDaysAgo)) {
        continue;
      }

      final key = createdAt.toIso8601String().substring(0, 10);
      final bucket = groupedTrend.putIfAbsent(
        key,
        () => {
          'date': key,
          'questions': 0,
          'correct': 0,
          'timeSpentSeconds': 0,
        },
      );
      bucket['questions'] = (bucket['questions'] as int) + 1;
      if (answer['is_correct'] == true || answer['isCorrect'] == true) {
        bucket['correct'] = (bucket['correct'] as int) + 1;
      }
      bucket['timeSpentSeconds'] =
          (bucket['timeSpentSeconds'] as int) +
          ((answer['time_taken_seconds'] as num?)?.toInt() ?? 0);
    }

    final trend = groupedTrend.values.map((point) {
      final questions = point['questions'] as int;
      final correct = point['correct'] as int;
      final timeSpentSeconds = point['timeSpentSeconds'] as int;
      return TrendPoint(
        date: point['date'] as String,
        questions: questions,
        accuracy: questions == 0 ? 0 : ((correct / questions) * 100).round(),
        minutes: (timeSpentSeconds / 60).round(),
      );
    }).toList()..sort((a, b) => a.date.compareTo(b.date));

    final badges = readEarnedBadgeIds(Map<String, dynamic>.from(user)).map((
      badgeId,
    ) {
      final metadata = badgeCatalog[badgeId] ?? const <String, String>{};
      return BadgeSummary(
        id: badgeId,
        title: metadata['title'] ?? badgeId,
        description: metadata['description'] ?? '',
      );
    }).toList();

    final coachFeedback = CoachFeedback.fromJson(
      buildCoachFeedback(
        accuracy: accuracy,
        passed: completedSessions.any((session) => session['passed'] == true),
        weakTopics: weakTopicMaps
            .take(3)
            .map((item) => Map<String, dynamic>.from(item))
            .toList(),
      ),
    );

    return DashboardBundle(
      readinessScore: readinessScore,
      skillLevel: calculateSkillLevel(
        totalAnswered: answers.length,
        overallAccuracy: accuracy,
      ),
      streak: currentStreak,
      totalAnswered: answers.length,
      accuracy: accuracy,
      totalExams: completedSessions.length,
      passedExams: completedSessions
          .where((session) => session['passed'] == true)
          .length,
      weakTopics: weakTopicMaps
          .take(3)
          .map((item) => TopicPerformance.fromJson(item))
          .toList(),
      leaderboard: leaderboard,
      badges: badges,
      coachFeedback: coachFeedback,
      stats: StatsOverview(
        totalQuestions: answers.length,
        correctAnswers: correctAnswers,
        incorrectAnswers: answers.length - correctAnswers,
        accuracy: accuracy,
        currentStreak: currentStreak,
        totalExams: completedSessions.length,
        passedExams: completedSessions
            .where((session) => session['passed'] == true)
            .length,
        weeklyAccuracyChange: _weeklyAccuracyChange(answers),
        readinessScore: readinessScore,
      ),
      trend: trend,
    );
  }

  int _weeklyAccuracyChange(List<Map<String, dynamic>> answers) {
    final now = DateTime.now().toUtc();
    final sevenDaysAgo = now.subtract(const Duration(days: 7));
    final fourteenDaysAgo = now.subtract(const Duration(days: 14));

    int accuracyForWindow(DateTime start, {DateTime? end}) {
      final inWindow = answers.where((answer) {
        final createdAt = parseDate(answer['createdAt']);
        if (createdAt == null || createdAt.isBefore(start)) {
          return false;
        }
        if (end != null && !createdAt.isBefore(end)) {
          return false;
        }
        return true;
      }).toList();

      if (inWindow.isEmpty) {
        return 0;
      }

      final correct = inWindow
          .where(
            (answer) =>
                answer['is_correct'] == true || answer['isCorrect'] == true,
          )
          .length;
      return ((correct / inWindow.length) * 100).round();
    }

    return accuracyForWindow(sevenDaysAgo) -
        accuracyForWindow(fourteenDaysAgo, end: sevenDaysAgo);
  }
}
