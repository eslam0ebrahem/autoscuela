import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mongo_dart/mongo_dart.dart' as mongo;

import '../../../core/database/data_exception.dart';
import '../../../core/database/mongo_database_service.dart';
import '../../../core/database/mongo_helpers.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../../auth/domain/app_user.dart';
import '../../exam/domain/exam_models.dart';

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepository(
    databaseService: ref.watch(mongoDatabaseServiceProvider),
    secureStorage: ref.watch(secureStorageProvider),
  );
});

class ProfileRepository {
  ProfileRepository({
    required MongoDatabaseService databaseService,
    required SecureStorageService secureStorage,
  }) : _databaseService = databaseService,
       _secureStorage = secureStorage;

  final MongoDatabaseService _databaseService;
  final SecureStorageService _secureStorage;

  Future<AppUser> updatePreferences({
    String? nickname,
    String? language,
    String? theme,
    bool? soundEnabled,
  }) async {
    final userId = tryParseObjectId(await _secureStorage.readCurrentUserId());
    if (userId == null) {
      throw const AppDataException('Please log in first.');
    }

    final users = await _databaseService.users;
    final user = await users.findOne(mongo.where.id(userId).fields(['_id']));
    if (user == null) {
      throw const AppDataException('User not found.');
    }

    final modifier = mongo.modify.set('updatedAt', DateTime.now().toUtc());
    if (nickname != null && nickname.trim().length >= 2) {
      modifier.set('nickname', nickname.trim());
    }
    if (language != null && (language == 'es' || language == 'en')) {
      modifier.set('preferences.language', language);
    }
    if (theme != null &&
        (theme == 'light' || theme == 'dark' || theme == 'system')) {
      modifier.set('preferences.theme', theme);
    }
    if (soundEnabled != null) {
      modifier.set('preferences.soundEnabled', soundEnabled);
    }

    await users.updateOne(mongo.where.id(userId), modifier);
    final updatedUser = await users.findOne(mongo.where.id(userId));
    return AppUser.fromJson(
      publicUserMap(Map<String, dynamic>.from(updatedUser!)),
    );
  }

  Future<List<ExamQuestion>> loadBookmarks() async {
    final userId = tryParseObjectId(await _secureStorage.readCurrentUserId());
    if (userId == null) {
      throw const AppDataException('Please log in first.');
    }

    final users = await _databaseService.users;
    final questionsCollection = await _databaseService.questions;

    final user = await users.findOne(mongo.where.id(userId).fields(['bookmarkedQuestions']));
    if (user == null) {
      throw const AppDataException('User not found.');
    }

    final bookmarkIds =
        (((user['bookmarkedQuestions'] as List?) ?? const <dynamic>[]))
            .whereType<mongo.ObjectId>()
            .toList();
    if (bookmarkIds.isEmpty) {
      return const [];
    }

    final questions = await questionsCollection
        .find(mongo.where.oneFrom('_id', bookmarkIds))
        .toList();
    final questionById = {
      for (final question in questions)
        objectIdToString(question['_id']): Map<String, dynamic>.from(question),
    };

    return bookmarkIds
        .map((id) => questionById[id.oid])
        .whereType<Map<String, dynamic>>()
        .map(
          (question) => ExamQuestion.fromJson(
            publicQuestionMap(question, includeSolution: true),
          ),
        )
        .toList();
  }

  Future<void> toggleBookmark(String questionId) async {
    final userId = tryParseObjectId(await _secureStorage.readCurrentUserId());
    final parsedQuestionId = tryParseObjectId(questionId);
    if (userId == null || parsedQuestionId == null) {
      throw const AppDataException('Invalid bookmark request.');
    }

    final users = await _databaseService.users;
    final user = await users.findOne(mongo.where.id(userId).fields(['bookmarkedQuestions']));
    if (user == null) {
      throw const AppDataException('User not found.');
    }

    final bookmarks =
        (((user['bookmarkedQuestions'] as List?) ?? const <dynamic>[]))
            .whereType<mongo.ObjectId>()
            .toList();
    final exists = bookmarks.any(
      (bookmark) => bookmark.oid == parsedQuestionId.oid,
    );
    if (exists) {
      bookmarks.removeWhere((bookmark) => bookmark.oid == parsedQuestionId.oid);
    } else {
      bookmarks.add(parsedQuestionId);
    }

    await users.updateOne(
      mongo.where.id(userId),
      mongo.modify
          .set('bookmarkedQuestions', bookmarks)
          .set('updatedAt', DateTime.now().toUtc()),
    );
  }
}
