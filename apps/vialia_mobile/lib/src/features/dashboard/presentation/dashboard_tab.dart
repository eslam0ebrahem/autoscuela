import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/widgets/async_state_view.dart';
import '../data/dashboard_repository.dart';
import '../domain/dashboard_models.dart';
import '../../exam/data/ai_repository.dart';

class DashboardTab extends ConsumerStatefulWidget {
  const DashboardTab({super.key});

  @override
  ConsumerState<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends ConsumerState<DashboardTab> {
  bool _loadingAi = false;

  Future<void> _showStudyPlan() async {
    setState(() => _loadingAi = true);
    try {
      final targetDate = DateFormat(
        'yyyy-MM-dd',
      ).format(DateTime.now().add(const Duration(days: 30)));
      final dashboard = ref.read(dashboardProvider).value;
      final plan = await ref
          .read(aiRepositoryProvider)
          .getStudyPlan(
            targetDate: targetDate,
            skillProfile: {
              'overallLevel': dashboard?.skillLevel ?? 'beginner',
              'overallAccuracy': dashboard?.accuracy ?? 0,
            },
          );
      if (mounted) {
        setState(() => _loadingAi = false);
        _showAiModal(
          'AI Study Plan',
          plan['recommendations']?.toString() ?? 'No plan available yet.',
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loadingAi = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Could not generate plan: $e')));
      }
    }
  }

  Future<void> _showMistakeAnalysis() async {
    setState(() => _loadingAi = true);
    try {
      final dashboard = ref.read(dashboardProvider).value;
      final analysis = await ref
          .read(aiRepositoryProvider)
          .getMistakePatterns(
            mistakeGroups: dashboard?.weakTopics
                .map((t) => {'topic': t.name, 'count': t.attempted})
                .toList(),
          );
      if (mounted) {
        setState(() => _loadingAi = false);
        _showAiModal(
          'Mistake Analysis',
          analysis['analysis']?.toString() ?? 'No patterns found yet.',
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _loadingAi = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not analyze mistakes: $e')),
        );
      }
    }
  }

  void _showAiModal(String title, String content) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => Container(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 40),
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.8,
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.auto_awesome,
                    color: Colors.purple,
                    size: 24,
                  ),
                  const SizedBox(width: 12),
                  Text(
                    title,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Text(
                content,
                style: Theme.of(
                  context,
                ).textTheme.bodyLarge?.copyWith(height: 1.6, fontSize: 16),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final dashboard = ref.watch(dashboardProvider);
    return AsyncStateView<DashboardBundle>(
      value: dashboard,
      onRetry: () => ref.invalidate(dashboardProvider),
      loadingMessage: 'Pulling your latest study signal...',
      data: (data) {
        return RefreshIndicator(
          onRefresh: () async => ref.refresh(dashboardProvider.future),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
            children: [
              Text(
                'Study momentum',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'A mobile-first snapshot of the areas that move your DGT readiness fastest.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 20),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(22),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Readiness',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${data.readinessScore}%',
                        style: Theme.of(context).textTheme.displaySmall
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 8),
                      Text(data.coachFeedback.summary),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: [
                          _MetricChip(label: 'Skill', value: data.skillLevel),
                          _MetricChip(
                            label: 'Streak',
                            value: '${data.streak}d',
                          ),
                          _MetricChip(
                            label: 'Accuracy',
                            value: '${data.accuracy}%',
                          ),
                          _MetricChip(
                            label: 'Exams',
                            value: '${data.totalExams}',
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      onPressed: () => context.go('/practice'),
                      child: const Text('Start practice'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => context.go('/flashcards'),
                      child: const Text('Review cards'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: _AiActionCard(
                      title: 'Study Plan',
                      icon: Icons.calendar_today_outlined,
                      onTap: _loadingAi ? null : _showStudyPlan,
                      isLoading: _loadingAi,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _AiActionCard(
                      title: 'Mistake Analysis',
                      icon: Icons.analytics_outlined,
                      onTap: _loadingAi ? null : _showMistakeAnalysis,
                      isLoading: _loadingAi,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              _SectionCard(
                title: 'Weak topics',
                child: data.weakTopics.isEmpty
                    ? Text(
                        'No study data yet. Complete a practice exam to see your weak topics.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.outline,
                        ),
                      )
                    : Column(
                        children: data.weakTopics.take(3).map((topic) {
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(topic.name),
                            subtitle: Text('${topic.attempted} attempts'),
                            trailing: Text('${topic.accuracy}%'),
                          );
                        }).toList(),
                      ),
              ),
              const SizedBox(height: 18),
              _SectionCard(
                title: 'Recent rhythm',
                child: data.trend.isEmpty
                    ? Text(
                        'Start studying to see your progress over time.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.outline,
                        ),
                      )
                    : Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: data.trend.take(7).map((point) {
                          return Container(
                            width: 88,
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(20),
                              color: Theme.of(
                                context,
                              ).colorScheme.primary.withValues(alpha: 0.08),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  point.date.substring(5),
                                  style: Theme.of(context).textTheme.labelLarge,
                                ),
                                const SizedBox(height: 6),
                                Text('${point.questions} q'),
                                Text('${point.accuracy}%'),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
              ),
              const SizedBox(height: 18),
              _SectionCard(
                title: 'Leaderboard',
                child: data.leaderboard.isEmpty
                    ? Text(
                        'No leaderboard data available.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.outline,
                        ),
                      )
                    : Column(
                        children: data.leaderboard.take(5).map((entry) {
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: CircleAvatar(child: Text('${entry.rank}')),
                            title: Text(entry.nickname),
                            subtitle: Text('${entry.weeklyXp} XP this week'),
                            trailing: entry.isCurrentUser
                                ? const Text('You')
                                : null,
                          );
                        }).toList(),
                      ),
              ),
              if (data.badges.isNotEmpty) ...[
                const SizedBox(height: 18),
                _SectionCard(
                  title: 'Earned badges',
                  child: Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: data.badges.map((badge) {
                      return Chip(
                        avatar: const Icon(Icons.emoji_events, size: 18),
                        label: Text(badge.title),
                      );
                    }).toList(),
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _MetricChip extends StatelessWidget {
  const _MetricChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.08),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 14),
            child,
          ],
        ),
      ),
    );
  }
}

class _AiActionCard extends StatelessWidget {
  const _AiActionCard({
    required this.title,
    required this.icon,
    required this.onTap,
    this.isLoading = false,
  });

  final String title;
  final IconData icon;
  final VoidCallback? onTap;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Theme.of(
        context,
      ).colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
          child: Column(
            children: [
              Icon(icon, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: 12),
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.auto_awesome,
                    size: 12,
                    color: Colors.purple,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'AI Powered',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: Colors.purple,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
