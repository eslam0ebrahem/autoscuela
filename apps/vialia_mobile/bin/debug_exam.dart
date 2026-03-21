// ignore_for_file: avoid_print
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:vialia_mobile/src/core/database/mongo_database_service.dart';
import 'package:vialia_mobile/src/features/exam/data/exam_repository.dart';

void main() async {
  final container = ProviderContainer();
  final dbService = container.read(mongoDatabaseServiceProvider);
  await dbService.database;

  final repo = container.read(examRepositoryProvider);
  try {
    print('Starting exam...');
    final sessionId = await repo.startExam(
      mode: 'official',
      assistanceMode: 'exam',
      numQuestions: 30,
    );
    print('Session created: $sessionId');

    final bundle = await repo.fetchSession(sessionId);
    print('Questions count: ${bundle.questions.length}');
  } catch (e, st) {
    print('Error caught: $e\n$st');
  }
}
