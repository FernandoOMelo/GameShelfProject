import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/lists_api.dart';
import '../models/game_list.dart';

class ListsNotifier extends AsyncNotifier<List<GameListSummary>> {
  @override
  Future<List<GameListSummary>> build() => ListsApi.list();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(ListsApi.list);
  }

  Future<GameListSummary> create(String name) async {
    final created = await ListsApi.create(name);
    await refresh();
    return created;
  }

  Future<void> rename(String id, String name) async {
    await ListsApi.rename(id, name);
    await refresh();
  }

  Future<void> delete(String id) async {
    await ListsApi.delete(id);
    await refresh();
  }
}

final listsProvider =
    AsyncNotifierProvider<ListsNotifier, List<GameListSummary>>(ListsNotifier.new);

final listDetailProvider = FutureProvider.family<GameList, String>(
  (ref, listId) => ListsApi.get(listId),
);
