import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'dart:convert';
import '../config/app_config.dart';

final groqClientProvider = Provider<GroqClient>((ref) {
  return GroqClient(
    dio: Dio(
      BaseOptions(
        baseUrl: 'https://api.groq.com/openai/v1',
        headers: {
          'Authorization': 'Bearer ${AppConfig.groqApiKey}',
          'Content-Type': 'application/json',
        },
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
      ),
    ),
  );
});

class GroqClient {
  GroqClient({required Dio dio}) : _dio = dio;

  final Dio _dio;
  static const String model = 'llama-3.3-70b-versatile';
  static const String fastModel = 'llama-3.1-8b-instant';

  Future<String> chatCompletion({
    required List<Map<String, String>> messages,
    bool useFastModel = false,
    double temperature = 0.2,
    bool jsonResponse = true,
  }) async {
    try {
      final response = await _dio.post(
        '/chat/completions',
        data: {
          'model': useFastModel ? fastModel : model,
          'messages': messages,
          'temperature': temperature,
          if (jsonResponse) 'response_format': {'type': 'json_object'},
        },
      );

      final content =
          response.data['choices'][0]['message']['content'] as String;
      return content;
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      final message =
          e.response?.data?['error']?['message'] ??
          'AI service unavailable ($status)';
      throw Exception(message);
    } catch (e) {
      throw Exception('Unexpected AI error: $e');
    }
  }

  Map<String, dynamic>? safeParseJson(String raw) {
    try {
      return jsonDecode(raw) as Map<String, dynamic>?;
    } catch (_) {
      // Basic markdown stripping if necessary
      final stripped = raw
          .replaceAll(RegExp(r'^```json\s*', caseSensitive: false), '')
          .replaceAll(RegExp(r'```\s*$', caseSensitive: false), '')
          .trim();
      try {
        return jsonDecode(stripped) as Map<String, dynamic>?;
      } catch (_) {
        return null;
      }
    }
  }
}
