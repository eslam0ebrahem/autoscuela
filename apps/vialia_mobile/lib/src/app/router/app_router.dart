import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/auth_controller.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/presentation/splash_screen.dart';
import '../../features/dashboard/presentation/home_shell_screen.dart';
import '../../features/exam/domain/exam_models.dart';
import '../../features/exam/presentation/exam_review_screen.dart';
import '../../features/exam/presentation/exam_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authControllerProvider);

  return GoRouter(
    initialLocation: '/splash',
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/dashboard',
        builder: (context, state) => const HomeShellScreen(currentIndex: 0),
      ),
      GoRoute(
        path: '/practice',
        builder: (context, state) => const HomeShellScreen(currentIndex: 1),
      ),
      GoRoute(
        path: '/flashcards',
        builder: (context, state) => const HomeShellScreen(currentIndex: 2),
      ),
      GoRoute(
        path: '/bookmarks',
        builder: (context, state) => const HomeShellScreen(currentIndex: 3),
      ),
      GoRoute(
        path: '/profile',
        builder: (context, state) => const HomeShellScreen(currentIndex: 4),
      ),
      GoRoute(
        path: '/exam/:sessionId',
        builder: (_, state) =>
            ExamScreen(sessionId: state.pathParameters['sessionId']!),
      ),
      GoRoute(
        path: '/exam/:sessionId/review',
        builder: (_, state) => ExamReviewScreen(
          sessionId: state.pathParameters['sessionId']!,
          result: state.extra as ExamResultViewData,
        ),
      ),
    ],
    redirect: (_, state) {
      final location = state.matchedLocation;
      final isLoading = authState.isLoading;
      final isAuthenticated = authState.asData?.value != null;
      final isAuthRoute = location == '/login' || location == '/register';

      if (isLoading && location != '/splash') {
        return '/splash';
      }
      if (!isLoading && !isAuthenticated && !isAuthRoute) {
        return '/login';
      }
      if (!isLoading &&
          isAuthenticated &&
          (isAuthRoute || location == '/splash')) {
        return '/dashboard';
      }
      if (!isLoading && !isAuthenticated && location == '/splash') {
        return '/login';
      }

      return null;
    },
  );
});
