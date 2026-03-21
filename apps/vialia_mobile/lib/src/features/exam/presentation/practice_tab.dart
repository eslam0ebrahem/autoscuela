import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/database/data_exception.dart';
import '../data/exam_repository.dart';

class PracticeTab extends ConsumerStatefulWidget {
  const PracticeTab({super.key});

  @override
  ConsumerState<PracticeTab> createState() => _PracticeTabState();
}

class _PracticeTabState extends ConsumerState<PracticeTab> {
  String _assistanceMode = 'exam';
  double _questionCount = 30;
  bool _starting = false;

  Future<void> _startExam(String mode) async {
    setState(() => _starting = true);
    try {
      final sessionId = await ref
          .read(examRepositoryProvider)
          .startExam(
            mode: mode,
            assistanceMode: _assistanceMode,
            numQuestions: _questionCount.round(),
          );
      if (mounted) {
        context.push('/exam/$sessionId');
      }
    } on AppDataException catch (error) {
      if (mounted) {
        _show(error.message);
      }
    } catch (error) {
      if (mounted) {
        _show(error.toString());
      }
    } finally {
      if (mounted) {
        setState(() => _starting = false);
      }
    }
  }

  void _show(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cards = [
      (
        'official',
        'Official simulation',
        '30 questions, exam pressure, pass/fail signal.',
      ),
      ('custom', 'Custom drill', 'Flexible batch size for focused reps.'),
      ('mistakes', 'Mistakes bank', 'Attack the questions you keep missing.'),
      (
        'weak_topics',
        'Weak topics',
        'Automatically target low-accuracy topics.',
      ),
      ('bookmarks', 'Bookmarks', 'Practice your saved trouble spots.'),
      ('spaced_repetition', 'SRS review', 'Serve only due questions first.'),
    ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
      children: [
        Text(
          'Practice modes',
          style: Theme.of(
            context,
          ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 8),
        Text(
          'Start with the fastest loop for the goal you have today.',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 20),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Assistance mode',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 12),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'exam', label: Text('Exam')),
                    ButtonSegment(value: 'instant', label: Text('Instant')),
                  ],
                  selected: {_assistanceMode},
                  onSelectionChanged: (selection) {
                    setState(() => _assistanceMode = selection.first);
                  },
                ),
                const SizedBox(height: 16),
                Text('Question count: ${_questionCount.round()}'),
                Slider(
                  value: _questionCount,
                  min: 5,
                  max: 50,
                  divisions: 9,
                  label: _questionCount.round().toString(),
                  onChanged: (value) => setState(() => _questionCount = value),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),
        ...cards.map((card) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Card(
              child: ListTile(
                contentPadding: const EdgeInsets.all(18),
                title: Text(
                  card.$2,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                subtitle: Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(card.$3),
                ),
                trailing: FilledButton(
                  onPressed: _starting ? null : () => _startExam(card.$1),
                  child: Text(_starting ? '...' : 'Start'),
                ),
              ),
            ),
          );
        }),
      ],
    );
  }
}
