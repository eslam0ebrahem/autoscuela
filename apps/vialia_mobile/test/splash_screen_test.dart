import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vialia_mobile/src/features/auth/presentation/splash_screen.dart';

void main() {
  testWidgets('renders splash screen branding', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: SplashScreen()));

    expect(find.text('Vialia'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
