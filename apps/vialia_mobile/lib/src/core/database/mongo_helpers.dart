import 'package:mongo_dart/mongo_dart.dart' as mongo;

import '../utils/study_engine.dart';
import 'data_exception.dart';

String objectIdToString(dynamic value) {
  if (value is mongo.ObjectId) {
    return value.oid;
  }

  return value?.toString() ?? '';
}

mongo.ObjectId? tryParseObjectId(String? id) {
  if (id == null || id.isEmpty) {
    return null;
  }

  try {
    return mongo.ObjectId.fromHexString(id);
  } catch (_) {
    return null;
  }
}

DateTime? parseDate(dynamic value) {
  if (value == null) {
    return null;
  }

  if (value is DateTime) {
    return value.toUtc();
  }

  if (value is String) {
    return DateTime.tryParse(value)?.toUtc();
  }

  return null;
}

String normalizeEmail(dynamic value) {
  return value?.toString().trim().toLowerCase() ?? '';
}

String normalizeString(dynamic value) {
  return value?.toString().trim() ?? '';
}

int clampInt(dynamic value, int min, int max, {int fallback = 0}) {
  final parsed = value is int ? value : int.tryParse(value?.toString() ?? '');
  if (parsed == null) {
    return fallback;
  }

  if (parsed < min) {
    return min;
  }

  if (parsed > max) {
    return max;
  }

  return parsed;
}

String stripHtml(dynamic value) {
  if (value is! String || value.isEmpty) {
    return '';
  }

  return value
      .replaceAll(RegExp(r'<[^>]*>'), ' ')
      .replaceAll('&nbsp;', ' ')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
}

Map<String, dynamic> gamificationMap(Map<String, dynamic> user) {
  return Map<String, dynamic>.from(
    (user['gamification'] as Map?)?.cast<String, dynamic>() ?? {},
  );
}

Map<String, dynamic> statsMap(Map<String, dynamic> user) {
  return Map<String, dynamic>.from(
    (user['stats'] as Map?)?.cast<String, dynamic>() ?? {},
  );
}

DateTime startOfCurrentWeekUtc(DateTime nowUtc) {
  final local = nowUtc.toLocal();
  final startOfToday = DateTime(local.year, local.month, local.day);
  final startOfWeekLocal = startOfToday.subtract(
    Duration(days: local.weekday - 1),
  );
  return startOfWeekLocal.toUtc();
}

bool shouldResetWeeklyXp(Map<String, dynamic> gamification, DateTime nowUtc) {
  final weeklyXp = (gamification['weeklyXP'] as num?)?.toInt() ?? 0;
  if (weeklyXp <= 0) {
    return false;
  }

  final resetAt = parseDate(gamification['weeklyXPResetAt']);
  if (resetAt == null) {
    return true;
  }

  return resetAt.isBefore(startOfCurrentWeekUtc(nowUtc));
}

int effectiveWeeklyXp(Map<String, dynamic> user, DateTime nowUtc) {
  final gamification = gamificationMap(user);
  if (shouldResetWeeklyXp(gamification, nowUtc)) {
    return 0;
  }

  return (gamification['weeklyXP'] as num?)?.toInt() ?? 0;
}

List<String> readExamLanguages(Map<String, dynamic> user) {
  final languages = <String>{
    ...((gamificationMap(user)['examLanguages'] as List?) ?? const <dynamic>[])
        .map((language) => language.toString()),
    ...((user['examLanguagesCompleted'] as List?) ?? const <dynamic>[]).map(
      (language) => language.toString(),
    ),
  };

  return languages.where((language) => language.trim().isNotEmpty).toList();
}

List<String> readEarnedBadgeIds(Map<String, dynamic> user) {
  final legacyBadges = ((user['badges'] as List?) ?? const <dynamic>[])
      .map((badge) {
        if (badge is Map) {
          return badge['key'] ?? badge['id'];
        }
        return badge;
      })
      .map((badge) => badge?.toString() ?? '')
      .where((badge) => badge.isNotEmpty);

  final allBadgeIds = <String>{
    ...((gamificationMap(user)['earnedBadges'] as List?) ?? const <dynamic>[])
        .map((badge) => badge.toString()),
    ...legacyBadges,
  };

  return allBadgeIds.toList();
}

List<Map<String, dynamic>> buildLegacyBadgeEntries(
  Iterable<String> badgeIds, {
  DateTime? unlockedAt,
}) {
  final timestamp = (unlockedAt ?? DateTime.now().toUtc()).toUtc();
  return badgeIds.toSet().map((badgeId) {
    final metadata = badgeCatalog[badgeId] ?? const <String, String>{};
    return <String, dynamic>{
      'key': badgeId,
      'name': metadata['title'] ?? badgeId,
      'unlockedAt': timestamp,
    };
  }).toList();
}

bool isPremiumUser(Map<String, dynamic> user) {
  if (user['premiumOverride'] == true) {
    return true;
  }

  final subscription = Map<String, dynamic>.from(
    (user['subscription'] as Map?)?.cast<String, dynamic>() ?? {},
  );
  final status = subscription['status']?.toString() ?? 'inactive';
  if (status == 'active') {
    return true;
  }

  if (status == 'past_due') {
    final currentPeriodEnd = parseDate(subscription['currentPeriodEnd']);
    return currentPeriodEnd != null &&
        currentPeriodEnd.isAfter(DateTime.now().toUtc());
  }

  return false;
}

Map<String, dynamic> publicUserMap(Map<String, dynamic> user) {
  return <String, dynamic>{
    'id': objectIdToString(user['_id']),
    'email': user['email'],
    'nickname': user['nickname'],
    'role': user['role'] ?? 'user',
    'emailVerified': user['emailVerified'] ?? true,
    'preferences': <String, dynamic>{
      'language': 'es',
      'theme': 'system',
      'soundEnabled': true,
      ...Map<String, dynamic>.from(
        (user['preferences'] as Map?)?.cast<String, dynamic>() ?? {},
      ),
    },
    'gamification': <String, dynamic>{
      'currentStreak': 0,
      'totalXP': 0,
      ...gamificationMap(user),
    },
    'isPremium': isPremiumUser(user),
  };
}

Map<String, dynamic> publicQuestionMap(
  Map<String, dynamic> question, {
  bool includeSolution = false,
}) {
  final metadata = Map<String, dynamic>.from(
    (question['metadata'] as Map?)?.cast<String, dynamic>() ?? {},
  );

  return <String, dynamic>{
    'id': objectIdToString(question['_id']),
    'question': Map<String, dynamic>.from(
      (question['question'] as Map?)?.cast<String, dynamic>() ?? {},
    ),
    'options': List<Map<String, dynamic>>.from(
      ((question['options'] as List?) ?? const <dynamic>[]).map(
        (item) => Map<String, dynamic>.from(item as Map),
      ),
    ),
    'topicTag': Map<String, dynamic>.from(
      (question['topic_tag'] as Map?)?.cast<String, dynamic>() ?? {},
    ),
    'difficulty': question['difficulty']?.toString() ?? 'medium',
    'metadata': <String, dynamic>{
      'imageUrl': metadata['image_url'],
      'helpText': stripHtml(metadata['help_html']),
    },
    if (includeSolution)
      'correctOptionIdx': (question['correct_option_idx'] as num?)?.toInt(),
  };
}

T requireValue<T>(T? value, String message) {
  if (value == null) {
    throw AppDataException(message);
  }

  return value;
}
