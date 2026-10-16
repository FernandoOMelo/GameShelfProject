import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/queue_api.dart';
import '../models/queue_item.dart';

class QueueNotifier extends AsyncNotifier<List<QueueItem>> {
  @override
  Future<List<QueueItem>> build() => QueueApi.list();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(QueueApi.list);
  }

  Future<void> remove(String gameId) async {
    await QueueApi.remove(gameId);
    await refresh();
  }

  Future<void> reorder(List<String> gameIds) async {
    await QueueApi.reorder(gameIds);
    await refresh();
  }
}

final queueProvider = AsyncNotifierProvider<QueueNotifier, List<QueueItem>>(QueueNotifier.new);
