import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/presentation/auth_controller.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';

class VialiaApp extends ConsumerWidget {
  const VialiaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode =
        ref.watch(themeModeControllerProvider).value ?? ThemeMode.system;
    final router = ref.watch(appRouterProvider);
    final authState = ref.watch(authControllerProvider);
    final localeCode = authState.asData?.value?.language ?? 'es';

    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'Vialia',
      theme: AppTheme.lightTheme(),
      darkTheme: AppTheme.darkTheme(),
      themeMode: themeMode,
      routerConfig: router,
      locale: Locale(localeCode),
      supportedLocales: const [Locale('es'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
    );
  }
}
