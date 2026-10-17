import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/games_api.dart';
import '../core/sessions_api.dart';
import '../models/game.dart';
import '../models/session.dart';

class GamesNotifier extends AsyncNotifier<List<Game>> {
  @override
  Future<List<Game>> build() => GamesApi.list();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(GamesApi.list);
  }

  /// Recarrega sem piscar a tela (usado após edições que já atualizam o estado).
  Future<void> reload() async {
    state = await AsyncValue.guard(GamesApi.list);
  }

  Future<Game> create(Game game) async {
    final created = await GamesApi.create(game);
    await reload();
    return created;
  }

  Future<Game> updateGame(String id, Map<String, dynamic> values) async {
    final updated = await GamesApi.update(id, values);
    state = AsyncData([
      for (final game in state.valueOrNull ?? <Game>[])
        if (game.id == id) updated else game,
    ]);
    return updated;
  }

  Future<void> delete(String id) async {
    await GamesApi.delete(id);
    state = AsyncData([
      for (final game in state.valueOrNull ?? <Game>[])
        if (game.id != id) game,
    ]);
  }
}

final gamesProvider = AsyncNotifierProvider<GamesNotifier, List<Game>>(GamesNotifier.new);

class SessionsNotifier extends FamilyAsyncNotifier<List<Session>, String> {
  @override
  Future<List<Session>> build(String gameId) => SessionsApi.list(gameId);

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => SessionsApi.list(arg));
  }

  Future<Session?> save({required Session session, String? sessionId}) async {
    final result = sessionId == null
        ? await SessionsApi.create(arg, session)
        : await SessionsApi.update(arg, sessionId, session.toJson());
    if (result != null) await refresh();
    return result;
  }

  Future<void> delete(String sessionId) async {
    await SessionsApi.remove(arg, sessionId);
    state = AsyncData([
      for (final item in state.valueOrNull ?? <Session>[])
        if (item.id != sessionId) item,
    ]);
  }
}

final sessionsForGameProvider =
    AsyncNotifierProvider.family<SessionsNotifier, List<Session>, String>(
  SessionsNotifier.new,
);
