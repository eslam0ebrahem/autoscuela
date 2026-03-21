import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/database/data_exception.dart';
import '../data/exam_repository.dart';
import '../data/ai_repository.dart';
import '../domain/exam_models.dart';
import '../../profile/data/profile_repository.dart';

class ExamScreen extends ConsumerStatefulWidget {
  const ExamScreen({super.key, required this.sessionId});

  final String sessionId;

  @override
  ConsumerState<ExamScreen> createState() => _ExamScreenState();
}

class _ExamScreenState extends ConsumerState<ExamScreen> {
  ExamSessionBundle? _bundle;
  bool _loading = true;
  String? _errorMessage;
  bool _submitting = false;
  int _currentIndex = 0;
  DateTime _questionStartedAt = DateTime.now();
  final Map<String, ExamAnswerRecord> _answers = {};
  final Set<String> _bookmarkedIds = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final bundle = await ref
          .read(examRepositoryProvider)
          .fetchSession(widget.sessionId);
      if (!mounted) return;
      setState(() {
        _bundle = bundle;
        _currentIndex = bundle.session.currentQuestionIndex;
        for (final answer in bundle.session.answers) {
          _answers[answer.questionId] = answer;
        }
        _questionStartedAt = DateTime.now();
      });
    } on AppDataException catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = error.message);
      _showMessage(error.message);
    } catch (error, stackTrace) {
      if (!mounted) return;
      debugPrint('Error loading exam: $error\n$stackTrace');
      setState(() => _errorMessage = 'An error occurred: $error');
      _showMessage('Error loading exam: $error');
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _answerQuestion(ExamQuestion question, int optionIdx) async {
    if (_submitting || _answers.containsKey(question.id)) {
      return;
    }

    setState(() => _submitting = true);
    final elapsed = DateTime.now()
        .difference(_questionStartedAt)
        .inSeconds
        .clamp(1, 1800);
    try {
      final feedback = await ref
          .read(examRepositoryProvider)
          .submitAnswer(
            sessionId: widget.sessionId,
            questionId: question.id,
            selectedOptionIdx: optionIdx,
            timeTakenSeconds: elapsed,
          );
      if (!mounted) return;
      setState(() {
        _answers[question.id] = ExamAnswerRecord(
          questionId: question.id,
          selectedOptionIdx: optionIdx,
          isCorrect: feedback.isCorrect,
          timeTakenSeconds: elapsed,
        );
      });

      if (feedback.explanation != null) {
        await showModalBottomSheet<void>(
          context: context,
          showDragHandle: true,
          builder: (context) => Padding(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  feedback.isCorrect ? 'Correct' : 'Review this one',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 12),
                Text(feedback.explanation!),
              ],
            ),
          ),
        );
      }
      if (!mounted) return;

      if (_currentIndex < (_bundle?.questions.length ?? 1) - 1) {
        setState(() {
          _currentIndex += 1;
          _questionStartedAt = DateTime.now();
        });
      }
    } on AppDataException catch (error) {
      if (!mounted) return;
      _showMessage(error.message);
    } catch (error) {
      if (!mounted) return;
      _showMessage('Error: $error');
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Future<void> _finishExam() async {
    setState(() => _submitting = true);
    try {
      final result = await ref
          .read(examRepositoryProvider)
          .submitExam(widget.sessionId);
      if (mounted) {
        context.go('/exam/${widget.sessionId}/review', extra: result);
      }
    } on AppDataException catch (error) {
      if (mounted) _showMessage(error.message);
    } catch (error) {
      if (mounted) _showMessage('Error: $error');
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Future<void> _toggleBookmark(String questionId) async {
    try {
      await ref.read(profileRepositoryProvider).toggleBookmark(questionId);
      if (!mounted) return;
      setState(() {
        if (_bookmarkedIds.contains(questionId)) {
          _bookmarkedIds.remove(questionId);
          _showMessage('Bookmark removed');
        } else {
          _bookmarkedIds.add(questionId);
          _showMessage('Bookmarked');
        }
      });
    } catch (e) {
      if (mounted) _showMessage('Could not toggle bookmark');
    }
  }

  Future<void> _getAiHint(String questionId, String language) async {
    setState(() => _submitting = true);
    try {
      final questionData = _bundle?.questions[_currentIndex];
      final hint = await ref
          .read(aiRepositoryProvider)
          .getHint(
            questionId: questionId,
            language: language,
            questionData: questionData?.toJson(),
          );
      if (!mounted) return;
      await _showAiModal('AI Hint', hint);
    } on AppDataException catch (error) {
      if (!mounted) return;
      _showMessage(error.message);
    } catch (error) {
      if (!mounted) return;
      _showMessage('Error: $error');
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Future<void> _getAiExplanation(
    String questionId,
    String language,
    int selectedIdx,
  ) async {
    setState(() => _submitting = true);
    try {
      final questionData = _bundle?.questions[_currentIndex];
      final explanation = await ref
          .read(aiRepositoryProvider)
          .getExplanation(
            questionId: questionId,
            language: language,
            selectedIdx: selectedIdx,
            questionData: questionData?.toJson(),
          );
      if (!mounted) return;
      await _showAiModal('AI Deep Explanation', explanation);
    } on AppDataException catch (error) {
      if (!mounted) return;
      _showMessage(error.message);
    } catch (error) {
      if (!mounted) return;
      _showMessage('Error: $error');
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  Future<void> _showAiModal(String title, String content) async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.auto_awesome, color: Colors.purple, size: 20),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              content,
              style: Theme.of(
                context,
              ).textTheme.bodyLarge?.copyWith(height: 1.5),
            ),
          ],
        ),
      ),
    );
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    if (_errorMessage != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Error')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, color: Colors.red, size: 48),
                const SizedBox(height: 16),
                Text(_errorMessage!, textAlign: TextAlign.center),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () => context.go('/practice'),
                  child: const Text('Go back'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (_loading || _bundle == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_bundle!.questions.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('No questions')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('No questions were found for this session.'),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => context.go('/practice'),
                child: const Text('Go back'),
              ),
            ],
          ),
        ),
      );
    }

    final bundle = _bundle!;
    var validIndex = _currentIndex;
    if (validIndex >= bundle.questions.length) {
      validIndex = bundle.questions.length - 1;
    }
    final question = bundle.questions[validIndex];
    final hasAnswered = _answers.containsKey(question.id);
    final language = bundle.session.language;
    final isBookmarked = _bookmarkedIds.contains(question.id);

    return Scaffold(
      appBar: AppBar(
        title: Text('Question ${_currentIndex + 1}/${bundle.questions.length}'),
        actions: [
          IconButton(
            onPressed: () => _toggleBookmark(question.id),
            icon: Icon(isBookmarked ? Icons.bookmark : Icons.bookmark_border),
            tooltip: 'Bookmark',
          ),
          TextButton(
            onPressed: _submitting ? null : _finishExam,
            child: const Text('Finish'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
        children: [
          LinearProgressIndicator(
            value: (_answers.length / bundle.questions.length).clamp(0, 1),
            minHeight: 10,
            borderRadius: BorderRadius.circular(999),
          ),
          const SizedBox(height: 20),
          Card(
            elevation: 0,
            color: Theme.of(
              context,
            ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    question.topicTag.es,
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    question.questionFor(language),
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 20),
                  ...question.options.map((option) {
                    final answer = _answers[question.id];
                    final selected = answer?.selectedOptionIdx == option.idx;
                    final isCorrect =
                        hasAnswered &&
                        bundle.session.assistanceMode == 'instant' &&
                        option.idx == question.correctOptionIdx;
                    final isWrong =
                        hasAnswered &&
                        bundle.session.assistanceMode == 'instant' &&
                        selected &&
                        answer?.isCorrect == false;

                    Color? bgColor;
                    if (isCorrect) {
                      bgColor = Colors.green.withValues(alpha: 0.12);
                    } else if (isWrong) {
                      bgColor = Colors.red.withValues(alpha: 0.12);
                    } else if (selected) {
                      bgColor = Theme.of(
                        context,
                      ).colorScheme.primary.withValues(alpha: 0.12);
                    }

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: OutlinedButton(
                        onPressed: hasAnswered || _submitting
                            ? null
                            : () => _answerQuestion(question, option.idx),
                        style: OutlinedButton.styleFrom(
                          backgroundColor: bgColor,
                          alignment: Alignment.centerLeft,
                          side: isCorrect
                              ? const BorderSide(color: Colors.green, width: 2)
                              : isWrong
                              ? const BorderSide(color: Colors.red, width: 2)
                              : null,
                        ),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  question.optionLabelFor(option, language),
                                ),
                              ),
                              if (isCorrect)
                                const Icon(
                                  Icons.check_circle,
                                  color: Colors.green,
                                  size: 20,
                                ),
                              if (isWrong)
                                const Icon(
                                  Icons.cancel,
                                  color: Colors.red,
                                  size: 20,
                                ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                  if (hasAnswered) ...[
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton(
                            onPressed: validIndex < bundle.questions.length - 1
                                ? () => setState(() {
                                    _currentIndex += 1;
                                    _questionStartedAt = DateTime.now();
                                  })
                                : _finishExam,
                            child: Text(
                              validIndex < bundle.questions.length - 1
                                  ? 'Next question'
                                  : 'Finish exam',
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton.filledTonal(
                          onPressed: () => _getAiExplanation(
                            question.id,
                            language,
                            _answers[question.id]!.selectedOptionIdx,
                          ),
                          icon: const Icon(Icons.auto_awesome),
                          tooltip: 'AI Explanation',
                        ),
                      ],
                    ),
                  ] else ...[
                    const SizedBox(height: 12),
                    TextButton.icon(
                      onPressed: _submitting
                          ? null
                          : () => _getAiHint(question.id, language),
                      icon: const Icon(Icons.lightbulb_outline, size: 18),
                      label: const Text('Get AI hint'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
