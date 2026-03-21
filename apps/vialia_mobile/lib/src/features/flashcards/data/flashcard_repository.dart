import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mongo_dart/mongo_dart.dart' as mongo;

import '../../../core/database/data_exception.dart';
import '../../../core/database/mongo_database_service.dart';
import '../../../core/database/mongo_helpers.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../../core/utils/study_engine.dart';
import '../../exam/domain/exam_models.dart';
import '../domain/flashcard_models.dart';

final flashcardRepositoryProvider = Provider<FlashcardRepository>((ref) {
  return FlashcardRepository(
    databaseService: ref.watch(mongoDatabaseServiceProvider),
    secureStorage: ref.watch(secureStorageProvider),
  );
});

class FlashcardRepository {
  FlashcardRepository({
    required MongoDatabaseService databaseService,
    required SecureStorageService secureStorage,
  }) : _databaseService = databaseService,
       _secureStorage = secureStorage;

  final MongoDatabaseService _databaseService;
  final SecureStorageService _secureStorage;

  Future<List<FlashcardDeck>> fetchDecks() async {
    final userId = tryParseObjectId(await _secureStorage.readCurrentUserId());
    if (userId == null) {
      throw const AppDataException('Please log in first.');
    }

    final questionsCollection = await _databaseService.questions;
    final progressCollection = await _databaseService.flashcardProgress;

    final questions = await questionsCollection
        .find(mongo.where.eq('isActive', true))
        .toList();
    final progress = await progressCollection
        .find(mongo.where.eq('userId', userId))
        .toList();
    final dueIds = progress
        .where((item) {
          final nextReview = parseDate(item['nextReviewDate']);
          return nextReview != null &&
              !nextReview.isAfter(DateTime.now().toUtc());
        })
        .map((item) => objectIdToString(item['questionId']))
        .toSet();

    final grouped = <String, Map<String, dynamic>>{};
    for (final question in questions) {
      final topic = ((question['topic_tag'] as Map?)?['es'] ?? 'General')
          .toString();
      final bucket = grouped.putIfAbsent(
        topic,
        () => {'topic': topic, 'total': 0, 'due': 0},
      );
      bucket['total'] = (bucket['total'] as int) + 1;
      if (dueIds.contains(objectIdToString(question['_id']))) {
        bucket['due'] = (bucket['due'] as int) + 1;
      }
    }

    final decks =
        grouped.values.map((item) => FlashcardDeck.fromJson(item)).toList()
          ..sort((a, b) => a.topic.compareTo(b.topic));
    return decks;
  }

  Future<List<ExamQuestion>> fetchCards(String? topic) async {
    final userId = tryParseObjectId(await _secureStorage.readCurrentUserId());
    if (userId == null) {
      throw const AppDataException('Please log in first.');
    }

    final questionsCollection = await _databaseService.questions;
    final progressCollection = await _databaseService.flashcardProgress;
    final normalizedTopic = normalizeString(topic);

    final questions = await questionsCollection
        .find(mongo.where.eq('isActive', true))
        .toList();
    final progress = await progressCollection
        .find(mongo.where.eq('userId', userId))
        .toList();

    final dueIds = progress
        .where((item) {
          final nextReview = parseDate(item['nextReviewDate']);
          return nextReview != null &&
              !nextReview.isAfter(DateTime.now().toUtc());
        })
        .map((item) => objectIdToString(item['questionId']))
        .toSet();
    final seenIds = progress
        .map((item) => objectIdToString(item['questionId']))
        .toSet();

    final filteredQuestions = questions
        .map((item) => Map<String, dynamic>.from(item))
        .where((question) {
          if (normalizedTopic.isEmpty) {
            return true;
          }
          return ((question['topic_tag'] as Map?)?['es'] ?? '').toString() ==
              normalizedTopic;
        })
        .toList();

    final dueCards = filteredQuestions
        .where((question) => dueIds.contains(objectIdToString(question['_id'])))
        .take(20)
        .map(
          (question) => ExamQuestion.fromJson(
            publicQuestionMap(question, includeSolution: true),
          ),
        )
        .toList();

    if (dueCards.length < 20) {
      final newCards = filteredQuestions
          .where(
            (question) => !seenIds.contains(objectIdToString(question['_id'])),
          )
          .take(20 - dueCards.length)
          .map(
            (question) => ExamQuestion.fromJson(
              publicQuestionMap(question, includeSolution: true),
            ),
          )
          .toList();
      dueCards.addAll(newCards);
    }

    return dueCards;
  }

  Future<FlashcardReviewResult> review({
    required String cardId,
    required bool gotIt,
  }) async {
    final userId = tryParseObjectId(await _secureStorage.readCurrentUserId());
    final parsedCardId = tryParseObjectId(cardId);
    if (userId == null || parsedCardId == null) {
      throw const AppDataException('Invalid flashcard review payload.');
    }

    final progressCollection = await _databaseService.flashcardProgress;
    final users = await _databaseService.users;

    final user = await users.findOne(mongo.where.id(userId));
    if (user == null) {
      throw const AppDataException('User not found.');
    }

    final existing = await progressCollection.findOne(
      mongo.where.eq('userId', userId).eq('questionId', parsedCardId),
    );

    final progress = existing == null
        ? <String, dynamic>{
            '_id': mongo.ObjectId(),
            'userId': userId,
            'questionId': parsedCardId,
            'status': 'new',
            'nextReviewDate': DateTime.now().toUtc(),
            'reviewCount': 0,
            'easeFactor': 2.5,
            'interval': 1,
            'consecutiveCorrect': 0,
            'createdAt': DateTime.now().toUtc(),
          }
        : Map<String, dynamic>.from(existing);

    progress['reviewCount'] =
        ((progress['reviewCount'] as num?)?.toInt() ?? 0) + 1;
    final currentEase = (progress['easeFactor'] as num?)?.toDouble() ?? 2.5;
    var interval = (progress['interval'] as num?)?.toInt() ?? 1;
    var consecutiveCorrect =
        (progress['consecutiveCorrect'] as num?)?.toInt() ?? 0;

    if (!gotIt) {
      interval = 1;
      consecutiveCorrect = 0;
      progress['status'] = 'learning';
      progress['easeFactor'] = (currentEase - 0.2).clamp(1.3, 3.0);
    } else {
      consecutiveCorrect += 1;
      if (consecutiveCorrect == 1) {
        interval = 1;
      } else if (consecutiveCorrect == 2) {
        interval = 3;
      } else if (consecutiveCorrect == 3) {
        interval = 7;
      } else {
        interval = (interval * currentEase).round();
      }
      progress['status'] = interval >= 21 ? 'mastered' : 'learning';
      progress['easeFactor'] = (currentEase + 0.05).clamp(1.3, 3.0);
    }

    progress['interval'] = interval;
    progress['consecutiveCorrect'] = consecutiveCorrect;
    progress['nextReviewDate'] = DateTime.now().toUtc().add(
      Duration(days: interval),
    );
    progress['updatedAt'] = DateTime.now().toUtc();

    if (existing == null) {
      await progressCollection.insertOne(progress);
    } else {
      await progressCollection.updateOne(
        mongo.where.id(progress['_id'] as mongo.ObjectId),
        mongo.modify
            .set('status', progress['status'])
            .set('reviewCount', progress['reviewCount'])
            .set('easeFactor', progress['easeFactor'])
            .set('interval', progress['interval'])
            .set('consecutiveCorrect', progress['consecutiveCorrect'])
            .set('nextReviewDate', progress['nextReviewDate'])
            .set('updatedAt', progress['updatedAt']),
      );
    }

    final userMap = Map<String, dynamic>.from(user);
    final gamification = gamificationMap(userMap);
    final stats = statsMap(userMap);
    final now = DateTime.now().toUtc();
    var streak = (gamification['currentStreak'] as num?)?.toInt() ?? 0;
    if (shouldBreakStreak(parseDate(gamification['lastStudyDate']), now)) {
      streak = 1;
    } else if (!isSameStudyDay(parseDate(gamification['lastStudyDate']), now)) {
      streak += 1;
    }

    final xpEarned = gotIt ? 1 : 0;
    final updatedWeeklyXp = effectiveWeeklyXp(userMap, now) + xpEarned;
    final weekStart = startOfCurrentWeekUtc(now);
    await users.updateOne(
      mongo.where.id(userId),
      mongo.modify
          .set('gamification.currentStreak', streak)
          .set(
            'gamification.maxStreak',
            max(((gamification['maxStreak'] as num?)?.toInt() ?? 0), streak),
          )
          .set('gamification.lastStudyDate', now)
          .set('gamification.weeklyXP', updatedWeeklyXp)
          .set('gamification.weeklyXPResetAt', weekStart)
          .set(
            'gamification.weeklyXPWeekKey',
            weekStart.toIso8601String().substring(0, 10),
          )
          .inc('gamification.totalXP', xpEarned)
          .set(
            'stats.flashcardsReviewed',
            ((stats['flashcardsReviewed'] as num?)?.toInt() ?? 0) + 1,
          )
          .set('updatedAt', now),
    );

    return FlashcardReviewResult(
      status: progress['status']?.toString() ?? 'learning',
      newStreak: streak,
    );
  }
}
