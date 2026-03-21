import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../exam/presentation/practice_tab.dart';
import '../../flashcards/presentation/flashcards_tab.dart';
import '../../profile/presentation/bookmarks_tab.dart';
import '../../profile/presentation/profile_tab.dart';
import 'dashboard_tab.dart';

class HomeShellScreen extends StatefulWidget {
  const HomeShellScreen({super.key, required this.currentIndex});

  final int currentIndex;

  @override
  State<HomeShellScreen> createState() => _HomeShellScreenState();
}

class _HomeShellScreenState extends State<HomeShellScreen> {
  late int _currentIndex;

  // Keep page instances alive across tab switches
  static const _pages = <Widget>[
    DashboardTab(),
    PracticeTab(),
    FlashcardsTab(),
    BookmarksTab(),
    ProfileTab(),
  ];

  static const _paths = [
    '/dashboard',
    '/practice',
    '/flashcards',
    '/bookmarks',
    '/profile',
  ];

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.currentIndex;
  }

  @override
  void didUpdateWidget(HomeShellScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.currentIndex != oldWidget.currentIndex) {
      setState(() => _currentIndex = widget.currentIndex);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      extendBody: true,
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              colorScheme.surface,
              colorScheme.primary.withValues(alpha: 0.06),
              colorScheme.secondary.withValues(alpha: 0.08),
            ],
          ),
        ),
        child: SafeArea(
          bottom: false,
          child: IndexedStack(index: _currentIndex, children: _pages),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          setState(() => _currentIndex = index);
          context.go(_paths[index]);
        },
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
