import '../models/metadata_sync.dart';
import 'api_client.dart';

/// Revisão da captura automática de metadados (ADR-043).
class MetadataSyncApi {
  static Future<MetadataReview> review() async {
    final response = await ApiClient.instance.get<Map<String, dynamic>>('/metadata-sync/review');
    return MetadataReview.fromJson(response.data!);
  }

  /// Varredura manual dos jogos pendentes; devolve quantos foram consultados.
  static Future<int> run() async {
    final response = await ApiClient.instance.dio.post<Map<String, dynamic>>('/metadata-sync/run');
    return response.data!['checked'] as int;
  }

  static Future<void> use(String gameId, String providerId) => _post(gameId, 'use', {'providerId': providerId});
  static Future<void> search(String gameId, String query) => _post(gameId, 'search', {'query': query});
  static Future<void> ignore(String gameId) => _post(gameId, 'ignore');
  static Future<void> confirm(String gameId) => _post(gameId, 'confirm');
  static Future<void> undo(String gameId) => _post(gameId, 'undo');

  static Future<void> _post(String gameId, String action, [Map<String, dynamic>? body]) async {
    await ApiClient.instance.dio.post<Map<String, dynamic>>('/metadata-sync/$gameId/$action', data: body);
  }
}
