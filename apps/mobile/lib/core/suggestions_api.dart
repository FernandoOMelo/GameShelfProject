import '../models/suggestion.dart';
import 'api_client.dart';

/// Sugestões de próximo jogo (`GET /backlog/suggestions`).
class SuggestionsApi {
  static Future<List<Suggestion>> list() async {
    final data = await ApiClient.instance.getCached<List<dynamic>>(
      '/backlog/suggestions',
      queryParameters: {
        'timezoneOffsetMinutes': DateTime.now().timeZoneOffset.inMinutes,
      },
    );
    return data.map((e) => Suggestion.fromJson(e as Map<String, dynamic>)).toList();
  }
}
