class AppUser {
  const AppUser({
    required this.id,
    required this.email,
    required this.nickname,
    required this.role,
    required this.emailVerified,
    required this.language,
    required this.theme,
    required this.soundEnabled,
    required this.currentStreak,
    required this.totalXp,
    required this.isPremium,
  });

  final String id;
  final String email;
  final String nickname;
  final String role;
  final bool emailVerified;
  final String language;
  final String theme;
  final bool soundEnabled;
  final int currentStreak;
  final int totalXp;
  final bool isPremium;

  factory AppUser.fromJson(Map<String, dynamic> json) {
    final preferences = Map<String, dynamic>.from(
      (json['preferences'] as Map?)?.cast<String, dynamic>() ?? {},
    );
    final gamification = Map<String, dynamic>.from(
      (json['gamification'] as Map?)?.cast<String, dynamic>() ?? {},
    );
    return AppUser(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      nickname: json['nickname']?.toString() ?? '',
      role: json['role']?.toString() ?? 'user',
      emailVerified: json['emailVerified'] == true,
      language: preferences['language']?.toString() ?? 'es',
      theme: preferences['theme']?.toString() ?? 'system',
      soundEnabled: preferences['soundEnabled'] != false,
      currentStreak: (gamification['currentStreak'] as num?)?.toInt() ?? 0,
      totalXp: (gamification['totalXP'] as num?)?.toInt() ?? 0,
      isPremium: json['isPremium'] == true,
    );
  }

  AppUser copyWith({
    String? nickname,
    String? language,
    String? theme,
    bool? soundEnabled,
  }) {
    return AppUser(
      id: id,
      email: email,
      nickname: nickname ?? this.nickname,
      role: role,
      emailVerified: emailVerified,
      language: language ?? this.language,
      theme: theme ?? this.theme,
      soundEnabled: soundEnabled ?? this.soundEnabled,
      currentStreak: currentStreak,
      totalXp: totalXp,
      isPremium: isPremium,
    );
  }
}

class AuthSession {
  const AuthSession({required this.userId, required this.user});

  final String userId;
  final AppUser user;
}
