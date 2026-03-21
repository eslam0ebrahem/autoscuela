import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth_repository.dart';
import '../domain/app_user.dart';

final authControllerProvider = AsyncNotifierProvider<AuthController, AppUser?>(
  AuthController.new,
);

class AuthController extends AsyncNotifier<AppUser?> {
  AuthRepository get _repository => ref.read(authRepositoryProvider);

  @override
  Future<AppUser?> build() async {
    return _repository.restoreSession();
  }

  Future<void> login({required String email, required String password}) async {
    final previous = state.asData?.value;
    state = const AsyncLoading();
    try {
      final session = await _repository.login(email: email, password: password);
      state = AsyncData(session.user);
    } catch (error, stackTrace) {
      state = AsyncData(previous);
      Error.throwWithStackTrace(error, stackTrace);
    }
  }

  Future<void> register({
    required String nickname,
    required String email,
    required String password,
    required String language,
  }) async {
    final previous = state.asData?.value;
    state = const AsyncLoading();
    try {
      final session = await _repository.register(
        nickname: nickname,
        email: email,
        password: password,
        language: language,
      );
      state = AsyncData(session.user);
    } catch (error, stackTrace) {
      state = AsyncData(previous);
      Error.throwWithStackTrace(error, stackTrace);
    }
  }

  Future<void> refreshUser() async {
    final user = await _repository.currentUser();
    state = AsyncData(user);
  }

  Future<void> replaceUser(AppUser user) async {
    state = AsyncData(user);
  }

  Future<void> logout() async {
    await _repository.clearSession();
    state = const AsyncData(null);
  }
}
