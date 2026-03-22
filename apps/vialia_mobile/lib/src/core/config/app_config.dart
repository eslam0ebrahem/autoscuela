import 'package:flutter_dotenv/flutter_dotenv.dart';

class AppConfig {
  const AppConfig._();

  static String get mongoUri {
    final value = dotenv.env['MONGODB_URI'];
    if (value == null || value.isEmpty) {
      throw Exception('MONGODB_URI not found in environment');
    }
    return value;
  }

  static String get groqApiKey {
    final value = dotenv.env['GROQ_API_KEY'];
    if (value == null || value.isEmpty) {
      throw Exception('GROQ_API_KEY not found in environment');
    }
    return value;
  }
}
