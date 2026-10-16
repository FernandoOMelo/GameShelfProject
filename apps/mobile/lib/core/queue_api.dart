import '../models/queue_item.dart';
import 'api_client.dart';

class QueueApi {
  static Future<List<QueueItem>> list() async {
    final data = await ApiClient.instance.getCached<List<dynamic>>('/queue');
    return data.map((e) => QueueItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> add(String gameId) async {
    await ApiClient.instance.post<dynamic>('/queue', data: {'gameId': gameId});
  }

  static Future<void> remove(String gameId) async {
    await ApiClient.instance.delete('/queue/$gameId');
  }

  static Future<void> reorder(List<String> gameIds) async {
    await ApiClient.instance.put('/queue/order', data: {'gameIds': gameIds});
  }
}
