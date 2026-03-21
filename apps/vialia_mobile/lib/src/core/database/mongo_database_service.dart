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

  Future<mongo.Db> get database async {
    bool isStale = false;
    if (_db != null && _db!.isConnected) {
      try {
        // In mongo_dart, isConnected can be true while master connection is lost.
        // Accessing masterConnection will throw if it's not ready.
        _db!.masterConnection;
      } catch (_) {
        isStale = true;
      }
    }

    if (_db != null && _db!.isConnected && !isStale) {
      return _db!;
    }

    if (_opening != null) {
      await _opening;
      if (_db != null && _db!.isConnected) {
        return _db!;
      }
    }

    _opening = _open();
    try {
      await _opening;
    } finally {
      _opening = null;
    }

    if (_db == null || !_db!.isConnected) {
      throw Exception('Failed to establish MongoDB connection');
    }

    return _db!;
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
        final isSecure = _uri.contains('tls=true') || 
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
            try { await _db!.close(); } catch (_) {}
            _db = null;
            throw Exception('Connection verification failed: $pingError');
          }
        } else {
          throw Exception('MongoDB connection failed');
        }
      } catch (e) {
        debugPrint('Error connecting (attempt ${i + 1}): $e');
        if (i == 2) {
          _db = null;
          rethrow;
        }
        await Future<void>.delayed(Duration(seconds: 2 + i));
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
