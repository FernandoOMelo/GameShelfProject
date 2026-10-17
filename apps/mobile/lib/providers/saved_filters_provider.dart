import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/saved_filters_api.dart';
import '../models/saved_filter.dart';

class SavedFiltersNotifier extends AsyncNotifier<List<SavedFilter>> {
  @override
  Future<List<SavedFilter>> build() => SavedFiltersApi.list();

  Future<void> refresh() async {
    state = await AsyncValue.guard(SavedFiltersApi.list);
  }

  Future<SavedFilter> create(String name, LibraryFilterState filters) async {
    final created = await SavedFiltersApi.create(name, filters);
    await refresh();
    return created;
  }

  Future<void> delete(String id) async {
    await SavedFiltersApi.delete(id);
    await refresh();
  }
}

final savedFiltersProvider =
    AsyncNotifierProvider<SavedFiltersNotifier, List<SavedFilter>>(
  SavedFiltersNotifier.new,
);
