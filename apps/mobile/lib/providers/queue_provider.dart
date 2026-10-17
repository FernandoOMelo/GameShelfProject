import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/queue_api.dart';
import '../models/game.dart';
import '../models/queue_item.dart';

class QueueNotifier extends AsyncNotifier<List<QueueItem>> {
  @override
  Future<List<QueueItem>> build() => QueueApi.list();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(QueueApi.list);
  }

  Future<void> add(Game game) async {
    await QueueApi.add(game.id);
    await refresh();
  }

  Future<void> remove(String gameId) async {
    await QueueApi.remove(gameId);
    await refresh();
  }

  Future<void> reorder(List<String> gameIds) async {
    await QueueApi.reorder(gameIds);
    await refresh();
  }

  /// Recoloca um jogo na fila na posição de origem (usado pelo "Desfazer").
  Future<void> restore(QueueItem item, int index) async {
    await QueueApi.add(item.game.id);
    final items = await QueueApi.list();
    final gameIds = items
        .map((entry) => entry.game.id)
        .where((id) => id != item.game.id)
        .toList();
    gameIds.insert(index.clamp(0, gameIds.length), item.game.id);
    await QueueApi.reorder(gameIds);
    await refresh();
  }
}

final queueProvider = AsyncNotifierProvider<QueueNotifier, List<QueueItem>>(QueueNotifier.new);
