import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mongo_dart/mongo_dart.dart' as mongo;

import '../config/app_config.dart';

final mongoDatabaseServiceProvider = Provider<MongoDatabaseService>((ref) {
  final service = MongoDatabaseService(AppConfig.mongoUri);
  ref.onDispose(service.dispose);
  return service;
});

class MongoDatabaseService {
  MongoDatabaseService(this._uri);

  final String _uri;
  mongo.Db? _db;
  Future<void>? _opening;
  DateTime? _lastAccess;

  Future<mongo.Db> get database async {
    // We'll try to get/restore the connection up to 3 times
    for (int i = 0; i < 3; i++) {
      bool isStale = false;
      if (_db != null && _db!.isConnected) {
        try {
          // Heartbeat check for older connections (more than 2 minutes idle)
          final now = DateTime.now();
          if (_lastAccess != null &&
              now.difference(_lastAccess!) > const Duration(minutes: 2)) {
            // Use pingCommand for a much lighter and faster health check than findOne
            await _db!.pingCommand().timeout(const Duration(seconds: 2));
          } else {
            // Normal check for topology discovery readiness
            _db!.masterConnection;
          }
        } catch (e) {
          debugPrint(
            'MongoDB connection detected as stale/closed (${e.runtimeType}), reconnecting...',
          );
          isStale = true;
        }
      }

      if (_db != null && _db!.isConnected && !isStale) {
        _lastAccess = DateTime.now();
        return _db!;
      }

      // If stale or disconnected, wait for any pending opening or start a new one
      if (_opening != null) {
        await _opening;
        if (_db != null && _db!.isConnected) {
          _lastAccess = DateTime.now();
          return _db!;
        }
      }

      _opening = _open();
      try {
        await _opening;
      } catch (e) {
        debugPrint('Failed to open database in attempt ${i + 1}: $e');
        if (i == 2) rethrow;
        await Future<void>.delayed(Duration(seconds: 1 + i));
        continue;
      } finally {
        _opening = null;
      }

      if (_db != null && _db!.isConnected) {
        _lastAccess = DateTime.now();
        return _db!;
      }
    }

    throw Exception('Failed to establish MongoDB connection after retries');
  }

  Future<mongo.DbCollection> get users async =>
      (await database).collection('users');

  Future<mongo.DbCollection> get questions async =>
      (await database).collection('questions');

  Future<mongo.DbCollection> get examSessions async =>
      (await database).collection('examsessions');

  Future<mongo.DbCollection> get userAnswers async =>
      (await database).collection('useranswers');

  Future<mongo.DbCollection> get flashcardProgress async =>
      (await database).collection('flashcardprogresses');

  Future<void> _open() async {
    for (int i = 0; i < 3; i++) {
      try {
        debugPrint('Connecting to MongoDB (attempt ${i + 1})...');
        if (_db != null) {
          try {
            await _db!.close();
          } catch (_) {}
        }

        _db = await mongo.Db.create(_uri);

        // Pass secure: true if URI indicates TLS/SSL or it's an Atlas SRV connection
        final isSecure =
            _uri.contains('tls=true') ||
            _uri.contains('ssl=true') ||
            _uri.startsWith('mongodb+srv');

        await _db!.open(secure: isSecure);

        if (_db!.isConnected) {
          debugPrint('MongoDB opened, waiting for master discovery...');

          // Atlas can take a moment to discover the topology
          // We'll try to find a document with a timeout
          try {
            final coll = _db!.collection('questions');
            // Using a simple query with a timeout to verify the connection is truly ready
            await coll.findOne().timeout(const Duration(seconds: 5));
            debugPrint('MongoDB connection verified');
            return;
          } catch (pingError) {
            debugPrint('Verification failed after connected: $pingError');
            // If verification fails, we should close and retry
            try {
              await _db!.close();
            } catch (_) {}
            _db = null;
            throw Exception('Connection verification failed: $pingError');
          }
        } else {
          throw Exception('MongoDB connection failed');
        }
      } catch (e) {
        debugPrint('Error connecting (attempt ${i + 1}): $e');
        // Bail out immediately for unrecoverable errors (DNS/network)
        final msg = e.toString();
        if (msg.contains('host lookup') ||
            msg.contains('No address associated') ||
            msg.contains('network is unreachable')) {
          _db = null;
          throw Exception(
            'No internet connection. Check your network and try again.',
          );
        }
        if (i == 2) {
          _db = null;
          rethrow;
        }
        await Future<void>.delayed(Duration(seconds: 1 + i));
      }
    }
  }

  Future<void> dispose() async {
    if (_db != null) {
      try {
        await _db!.close();
      } catch (_) {}
      _db = null;
    }
  }
}
