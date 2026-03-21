import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'src/app/app.dart';

void main() {
  runZonedGuarded(
    () {
      WidgetsFlutterBinding.ensureInitialized();
      runApp(const ProviderScope(child: VialiaApp()));
    },
    (error, stack) {
      final errorStr = error.toString();
      // Ignore mongo_dart background connection drops that leak unhandled exceptions
      if (errorStr.contains('Software caused connection abort') ||
          errorStr.contains('No master connection') ||
          errorStr.contains('SocketException') ||
          errorStr.contains('reset by peer') ||
          errorStr.contains('ConnectionException') ||
          errorStr.contains('Operation timed out') ||
          errorStr.contains('HandshakeException')) {
        return;
      }
      debugPrint('Uncaught async error: $error\n$stack');
    },
  );
}
