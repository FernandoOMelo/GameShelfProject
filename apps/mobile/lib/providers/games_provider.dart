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
}

final gamesProvider = AsyncNotifierProvider<GamesNotifier, List<Game>>(GamesNotifier.new);

final sessionsForGameProvider = FutureProvider.family<List<Session>, String>((ref, gameId) async {
  return SessionsApi.list(gameId);
});
