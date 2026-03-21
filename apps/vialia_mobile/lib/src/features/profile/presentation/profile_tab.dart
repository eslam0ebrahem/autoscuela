import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_theme.dart';
import '../../auth/presentation/auth_controller.dart';
import '../data/profile_repository.dart';

class ProfileTab extends ConsumerWidget {
  const ProfileTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).asData?.value;
    if (user == null) {
      return const SizedBox.shrink();
    }

    Future<void> updatePreferences({String? language, String? theme}) async {
      final updated = await ref
          .read(profileRepositoryProvider)
          .updatePreferences(language: language, theme: theme);
      await ref.read(authControllerProvider.notifier).replaceUser(updated);
    }

    Future<void> logout() async {
      await ref.read(authControllerProvider.notifier).logout();
      if (context.mounted) {
        context.go('/login');
      }
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 120),
      children: [
        Text(
          'Profile',
          style: Theme.of(
            context,
          ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 18),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user.nickname,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(user.email),
                const SizedBox(height: 18),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    _TinyMetric(label: 'Role', value: user.role),
                    _TinyMetric(
                      label: 'Streak',
                      value: '${user.currentStreak}d',
                    ),
                    _TinyMetric(label: 'XP', value: '${user.totalXp}'),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Language',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 12),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'es', label: Text('ES')),
                    ButtonSegment(value: 'en', label: Text('EN')),
                  ],
                  selected: {user.language},
                  onSelectionChanged: (selection) =>
                      updatePreferences(language: selection.first),
                ),
                const SizedBox(height: 20),
                Text('Theme', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                SegmentedButton<ThemeMode>(
                  segments: const [
                    ButtonSegment(value: ThemeMode.light, label: Text('Light')),
                    ButtonSegment(value: ThemeMode.dark, label: Text('Dark')),
                    ButtonSegment(
                      value: ThemeMode.system,
                      label: Text('System'),
                    ),
                  ],
                  selected: {
                    switch (user.theme) {
                      'light' => ThemeMode.light,
                      'dark' => ThemeMode.dark,
                      _ => ThemeMode.system,
                    },
                  },
                  onSelectionChanged: (selection) async {
                    final mode = selection.first;
                    await ref
                        .read(themeModeControllerProvider.notifier)
                        .setThemeMode(mode);
                    await updatePreferences(
                      theme: switch (mode) {
                        ThemeMode.light => 'light',
                        ThemeMode.dark => 'dark',
                        ThemeMode.system => 'system',
                      },
                    );
                  },
                ),
                const SizedBox(height: 20),
                FilledButton.tonal(
                  onPressed: logout,
                  child: const Text('Log out'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _TinyMetric extends StatelessWidget {
  const _TinyMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(18),
        color: Theme.of(context).colorScheme.primary.withOpacity(0.08),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelMedium),
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
