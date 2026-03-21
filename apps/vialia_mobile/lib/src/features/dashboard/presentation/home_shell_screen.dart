import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../exam/presentation/practice_tab.dart';
import '../../flashcards/presentation/flashcards_tab.dart';
import '../../profile/presentation/bookmarks_tab.dart';
import '../../profile/presentation/profile_tab.dart';
import 'dashboard_tab.dart';

class HomeShellScreen extends StatelessWidget {
  const HomeShellScreen({super.key, required this.currentIndex});

  final int currentIndex;

  static const _paths = [
    '/dashboard',
    '/practice',
    '/flashcards',
    '/bookmarks',
    '/profile',
  ];

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final pages = [
      const DashboardTab(),
      const PracticeTab(),
      const FlashcardsTab(),
      const BookmarksTab(),
      const ProfileTab(),
    ];

    return Scaffold(
      extendBody: true,
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              colorScheme.surface,
              colorScheme.primary.withOpacity(0.06),
              colorScheme.secondary.withOpacity(0.08),
            ],
          ),
        ),
        child: SafeArea(
          bottom: false,
          child: IndexedStack(index: currentIndex, children: pages),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (index) => context.go(_paths[index]),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.space_dashboard_outlined),
            label: 'Dashboard',
          ),
          NavigationDestination(
            icon: Icon(Icons.fact_check_outlined),
            label: 'Practice',
          ),
          NavigationDestination(
            icon: Icon(Icons.style_outlined),
            label: 'Flashcards',
          ),
          NavigationDestination(
            icon: Icon(Icons.bookmark_outline),
            label: 'Bookmarks',
          ),
          NavigationDestination(
            icon: Icon(Icons.tune_outlined),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
