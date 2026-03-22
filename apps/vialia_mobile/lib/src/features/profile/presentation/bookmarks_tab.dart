import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/database/data_exception.dart';
import '../../../core/utils/ui_helpers.dart';
import '../../exam/data/exam_repository.dart';
import '../../exam/domain/exam_models.dart';
import '../data/profile_repository.dart';

class BookmarksTab extends ConsumerStatefulWidget {
  const BookmarksTab({super.key});

  @override
  ConsumerState<BookmarksTab> createState() => _BookmarksTabState();
}

class _BookmarksTabState extends ConsumerState<BookmarksTab> {
  List<ExamQuestion> _bookmarks = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final bookmarks = await ref
          .read(profileRepositoryProvider)
          .loadBookmarks();
      if (!mounted) return;
      setState(() => _bookmarks = bookmarks);
    } on AppDataException catch (error) {
      if (!mounted) return;
      context.showErrorSnackbar(error.message);
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _toggle(String questionId) async {
    await ref.read(profileRepositoryProvider).toggleBookmark(questionId);
    if (!mounted) return;
    await _load();
  }

  Future<void> _practiceBookmarks() async {
    try {
      final sessionId = await ref
          .read(examRepositoryProvider)
          .startExam(
            mode: 'bookmarks',
            assistanceMode: 'exam',
            numQuestions: 30,
          );
      if (mounted) {
        context.push('/exam/$sessionId');
      }
    } on AppDataException catch (error) {
      if (mounted) context.showErrorSnackbar(error.message);
    } catch (error) {
      if (mounted) context.showErrorSnackbar(error.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Bookmarks',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            FilledButton(
              onPressed: _bookmarks.isEmpty ? null : _practiceBookmarks,
              child: const Text('Practice'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_bookmarks.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 40),
            child: Center(
              child: Column(
                children: [
                  Icon(
                    Icons.bookmark_outline,
                    size: 48,
                    color: Theme.of(context).colorScheme.outline,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'No bookmarks yet',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Tap the bookmark icon during an exam to save questions here.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(context).colorScheme.outline,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ..._bookmarks.map(
          (question) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Card(
              child: ListTile(
                contentPadding: const EdgeInsets.all(18),
                title: Text(question.questionEs),
                subtitle: Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    '${question.topicTag.es} · ${question.difficulty}',
                  ),
                ),
                trailing: IconButton(
                  onPressed: () => _toggle(question.id),
                  icon: const Icon(Icons.bookmark),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
