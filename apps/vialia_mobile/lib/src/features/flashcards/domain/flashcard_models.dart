class FlashcardDeck {
  const FlashcardDeck({
    required this.topic,
    required this.total,
    required this.due,
  });

  final String topic;
  final int total;
  final int due;

  factory FlashcardDeck.fromJson(Map<String, dynamic> json) {
    return FlashcardDeck(
      topic: json['topic']?.toString() ?? 'General',
      total: (json['total'] as num?)?.toInt() ?? 0,
      due: (json['due'] as num?)?.toInt() ?? 0,
    );
  }
}

class FlashcardReviewResult {
  const FlashcardReviewResult({required this.status, required this.newStreak});

  final String status;
  final int newStreak;

  factory FlashcardReviewResult.fromJson(Map<String, dynamic> json) {
    return FlashcardReviewResult(
      status: json['status']?.toString() ?? 'learning',
      newStreak: (json['newStreak'] as num?)?.toInt() ?? 0,
    );
  }
}
