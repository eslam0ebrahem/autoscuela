import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService(
    const FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
    ),
  );
});

class SecureStorageService {
  SecureStorageService(this._storage);

  final FlutterSecureStorage _storage;
  static const _currentUserIdKey = 'current_user_id';
  static const _authTokenKey = 'auth_token';

  Future<String?> readCurrentUserId() => _storage.read(key: _currentUserIdKey);

  Future<void> writeCurrentUserId(String userId) =>
      _storage.write(key: _currentUserIdKey, value: userId);

  Future<String?> readAuthToken() => _storage.read(key: _authTokenKey);

  Future<void> writeAuthToken(String token) =>
      _storage.write(key: _authTokenKey, value: token);

  Future<void> clearSession() => _storage.deleteAll();
}
