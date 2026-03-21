import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/ai_repository.dart';
import '../domain/exam_models.dart';
import '../../dashboard/domain/dashboard_models.dart';

class ExamReviewScreen extends ConsumerStatefulWidget {
  const ExamReviewScreen({
    super.key,
    required this.sessionId,
    required this.result,
  });

  final String sessionId;
  final ExamResultViewData result;

  @override
  ConsumerState<ExamReviewScreen> createState() => _ExamReviewScreenState();
}

class _ExamReviewScreenState extends ConsumerState<ExamReviewScreen> {
  CoachFeedback? _aiFeedback;
  bool _loadingAi = false;

  Future<void> _fetchAiFeedback() async {
    setState(() => _loadingAi = true);
    try {
      final feedbackMap = await ref
          .read(aiRepositoryProvider)
          .getCoachFeedback(
            sessionId: widget.sessionId,
            language: 'es',
            examSummary: widget.result.toJson(),
          );
      if (mounted) {
        setState(() {
          _aiFeedback = CoachFeedback.fromJson(feedbackMap);
          _loadingAi = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loadingAi = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not get AI analysis: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final feedback = _aiFeedback ?? widget.result.coachFeedback;

    return Scaffold(
      appBar: AppBar(title: const Text('Exam summary')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(22),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.result.passed ? 'Passed' : 'Keep going',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      _ResultChip(
                        label: 'Score',
                        value: '${widget.result.score}/${widget.result.total}',
                      ),
                      _ResultChip(
                        label: 'Accuracy',
                        value: '${widget.result.accuracy}%',
                      ),
                      _ResultChip(
                        label: 'XP',
                        value: '+${widget.result.xpEarned}',
                      ),
                      _ResultChip(
                        label: 'Readiness',
                        value: '${widget.result.readinessScore}%',
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          Card(
            color: _aiFeedback != null
                ? Theme.of(
                    context,
                  ).colorScheme.primaryContainer.withValues(alpha: 0.3)
                : null,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Coach feedback',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (_aiFeedback == null)
                        TextButton.icon(
                          onPressed: _loadingAi ? null : _fetchAiFeedback,
                          icon: _loadingAi
                              ? const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.auto_awesome, size: 16),
                          label: const Text('AI Analysis'),
                        )
                      else
                        const Icon(
                          Icons.auto_awesome,
                          color: Colors.purple,
                          size: 20,
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    feedback.headline,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 8),
                  Text(feedback.summary),
                  const SizedBox(height: 12),
                  Text(
                    'Focus Area:',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ),
                  Text(feedback.focus),
                  if (feedback.trend != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      'AI Insight:',
                      style: Theme.of(
                        context,
                      ).textTheme.labelLarge?.copyWith(color: Colors.purple),
                    ),
                    Text(feedback.trend!),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 18),
          if (widget.result.topicBreakdown.isNotEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Topic breakdown',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ...widget.result.topicBreakdown.map(
                      (topic) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(topic.name),
                        subtitle: Text('${topic.attempted} attempts'),
                        trailing: Text('${topic.accuracy}%'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (widget.result.newBadges.isNotEmpty) ...[
            const SizedBox(height: 18),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Unlocked',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ...widget.result.newBadges.map(
                      (badge) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(badge.title),
                        subtitle: Text(badge.description),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: () => context.go('/dashboard'),
            child: const Text('Back to dashboard'),
          ),
        ],
      ),
    );
  }
}

class _ResultChip extends StatelessWidget {
  const _ResultChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.secondaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelSmall),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }
}
