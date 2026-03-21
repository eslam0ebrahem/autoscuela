import 'package:bcrypt/bcrypt.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mongo_dart/mongo_dart.dart' as mongo;

import '../../../core/database/data_exception.dart';
import '../../../core/database/mongo_database_service.dart';
import '../../../core/database/mongo_helpers.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../domain/app_user.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    databaseService: ref.watch(mongoDatabaseServiceProvider),
    secureStorage: ref.watch(secureStorageProvider),
  );
});

class AuthRepository {
  AuthRepository({
    required MongoDatabaseService databaseService,
    required SecureStorageService secureStorage,
  }) : _databaseService = databaseService,
       _secureStorage = secureStorage;

  final MongoDatabaseService _databaseService;
  final SecureStorageService _secureStorage;

  Future<String?> readStoredUserId() => _secureStorage.readCurrentUserId();

  Future<void> clearSession() => _secureStorage.clearSession();

  Future<AppUser?> restoreSession() async {
    final userId = await _secureStorage.readCurrentUserId();
    if (userId == null || userId.isEmpty) {
      return null;
    }

    try {
      return await currentUser();
    } catch (_) {
      await _secureStorage.clearSession();
      return null;
    }
  }

  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    final normalizedEmail = normalizeEmail(email);
    if (normalizedEmail.isEmpty || password.isEmpty) {
      throw const AppDataException('Email and password are required.');
    }

    final users = await _databaseService.users;
    final user = await users.findOne(mongo.where.eq('email', normalizedEmail));
    if (user == null) {
      throw const AppDataException('Invalid email or password.');
    }

    final passwordHash = user['passwordHash']?.toString() ?? '';
    final isValid = BCrypt.checkpw(password, passwordHash);
    if (!isValid) {
      throw const AppDataException('Invalid email or password.');
    }

    final userId = objectIdToString(user['_id']);
    await _secureStorage.writeCurrentUserId(userId);
    return AuthSession(
      userId: userId,
      user: AppUser.fromJson(publicUserMap(Map<String, dynamic>.from(user))),
    );
  }

  Future<AuthSession> register({
    required String nickname,
    required String email,
    required String password,
    required String language,
  }) async {
    final normalizedEmail = normalizeEmail(email);
    final normalizedNickname = normalizeString(nickname);
    if (!normalizedEmail.contains('@')) {
      throw const AppDataException('Invalid email address.');
    }
    if (normalizedNickname.length < 2) {
      throw const AppDataException('Nickname must be at least 2 characters.');
    }
    if (password.length < 8) {
      throw const AppDataException('Password must be at least 8 characters.');
    }

    final users = await _databaseService.users;
    final existingUser = await users.findOne(
      mongo.where.eq('email', normalizedEmail),
    );
    if (existingUser != null) {
      throw const AppDataException(
        'An account with this email already exists.',
      );
    }

    final now = DateTime.now().toUtc();
    final weekStart = startOfCurrentWeekUtc(now);
    final user = <String, dynamic>{
      '_id': mongo.ObjectId(),
      'email': normalizedEmail,
      'passwordHash': BCrypt.hashpw(password, BCrypt.gensalt()),
      'nickname': normalizedNickname,
      'role': 'user',
      'emailVerified': true,
      'emailVerifiedAt': now,
      'preferences': {
        'language': language == 'en' ? 'en' : 'es',
        'theme': 'system',
        'soundEnabled': true,
      },
      'subscription': {'status': 'inactive'},
      'gamification': {
        'currentStreak': 0,
        'maxStreak': 0,
        'totalXP': 0,
        'weeklyXP': 0,
        'weeklyXPResetAt': weekStart,
        'weeklyXPWeekKey': weekStart.toIso8601String().substring(0, 10),
        'earnedBadges': <String>[],
        'examLanguages': <String>[],
      },
      'stats': {
        'totalQuestionsAnswered': 0,
        'examsCompleted': 0,
        'flashcardsReviewed': 0,
      },
      'examLanguagesCompleted': <String>[],
      'badges': <Map<String, dynamic>>[],
      'aiInsights': <String, dynamic>{},
      'premiumOverride': true,
      'bookmarkedQuestions': <mongo.ObjectId>[],
      'studyHistory': <dynamic>[],
      'skillProfile': {
        'overallLevel': 'beginner',
        'topicLevels': <String, dynamic>{},
        'lastCalculatedAt': now,
      },
      'createdAt': now,
      'updatedAt': now,
    };

    await users.insertOne(user);
    final userId = objectIdToString(user['_id']);
    await _secureStorage.writeCurrentUserId(userId);
    return AuthSession(
      userId: userId,
      user: AppUser.fromJson(publicUserMap(user)),
    );
  }

  Future<AppUser> currentUser() async {
    final userId = await _secureStorage.readCurrentUserId();
    if (userId == null) {
      throw const AppDataException('User not logged in.');
    }

    final users = await _databaseService.users;
    final user = await users.findOne(
      mongo.where.id(mongo.ObjectId.fromHexString(userId)),
    );
    if (user == null) {
      throw const AppDataException('User not found.');
    }

    return AppUser.fromJson(publicUserMap(Map<String, dynamic>.from(user)));
  }
}

class AuthSession {
  AuthSession({required this.userId, required this.user});
  final String userId;
  final AppUser user;
}
