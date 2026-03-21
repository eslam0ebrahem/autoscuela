import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mongo_dart/mongo_dart.dart' as mongo;

import '../../../core/database/data_exception.dart';
import '../../../core/database/mongo_database_service.dart';
import '../../../core/database/mongo_helpers.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../../core/utils/study_engine.dart';
import '../../dashboard/domain/dashboard_models.dart';
import '../domain/exam_models.dart';

final examRepositoryProvider = Provider<ExamRepository>((ref) {
  return ExamRepository(
    databaseService: ref.watch(mongoDatabaseServiceProvider),
    secureStorage: ref.watch(secureStorageProvider),
  );
});

class ExamRepository {
  ExamRepository({
    required MongoDatabaseService databaseService,
    required SecureStorageService secureStorage,
  }) : _databaseService = databaseService,
       _secureStorage = secureStorage;

  final MongoDatabaseService _databaseService;
  final SecureStorageService _secureStorage;

  // In-memory cache for questions to avoid heavy fetches on every exam start
  List<Map<String, dynamic>>? _questionsCache;
  DateTime? _cacheTime;

  Future<String> startExam({
    required String mode,
    required String assistanceMode,
    required int numQuestions,
    List<String> topicFilters = const [],
  }) async {
    final userId = tryParseObjectId(await _secureStorage.readCurrentUserId());
    if (userId == null) {
      throw const AppDataException('Please log in first.');
    }

    debugPrint('StartExam: Acquiring collections...');
    final db = await _databaseService.database;
    final users = db.collection('users');
    final answersCollection = db.collection('useranswers');
    final questionsCollection = db.collection('questions');
    final sessionsCollection = db.collection('examsessions');
    final flashcardCollection = db.collection('flashcardprogresses');

    // Use cache if available and not older than 10 minutes
    final now = DateTime.now();
    bool useQuestionsCache =
        _questionsCache != null &&
        _cacheTime != null &&
        now.difference(_cacheTime!) < const Duration(minutes: 10);

    debugPrint(
      'StartExam: Fetching user ${userId.oid} and data... (Cache: $useQuestionsCache)',
    );

    // We wrap the initial heavy queries in a retry to handle "reset by peer"
    Map<String, dynamic>? user;
    List<Map<String, dynamic>> answers = [];
    List<Map<String, dynamic>> candidatesRaw = [];

    for (int i = 0; i < 2; i++) {
      try {
        final futures = <Future>[
          users.findOne(mongo.where.id(userId)),
          answersCollection.find(mongo.where.eq('userId', userId)).toList(),
        ];

        if (!useQuestionsCache) {
          futures.add(
            questionsCollection
                .find(
                  mongo.where.eq('isActive', true).fields([
                    '_id',
                    'topic_tag',
                    'difficulty',
                  ]),
                )
                .toList(),
          );
        }

        final results = await Future.wait(futures);

        user = results[0] as Map<String, dynamic>?;
        answers = (results[1] as List)
            .map((e) => Map<String, dynamic>.from(e))
            .toList();

        if (!useQuestionsCache) {
          candidatesRaw = (results[2] as List)
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
          // Update cache
          _questionsCache = candidatesRaw;
          _cacheTime = now;
        } else {
          candidatesRaw = _questionsCache!;
        }
        break;
      } catch (e) {
        debugPrint(
          'StartExam: Retryable error in initial fetch (attempt ${i + 1}): $e',
        );
        if (i == 1) rethrow;
        await Future.delayed(const Duration(seconds: 1));
        // Force a database refresh for the next attempt
        await _databaseService.database;
      }
    }

    if (user == null) {
      throw const AppDataException('User not found.');
    }

    final bookmarkIds =
        (((user['bookmarkedQuestions'] as List?) ?? const <dynamic>[]))
            .whereType<mongo.ObjectId>()
            .map((id) => id.oid)
            .toSet();

    debugPrint(
      'StartExam: User found, candidates: ${candidatesRaw.length}, answers: ${answers.length}',
    );
    var candidates = candidatesRaw
        .map((question) => Map<String, dynamic>.from(question))
        .toList();

    if (topicFilters.isNotEmpty) {
      candidates = candidates
          .where(
            (question) => topicFilters.contains(
              ((question['topic_tag'] as Map?)?['es'] ?? '').toString(),
            ),
          )
          .toList();
    }

    if (mode == 'bookmarks') {
      candidates = candidates
          .where(
            (question) =>
                bookmarkIds.contains(objectIdToString(question['_id'])),
          )
          .toList();
    }

    if (mode == 'mistakes') {
      final lastByQuestion = <String, Map<String, dynamic>>{};
      for (final answer in answers) {
        lastByQuestion[objectIdToString(answer['questionId'])] =
            Map<String, dynamic>.from(answer);
      }
      final unresolved = lastByQuestion.values
          .where((answer) => answer['is_correct'] == false)
          .map((answer) => objectIdToString(answer['questionId']))
          .toSet();
      candidates = candidates
          .where(
            (question) =>
                unresolved.contains(objectIdToString(question['_id'])),
          )
          .toList();
    }

    if (mode == 'spaced_repetition') {
      final flashcardProgress = await flashcardCollection
          .find(mongo.where.eq('userId', userId))
          .toList();
      final latestByQuestion = <String, Map<String, dynamic>>{};
      for (final answer in answers) {
        final questionId = objectIdToString(answer['questionId']);
        final createdAt =
            parseDate(answer['createdAt']) ??
            DateTime.fromMillisecondsSinceEpoch(0);
        final previous = latestByQuestion[questionId];
        final previousDate =
            parseDate(previous?['createdAt']) ??
            DateTime.fromMillisecondsSinceEpoch(0);
        if (previous == null || createdAt.isAfter(previousDate)) {
          latestByQuestion[questionId] = Map<String, dynamic>.from(answer);
        }
      }
      final dueIds =
          latestByQuestion.values
              .where((answer) {
                final nextReview = parseDate(
                  (answer['srs'] as Map?)?['nextReviewAt'],
                );
                return nextReview != null &&
                    !nextReview.isAfter(DateTime.now().toUtc());
              })
              .map((answer) => objectIdToString(answer['questionId']))
              .toSet()
            ..addAll(
              flashcardProgress
                  .where((item) {
                    final nextReview = parseDate(item['nextReviewDate']);
                    return nextReview != null &&
                        !nextReview.isAfter(DateTime.now().toUtc());
                  })
                  .map((item) => objectIdToString(item['questionId'])),
            );
      candidates = candidates
          .where(
            (question) => dueIds.contains(objectIdToString(question['_id'])),
          )
          .toList();
    }

    if (mode == 'weak_topics' && topicFilters.isEmpty) {
      final weakTopics =
          computeTopicStats(
                answers
                    .map((answer) => Map<String, dynamic>.from(answer))
                    .toList(),
              )
              .take(3)
              .map((topic) => ((topic['tag'] as Map)['es']).toString())
              .toSet();
      candidates = candidates
          .where(
            (question) => weakTopics.contains(
              ((question['topic_tag'] as Map?)?['es'] ?? '').toString(),
            ),
          )
          .toList();
    }

    if (candidates.isEmpty) {
      throw const AppDataException('No questions available for this mode.');
    }

    final scored = scoreQuestions(
      candidates: candidates,
      answers: answers
          .map((answer) => Map<String, dynamic>.from(answer))
          .toList(),
      mode: mode,
    );
    final questionById = {
      for (final question in candidates)
        objectIdToString(question['_id']): question,
    };

    final totalQuestions = mode == 'official' ? 30 : numQuestions;
    final selectedQuestions =
        scored
            .map((score) => questionById[score.id])
            .whereType<Map<String, dynamic>>()
            .take(totalQuestions)
            .toList()
          ..shuffle(Random());

    final creationTime = DateTime.now().toUtc();
    final session = <String, dynamic>{
      '_id': mongo.ObjectId(),
      'userId': userId,
      'mode': mode,
      'status': 'in_progress',
      'language': ((user['preferences'] as Map?)?['language'] ?? 'es')
          .toString(),
      'topicFilters': topicFilters,
      'assistanceMode': assistanceMode == 'instant' ? 'instant' : 'exam',
      'questionIds': selectedQuestions
          .map((question) => question['_id'] as mongo.ObjectId)
          .toList(),
      'answers': <Map<String, dynamic>>[],
      'currentQuestionIndex': 0,
      'expiresAt': mode == 'official'
          ? creationTime.add(const Duration(minutes: 30))
          : null,
      'createdAt': creationTime,
      'updatedAt': creationTime,
    };

    await sessionsCollection.insertOne(session);
    return objectIdToString(session['_id']);
  }

  Future<ExamSessionBundle> fetchSession(String sessionId) async {
    final userId = tryParseObjectId(await _secureStorage.readCurrentUserId());
    final parsedSessionId = tryParseObjectId(sessionId);
    if (userId == null || parsedSessionId == null) {
      throw const AppDataException('Invalid session.');
    }

    final sessionsCollection = await _databaseService.examSessions;
    final questionsCollection = await _databaseService.questions;

    final session = await sessionsCollection.findOne(
      mongo.where.id(parsedSessionId).eq('userId', userId),
    );
    if (session == null) {
      throw const AppDataException('Session not found.');
    }

    final questionIds =
        (((session['questionIds'] as List?) ?? const <dynamic>[]))
            .whereType<mongo.ObjectId>()
            .toList();
    final questions = await questionsCollection
        .find(mongo.where.oneFrom('_id', questionIds))
        .toList();
    final questionById = {
      for (final question in questions)
        objectIdToString(question['_id']): Map<String, dynamic>.from(question),
    };
    final orderedQuestions = questionIds
        .map((id) => questionById[id.oid])
        .whereType<Map<String, dynamic>>()
        .map(
          (question) => publicQuestionMap(
            question,
            includeSolution: session['status'] == 'completed',
          ),
        )
        .map(ExamQuestion.fromJson)
        .toList();

    final answers = (((session['answers'] as List?) ?? const <dynamic>[]))
        .map((answer) => Map<String, dynamic>.from(answer as Map))
        .map(
          (answer) => <String, dynamic>{
            'questionId': objectIdToString(answer['questionId']),
            'selectedOptionIdx':
                (answer['selectedOptionIdx'] as num?)?.toInt() ?? 0,
            'isCorrect': answer['isCorrect'] == true,
            'timeTakenSeconds':
                (answer['timeTakenSeconds'] as num?)?.toInt() ?? 0,
          },
        )
        .toList();

    return ExamSessionBundle(
      session: ExamSessionInfo.fromJson({
        'id': objectIdToString(session['_id']),
        'mode': session['mode'],
        'status': session['status'],
        'language': session['language'],
        'assistanceMode': session['assistanceMode'],
        'currentQuestionIndex': session['currentQuestionIndex'],
        'answers': answers,
        'score': session['score'],
        'passed': session['passed'],
      }),
      questions: orderedQuestions,
    );
  }

  Future<ExamAnswerFeedback> submitAnswer({
    required String sessionId,
    required String questionId,
    required int selectedOptionIdx,
    required int timeTakenSeconds,
  }) async {
    final userId = tryParseObjectId(await _secureStorage.readCurrentUserId());
    final parsedSessionId = tryParseObjectId(sessionId);
    final parsedQuestionId = tryParseObjectId(questionId);
    if (userId == null || parsedSessionId == null || parsedQuestionId == null) {
      throw const AppDataException('Invalid answer payload.');
    }

    final sessionsCollection = await _databaseService.examSessions;
    final questionsCollection = await _databaseService.questions;
    final answersCollection = await _databaseService.userAnswers;

    final session = await sessionsCollection.findOne(
      mongo.where
          .id(parsedSessionId)
          .eq('userId', userId)
          .eq('status', 'in_progress'),
    );
    if (session == null) {
      throw const AppDataException('Active session not found.');
    }

    final questionIds =
        (((session['questionIds'] as List?) ?? const <dynamic>[]))
            .whereType<mongo.ObjectId>()
            .map((id) => id.oid)
            .toList();
    if (!questionIds.contains(parsedQuestionId.oid)) {
      throw const AppDataException('Question does not belong to this session.');
    }

    final answers = (((session['answers'] as List?) ?? const <dynamic>[]))
        .map((answer) => Map<String, dynamic>.from(answer as Map))
        .toList();
    if (answers.any(
      (answer) =>
          objectIdToString(answer['questionId']) == parsedQuestionId.oid,
    )) {
      throw const AppDataException('Question already answered.');
    }

    final expiresAt = parseDate(session['expiresAt']);
    if (expiresAt != null && expiresAt.isBefore(DateTime.now().toUtc())) {
      throw const AppDataException('This exam session has expired.');
    }

    final question = await questionsCollection.findOne(
      mongo.where.id(parsedQuestionId),
    );
    if (question == null) {
      throw const AppDataException('Question not found.');
    }

    final isCorrect =
        (question['correct_option_idx'] as num?)?.toInt() == selectedOptionIdx;
    answers.add({
      'questionId': parsedQuestionId,
      'selectedOptionIdx': selectedOptionIdx,
      'isCorrect': isCorrect,
      'timeTakenSeconds': timeTakenSeconds,
      'flagged': false,
      'topicTag': question['topic_tag'],
    });

    final now = DateTime.now().toUtc();
    await sessionsCollection.updateOne(
      mongo.where.id(parsedSessionId),
      mongo.modify
          .set('answers', answers)
          .set('currentQuestionIndex', answers.length)
          .set('updatedAt', now),
    );

    await answersCollection.insertOne({
      '_id': mongo.ObjectId(),
      'userId': userId,
      'examSessionId': parsedSessionId,
      'questionId': parsedQuestionId,
      'topic_tag': question['topic_tag'],
      'selected_option_idx': selectedOptionIdx,
      'is_correct': isCorrect,
      'time_taken_seconds': timeTakenSeconds,
      'srs': calculateSrs(
        null,
        isCorrect: isCorrect,
        timeTakenSeconds: timeTakenSeconds,
      ),
      'createdAt': now,
      'updatedAt': now,
    });

    await questionsCollection.updateOne(
      mongo.where.id(parsedQuestionId),
      mongo.modify
          .inc('stats.timesAnswered', 1)
          .inc('stats.timesCorrect', isCorrect ? 1 : 0),
    );

    return ExamAnswerFeedback(
      isCorrect: isCorrect,
      correctOptionIdx: session['assistanceMode'] == 'instant'
          ? (question['correct_option_idx'] as num?)?.toInt()
          : null,
      explanation: session['assistanceMode'] == 'instant'
          ? 'La respuesta correcta es "${_correctOptionLabel(question)}". ${stripHtml(((question['metadata'] as Map?)?['help_html']))}'
          : null,
      helpText: session['assistanceMode'] == 'instant'
          ? stripHtml(((question['metadata'] as Map?)?['help_html']))
          : null,
    );
  }

  Future<ExamResultViewData> submitExam(String sessionId) async {
    final userId = tryParseObjectId(await _secureStorage.readCurrentUserId());
    final parsedSessionId = tryParseObjectId(sessionId);
    if (userId == null || parsedSessionId == null) {
      throw const AppDataException('Invalid session.');
    }

    final users = await _databaseService.users;
    final sessionsCollection = await _databaseService.examSessions;
    final answersCollection = await _databaseService.userAnswers;
    final flashcardCollection = await _databaseService.flashcardProgress;

    final session = await sessionsCollection.findOne(
      mongo.where
          .id(parsedSessionId)
          .eq('userId', userId)
          .eq('status', 'in_progress'),
    );
    if (session == null) {
      throw const AppDataException('Session not found.');
    }

    final user = await users.findOne(mongo.where.id(userId));
    if (user == null) {
      throw const AppDataException('User not found.');
    }

    final sessionAnswers =
        (((session['answers'] as List?) ?? const <dynamic>[]))
            .map((answer) => Map<String, dynamic>.from(answer as Map))
            .toList();
    final totalQuestions =
        (((session['questionIds'] as List?) ?? const <dynamic>[])).length;
    final correctCount = sessionAnswers
        .where((answer) => answer['isCorrect'] == true)
        .length;
    final errors = totalQuestions - correctCount;
    final passed = errors <= 3;
    final totalTime = sessionAnswers.fold<int>(
      0,
      (sum, answer) =>
          sum + ((answer['timeTakenSeconds'] as num?)?.toInt() ?? 0),
    );
    final accuracy = totalQuestions == 0
        ? 0
        : ((correctCount / totalQuestions) * 100).round();
    final topicBreakdownMaps = computeTopicStats(sessionAnswers);
    final coachFeedbackMap = buildCoachFeedback(
      accuracy: accuracy,
      passed: passed,
      weakTopics: topicBreakdownMaps
          .take(3)
          .map((item) => Map<String, dynamic>.from(item))
          .toList(),
    );

    final now = DateTime.now().toUtc();
    await sessionsCollection.updateOne(
      mongo.where.id(parsedSessionId),
      mongo.modify
          .set('status', 'completed')
          .set('score', correctCount)
          .set('errorCount', errors)
          .set('passed', passed)
          .set('completedAt', now)
          .set('totalTimeTakenSeconds', totalTime)
          .set('topicBreakdown', topicBreakdownMaps)
          .set('coachFeedback', coachFeedbackMap)
          .set('updatedAt', now),
    );

    final allAnswers = await answersCollection
        .find(mongo.where.eq('userId', userId))
        .toList();
    final correctAnswers = allAnswers
        .where(
          (answer) =>
              answer['is_correct'] == true || answer['isCorrect'] == true,
        )
        .length;
    final overallAccuracy = allAnswers.isEmpty
        ? 0
        : ((correctAnswers / allAnswers.length) * 100).round();

    final userMap = Map<String, dynamic>.from(user);
    final gamification = gamificationMap(userMap);
    final stats = statsMap(userMap);
    var newStreak = (gamification['currentStreak'] as num?)?.toInt() ?? 0;
    if (shouldBreakStreak(parseDate(gamification['lastStudyDate']), now)) {
      newStreak = 1;
    } else if (!isSameStudyDay(parseDate(gamification['lastStudyDate']), now)) {
      newStreak += 1;
    }

    final todayQuestionCount = allAnswers.where((answer) {
      return isSameStudyDay(parseDate(answer['createdAt']), now);
    }).length;

    final examLanguages = readExamLanguages(userMap);
    final sessionLanguage = (session['language'] ?? 'es').toString();
    if (!examLanguages.contains(sessionLanguage)) {
      examLanguages.add(sessionLanguage);
    }

    final masteredFlashcards = await flashcardCollection
        .find(mongo.where.eq('userId', userId).eq('status', 'mastered'))
        .length;

    final xpEarned = (passed ? 10 : 5) + (accuracy >= 90 ? 10 : 0);
    final totalXp =
        ((gamification['totalXP'] as num?)?.toInt() ?? 0) + xpEarned;
    final updatedWeeklyXp = effectiveWeeklyXp(userMap, now) + xpEarned;
    final newBadges = determineNewBadges(
      user: userMap,
      totalAnswered: allAnswers.length,
      questionsToday: todayQuestionCount,
      currentStreak: newStreak,
      totalXp: totalXp,
      perfectOfficialExam:
          session['mode'] == 'official' && correctCount == totalQuestions,
      masteredFlashcards: masteredFlashcards,
      examLanguages: examLanguages,
    );

    final updatedEarnedBadges = <String>{
      ...readEarnedBadgeIds(userMap),
      ...newBadges,
    }.toList();

    final skillLevel = calculateSkillLevel(
      totalAnswered: allAnswers.length,
      overallAccuracy: overallAccuracy,
    );
    final readinessScore = calculateReadinessScore(
      totalAnswered: allAnswers.length,
      overallAccuracy: overallAccuracy,
      currentStreak: newStreak,
    );
    final weakTopics = computeTopicStats(
      allAnswers.map((answer) => Map<String, dynamic>.from(answer)).toList(),
    ).take(3).map((topic) => ((topic['tag'] as Map)['es']).toString()).toList();
    final completedExamCount = await sessionsCollection
        .find(mongo.where.eq('userId', userId).eq('status', 'completed'))
        .length;
    final weekStart = startOfCurrentWeekUtc(now);

    await users.updateOne(
      mongo.where.id(userId),
      mongo.modify
          .set('gamification.currentStreak', newStreak)
          .set(
            'gamification.maxStreak',
            max(((gamification['maxStreak'] as num?)?.toInt() ?? 0), newStreak),
          )
          .set('gamification.lastStudyDate', now)
          .set('gamification.examLanguages', examLanguages)
          .set('gamification.earnedBadges', updatedEarnedBadges)
          .set('gamification.weeklyXP', updatedWeeklyXp)
          .set('gamification.weeklyXPResetAt', weekStart)
          .set(
            'gamification.weeklyXPWeekKey',
            weekStart.toIso8601String().substring(0, 10),
          )
          .inc('gamification.totalXP', xpEarned)
          .set('examLanguagesCompleted', examLanguages)
          .set(
            'badges',
            buildLegacyBadgeEntries(updatedEarnedBadges, unlockedAt: now),
          )
          .set('stats.totalQuestionsAnswered', allAnswers.length)
          .set(
            'stats.flashcardsReviewed',
            (stats['flashcardsReviewed'] as num?)?.toInt() ?? 0,
          )
          .set('stats.examsCompleted', completedExamCount)
          .set('skillProfile.overallLevel', skillLevel)
          .set('skillProfile.lastCalculatedAt', now)
          .set('aiInsights.readinessScore', readinessScore)
          .set('aiInsights.weakTopics', weakTopics)
          .set('aiInsights.coachMessage', coachFeedbackMap['summary'])
          .set('aiInsights.recommendedAction', coachFeedbackMap['focus'])
          .set('aiInsights.lastUpdated', now)
          .set('updatedAt', now),
    );

    return ExamResultViewData(
      score: correctCount,
      total: totalQuestions,
      errors: errors,
      passed: passed,
      accuracy: accuracy,
      xpEarned: xpEarned,
      newStreak: newStreak,
      totalTimeSeconds: totalTime,
      readinessScore: readinessScore,
      newBadges: newBadges.map((badgeId) {
        final metadata = badgeCatalog[badgeId] ?? const <String, String>{};
        return BadgeSummary(
          id: badgeId,
          title: metadata['title'] ?? badgeId,
          description: metadata['description'] ?? '',
        );
      }).toList(),
      topicBreakdown: topicBreakdownMaps
          .map((item) => TopicPerformance.fromJson(item))
          .toList(),
      coachFeedback: CoachFeedback.fromJson(coachFeedbackMap),
    );
  }

  String _correctOptionLabel(Map<String, dynamic> question) {
    final options = ((question['options'] as List?) ?? const <dynamic>[])
        .map((item) => Map<String, dynamic>.from(item as Map))
        .toList();
    final idx = (question['correct_option_idx'] as num?)?.toInt();
    final correctOption = options.firstWhere(
      (option) => (option['idx'] as num?)?.toInt() == idx,
      orElse: () => const <String, dynamic>{},
    );
    return correctOption['text_es']?.toString() ??
        correctOption['text_en']?.toString() ??
        '';
  }
}
