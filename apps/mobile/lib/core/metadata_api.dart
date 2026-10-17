import '../models/metadata.dart';
import 'api_client.dart';

/// Busca externa de metadata (IGDB) e de tempos (HowLongToBeat).
class MetadataApi {
  static Future<List<GameMetadataCandidate>> searchGames(String query) async {
    final response = await ApiClient.instance.get<dynamic>(
      '/metadata/games',
      queryParameters: {'query': query},
    );
    return (response.data as List<dynamic>)
        .map((e) => GameMetadataCandidate.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<List<GameTimeEstimate>> searchTimeEstimates(String query) async {
    final response = await ApiClient.instance.get<dynamic>(
      '/metadata/time-estimates',
      queryParameters: {'query': query},
    );
    return (response.data as List<dynamic>)
        .map((e) => GameTimeEstimate.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
