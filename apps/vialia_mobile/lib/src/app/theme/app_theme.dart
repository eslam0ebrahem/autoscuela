import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/storage/preferences_service.dart';

final themeModeControllerProvider =
    AsyncNotifierProvider<ThemeModeController, ThemeMode>(
      ThemeModeController.new,
    );

class ThemeModeController extends AsyncNotifier<ThemeMode> {
  @override
  Future<ThemeMode> build() {
    return ref.read(preferencesServiceProvider).loadThemeMode();
  }

  Future<void> setThemeMode(ThemeMode mode) async {
    state = AsyncData(mode);
    await ref.read(preferencesServiceProvider).saveThemeMode(mode);
  }
}

class AppTheme {
  static ThemeData lightTheme() {
    const seed = Color(0xFF0C6E71);
    final scheme = ColorScheme.fromSeed(
      seedColor: seed,
      brightness: Brightness.light,
      primary: seed,
      secondary: const Color(0xFFC47A2C),
      surface: const Color(0xFFFBF7F0),
    );

    return _themeFromScheme(scheme);
  }

  static ThemeData darkTheme() {
    const seed = Color(0xFF53B7B1);
    final scheme = ColorScheme.fromSeed(
      seedColor: seed,
      brightness: Brightness.dark,
      primary: seed,
      secondary: const Color(0xFFFFB45C),
      surface: const Color(0xFF121818),
    );

    return _themeFromScheme(scheme);
  }

  static ThemeData _themeFromScheme(ColorScheme scheme) {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: scheme.surface,
      textTheme: GoogleFonts.plusJakartaSansTextTheme(),
    );

    return base.copyWith(
      cardTheme: CardThemeData(
        color: scheme.brightness == Brightness.dark
            ? scheme.surfaceContainerHighest.withValues(alpha: 0.72)
            : Colors.white.withValues(alpha: 0.92),
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(28),
          side: BorderSide(color: scheme.outlineVariant.withValues(alpha: 0.4)),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        height: 76,
        backgroundColor: scheme.brightness == Brightness.dark
            ? const Color(0xFF0E1315)
            : Colors.white.withValues(alpha: 0.9),
        indicatorColor: scheme.primary.withValues(alpha: 0.14),
        labelTextStyle: WidgetStateProperty.all(
          base.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: base.textTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w800,
          color: scheme.onSurface,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: scheme.brightness == Brightness.dark
            ? scheme.surfaceContainerHighest.withValues(alpha: 0.55)
            : Colors.white.withValues(alpha: 0.9),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 16,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(22),
          ),
          textStyle: base.textTheme.labelLarge?.copyWith(
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(22),
          ),
          side: BorderSide(color: scheme.outlineVariant),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
    );
  }
}
