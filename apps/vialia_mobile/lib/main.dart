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
      debugPrint('Uncaught async error: $error');
      // Ignore mongo_dart background connection drops that leak unhandled exceptions 
      final errorStr = error.toString();
      if (errorStr.contains('Software caused connection abort') ||
          errorStr.contains('No master connection') ||
          errorStr.contains('SocketException')) {
        return;
      }
    },
  );
}
