import '../models/suggestion.dart';
import 'api_client.dart';
import 'timezone.dart';

/// Sugestões de próximo jogo (`GET /backlog/suggestions`).
class SuggestionsApi {
  static Future<List<Suggestion>> list() async {
    final data = await ApiClient.instance.getCached<List<dynamic>>(
      '/backlog/suggestions',
      queryParameters: {
        'timezoneOffsetMinutes': apiTimezoneOffsetMinutes(),
      },
    );
    return data.map((e) => Suggestion.fromJson(e as Map<String, dynamic>)).toList();
  }
}
