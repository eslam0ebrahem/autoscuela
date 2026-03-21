// ignore_for_file: avoid_print
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:vialia_mobile/src/core/database/mongo_database_service.dart';
import 'package:vialia_mobile/src/features/exam/data/exam_repository.dart';

void main() {
  test('Check Start Exam', () async {
    TestWidgetsFlutterBinding.ensureInitialized();
    HttpOverrides.global =
        null; // Allow basic_utils to do SRV resolution via HTTP
    FlutterSecureStorage.setMockInitialValues({});
    final container = ProviderContainer();
    final dbService = container.read(mongoDatabaseServiceProvider);
    await dbService.database;

    final repo = container.read(examRepositoryProvider);
    try {
      final sessionId = await repo.startExam(
        mode: 'official',
        assistanceMode: 'exam',
        numQuestions: 30,
      );
      print('Session created: $sessionId');

      final bundle = await repo.fetchSession(sessionId);
      print('Questions count: ${bundle.questions.length}');
      if (bundle.questions.isEmpty) {
        print('ERROR: Questions is empty!');
      } else {
        print('First question: ${bundle.questions[0].questionEs}');
      }
    } catch (e, st) {
      print('Error caught: $e');
      print(st);
    }
  });
}
