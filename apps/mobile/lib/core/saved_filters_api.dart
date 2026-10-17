import '../models/saved_filter.dart';
import 'api_client.dart';

class SavedFiltersApi {
  static Future<List<SavedFilter>> list() async {
    final data = await ApiClient.instance.getCached<List<dynamic>>('/saved-filters');
    return data.map((e) => SavedFilter.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<SavedFilter> create(String name, LibraryFilterState filters) async {
    final response = await ApiClient.instance.post<Map<String, dynamic>>(
      '/saved-filters',
      data: {'name': name, 'filters': filters.toJson()},
    );
    return SavedFilter.fromJson(response.data!);
  }

  static Future<void> delete(String id) async {
    await ApiClient.instance.delete('/saved-filters/$id');
  }
}
