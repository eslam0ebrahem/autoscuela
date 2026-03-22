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

  // Cache for the questions of the last created/fetched session
  // This makes the transition from PracticeTab to ExamScreen instant
  List<ExamQuestion>? _lastQuestions;
  String? _lastQuestionsId;
  DateTime? _lastQuestionsTime;

  Future<String> startExam({
    required String mode,
    required String assistanceMode,
    required int numQuestions,
    List<String> topicFilters = const [],
  }) async {
    final sw = Stopwatch()..start();
    final userId = tryParseObjectId(await _secureStorage.readCurrentUserId());
    if (userId == null) {
      throw const AppDataException('Please log in first.');
    }

    debugPrint('StartExam: Acquiring collections...');

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
        final db = await _databaseService.database;
        final usersCol = db.collection('users');
        final answersCol = db.collection('useranswers');
        final questionsCol = db.collection('questions');

        final futures = <Future>[
          // Project only what we need
          usersCol.findOne(mongo.where.id(userId).fields(['bookmarkedQuestions', 'preferences'])),
          // Limit to recent 1000 answers for faster profile building
          answersCol.find(
            mongo.where
              .eq('userId', userId)
              .sortBy('createdAt', descending: true)
              .limit(1000)
              .fields(['questionId', 'is_correct', 'topic_tag', 'time_taken_seconds', 'createdAt', 'srs'])
          ).toList(),
        ];

        if (!useQuestionsCache) {
          futures.add(
            questionsCol
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
        // Use cast/toList instead of expensive Map.from
        answers = (results[1] as List).cast<Map<String, dynamic>>().toList();

        if (!useQuestionsCache) {
          candidatesRaw = (results[2] as List).cast<Map<String, dynamic>>().toList();
          _questionsCache = candidatesRaw;
          _cacheTime = now;
        } else {
          candidatesRaw = _questionsCache!;
        }
        break;
      } catch (e) {
        debugPrint('StartExam: Retryable error in initial fetch (attempt ${i + 1}): $e');
        if (i == 1) rethrow;
        await Future.delayed(const Duration(seconds: 1));
        await _databaseService.database;
      }
    }

    if (user == null) throw const AppDataException('User not found.');

    final bookmarkIds = (((user['bookmarkedQuestions'] as List?) ?? const []))
        .map((id) => id is mongo.ObjectId ? id.oid : id.toString())
        .toSet();

    debugPrint('StartExam: Data fetch took ${sw.elapsedMilliseconds}ms. Candidates: ${candidatesRaw.length}, Answers: ${answers.length}');
    sw.reset();

    // Use a reference to avoid massive copies
    List<Map<String, dynamic>> candidates = candidatesRaw;

    if (topicFilters.isNotEmpty) {
      candidates = candidates
          .where((q) => topicFilters.contains(((q['topic_tag'] as Map?)?['es'] ?? '').toString()))
          .toList();
    }

    if (mode == 'bookmarks') {
      candidates = candidates
          .where((q) => bookmarkIds.contains(objectIdToString(q['_id'])))
          .toList();
    }

    if (mode == 'mistakes') {
      final lastByQuestion = <String, Map<String, dynamic>>{};
      for (final answer in answers) {
        lastByQuestion[objectIdToString(answer['questionId'])] = answer;
      }
      final unresolved = lastByQuestion.values
          .where((a) => a['is_correct'] == false)
          .map((a) => objectIdToString(a['questionId']))
          .toSet();
      candidates = candidates.where((q) => unresolved.contains(objectIdToString(q['_id']))).toList();
    }

    if (mode == 'spaced_repetition') {
      final flashcardCol = await _databaseService.flashcardProgress;
      // Also project flashcards
      final flashcardProgress = await flashcardCol
          .find(mongo.where.eq('userId', userId).fields(['questionId', 'nextReviewDate']))
          .toList();
      
      final latestByQuestion = <String, Map<String, dynamic>>{};
      for (final answer in answers) {
        final qId = objectIdToString(answer['questionId']);
        final createdAt = parseDate(answer['createdAt']) ?? DateTime.fromMillisecondsSinceEpoch(0);
        final previous = latestByQuestion[qId];
        final previousDate = parseDate(previous?['createdAt']) ?? DateTime.fromMillisecondsSinceEpoch(0);
        if (previous == null || createdAt.isAfter(previousDate)) {
          latestByQuestion[qId] = answer;
        }
      }
      final nowUtc = DateTime.now().toUtc();
      final dueIds = latestByQuestion.values
          .where((a) {
            final next = parseDate((a['srs'] as Map?)?['nextReviewAt']);
            return next != null && !next.isAfter(nowUtc);
          })
          .map((a) => objectIdToString(a['questionId']))
          .toSet();
      
      for (final item in flashcardProgress) {
        final next = parseDate(item['nextReviewDate']);
        if (next != null && !next.isAfter(nowUtc)) {
          dueIds.add(objectIdToString(item['questionId']));
        }
      }
      candidates = candidates.where((q) => dueIds.contains(objectIdToString(q['_id']))).toList();
    }

    if (mode == 'weak_topics' && topicFilters.isEmpty) {
      final weakTopics = computeTopicStats(answers)
          .take(3)
          .map((t) => ((t['tag'] as Map)['es']).toString())
          .toSet();
      candidates = candidates.where((q) => weakTopics.contains(((q['topic_tag'] as Map?)?['es'] ?? '').toString())).toList();
    }

    if (candidates.isEmpty) throw const AppDataException('No questions available for this mode.');

    // Scoring
    final scored = scoreQuestions(
      candidates: candidates,
      answers: answers,
      mode: mode,
    );
    debugPrint('StartExam: Scoring took ${sw.elapsedMilliseconds}ms');
    sw.reset();

    final questionById = {
      for (final q in candidates) objectIdToString(q['_id']): q,
    };

    final totalQuestions = mode == 'official' ? 30 : numQuestions;
    final selectedQuestions = scored
        .map((s) => questionById[s.id])
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
      'language': ((user['preferences'] as Map?)?['language'] ?? 'es').toString(),
      'topicFilters': topicFilters,
      'assistanceMode': assistanceMode == 'instant' ? 'instant' : 'exam',
      'questionIds': selectedQuestions.map((q) => q['_id'] as mongo.ObjectId).toList(),
      'answers': <Map<String, dynamic>>[],
      'currentQuestionIndex': 0,
      'expiresAt': mode == 'official' ? creationTime.add(const Duration(minutes: 30)) : null,
      'createdAt': creationTime,
      'updatedAt': creationTime,
    };

    final sessionsCol = await _databaseService.examSessions;
    await sessionsCol.insertOne(session);
    final sessionId = objectIdToString(session['_id']);

    // Proactively fetch full questions and cache them to make transition instant
    try {
      final qCol = await _databaseService.questions;
      final fullQs = await qCol.find(mongo.where.oneFrom('_id', session['questionIds'] as List)).toList();
      final qMap = {for (final q in fullQs) objectIdToString(q['_id']): q};
      final qList = (session['questionIds'] as List)
          .map((id) => qMap[objectIdToString(id)])
          .whereType<Map<String, dynamic>>()
          .map((q) => ExamQuestion.fromJson(publicQuestionMap(q)))
          .toList();
      
      _lastQuestionsId = sessionId;
      _lastQuestions = qList;
      _lastQuestionsTime = DateTime.now();
      debugPrint('StartExam: Proactively cached $sessionId bundle.');
    } catch (e) {
      debugPrint('StartExam: Cache warmup failed (ignoring): $e');
    }

    return sessionId;
  }

  Future<ExamSessionBundle> fetchSession(String sessionId) async {
    final userId = tryParseObjectId(await _secureStorage.readCurrentUserId());
    final parsedSessionId = tryParseObjectId(sessionId);
    if (userId == null || parsedSessionId == null) {
      throw const AppDataException('Invalid session.');
    }

    final sessionsCollection = await _databaseService.examSessions;
    final session = await sessionsCollection.findOne(
      mongo.where.id(parsedSessionId).eq('userId', userId),
    );
    if (session == null) throw const AppDataException('Session not found.');

    List<ExamQuestion> orderedQuestions;
    final now = DateTime.now();
    if (_lastQuestionsId == sessionId && 
        _lastQuestions != null && 
        _lastQuestionsTime != null && 
        now.difference(_lastQuestionsTime!) < const Duration(minutes: 5)) {
      debugPrint('FetchSession: Returning cached questions for $sessionId');
      orderedQuestions = _lastQuestions!;
    } else {
      final questionsCollection = await _databaseService.questions;
      final qIds = (session['questionIds'] as List).cast<mongo.ObjectId>().toList();
      final questions = await questionsCollection.find(mongo.where.oneFrom('_id', qIds)).toList();
      final qMap = {for (final q in questions) objectIdToString(q['_id']): q};
      orderedQuestions = qIds
          .map((id) => qMap[id.oid])
          .whereType<Map<String, dynamic>>()
          .map((q) => ExamQuestion.fromJson(publicQuestionMap(q, includeSolution: session['status'] == 'completed')))
          .toList();
      
      _lastQuestionsId = sessionId;
      _lastQuestions = orderedQuestions;
      _lastQuestionsTime = now;
    }

    return _createBundleFromSession(session, orderedQuestions);
  }

  ExamSessionBundle _createBundleFromSession(Map<String, dynamic> session, List<ExamQuestion> questions) {
    final answers = (session['answers'] as List? ?? [])
        .map((a) {
          final m = a as Map;
          return <String, dynamic>{
            'questionId': objectIdToString(m['questionId']),
            'selectedOptionIdx': (m['selectedOptionIdx'] as num?)?.toInt() ?? 0,
            'isCorrect': m['isCorrect'] == true || m['is_correct'] == true,
            'timeTakenSeconds': (m['timeTakenSeconds'] as num?)?.toInt() ?? (m['time_taken_seconds'] as num?)?.toInt() ?? 0,
          };
        })
        .toList();

    return ExamSessionBundle(
      session: ExamSessionInfo.fromJson({
        'id': objectIdToString(session['_id']),
        'mode': session['mode'],
        'status': session['status'],
        'language': session['language'],
        'assistanceMode': session['assistanceMode'],
        'currentQuestionIndex': (session['currentQuestionIndex'] as num?)?.toInt() ?? 0,
        'answers': answers,
        'score': session['score'],
        'passed': session['passed'],
      }),
      questions: questions,
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
          .eq('status', 'in_progress')
          .fields(['questionIds', 'answers', 'expiresAt', 'assistanceMode']),
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
        .cast<Map<String, dynamic>>()
        .toList();
    
    if (answers.any((answer) => objectIdToString(answer['questionId']) == parsedQuestionId.oid)) {
      throw const AppDataException('Question already answered.');
    }

    final expiresAt = parseDate(session['expiresAt']);
    if (expiresAt != null && expiresAt.isBefore(DateTime.now().toUtc())) {
      throw const AppDataException('This exam session has expired.');
    }

    final question = await questionsCollection.findOne(
      mongo.where.id(parsedQuestionId).fields(['correct_option_idx', 'topic_tag', 'metadata']),
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
          .eq('status', 'in_progress')
          .fields(['answers', 'questionIds', 'language', 'mode']),
    );
    if (session == null) {
      throw const AppDataException('Session not found.');
    }

    final user = await users.findOne(
      mongo.where.id(userId).fields(['gamification', 'stats', 'examLanguagesCompleted', 'badges', 'skillProfile']),
    );
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
        .find(
          mongo.where
              .eq('userId', userId)
              .sortBy('createdAt', descending: true)
              .limit(1000)
              .fields([
            'is_correct',
            'isCorrect',
            'createdAt',
            'topic_tag',
            'topicTag'
          ]),
        )
        .toList();

    int correctAnswersCount = 0;
    int todayQuestionCount = 0;
    for (final ans in allAnswers) {
      if (ans['is_correct'] == true || ans['isCorrect'] == true) {
        correctAnswersCount++;
      }
      if (isSameStudyDay(parseDate(ans['createdAt']), now)) {
        todayQuestionCount++;
      }
    }

    final overallAccuracy = allAnswers.isEmpty
        ? 0
        : ((correctAnswersCount / allAnswers.length) * 100).round();

    final userMap = user.cast<String, dynamic>();
    final gamification = gamificationMap(userMap);
    final stats = statsMap(userMap);
    var newStreak = (gamification['currentStreak'] as num?)?.toInt() ?? 0;
    if (shouldBreakStreak(parseDate(gamification['lastStudyDate']), now)) {
      newStreak = 1;
    } else if (!isSameStudyDay(parseDate(gamification['lastStudyDate']), now)) {
      newStreak += 1;
    }

    final examLanguages = readExamLanguages(userMap);
    final sessionLanguage = (session['language'] ?? 'es').toString();
    if (!examLanguages.contains(sessionLanguage)) {
      examLanguages.add(sessionLanguage);
    }

    final masteredFlashcards = await flashcardCollection.count(
      mongo.where.eq('userId', userId).eq('status', 'mastered'),
    );

    final xpEarned = (passed ? 10 : 5) + (accuracy >= 90 ? 10 : 0);
    final totalXp = ((gamification['totalXP'] as num?)?.toInt() ?? 0) + xpEarned;
    final updatedWeeklyXp = effectiveWeeklyXp(userMap, now) + xpEarned;
    final totalQuestionsAnsweredCurrent = ((stats['totalQuestionsAnswered'] as num?)?.toInt() ?? 0) + sessionAnswers.length;
    
    final newBadges = determineNewBadges(
      user: userMap,
      totalAnswered: totalQuestionsAnsweredCurrent,
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
      totalAnswered: totalQuestionsAnsweredCurrent,
      overallAccuracy: overallAccuracy,
    );
    final readinessScore = calculateReadinessScore(
      totalAnswered: totalQuestionsAnsweredCurrent,
      overallAccuracy: overallAccuracy,
      currentStreak: newStreak,
    );
    
    final topicStats = computeTopicStats(allAnswers.cast<Map<String, dynamic>>().toList());
    final weakTopics = topicStats
        .take(3)
        .map((topic) => ((topic['tag'] as Map)['es']).toString())
        .toList();

    final completedExamCount = await sessionsCollection.count(
      mongo.where.eq('userId', userId).eq('status', 'completed'),
    );
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
          .inc('stats.totalQuestionsAnswered', sessionAnswers.length)
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
