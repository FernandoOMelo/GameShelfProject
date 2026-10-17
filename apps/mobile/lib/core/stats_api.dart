import '../models/activity.dart';
import '../models/stats.dart';
import 'api_client.dart';

/// Estatísticas, atividade e replay. Os cálculos vêm todos da API.
class StatsApi {
  static Future<StatsResponse> stats() async {
    final data = await ApiClient.instance.getCached<Map<String, dynamic>>('/stats');
    return StatsResponse.fromJson(data);
  }

  static Future<ActivityResponse> activity({int? year}) async {
    final data = await ApiClient.instance.getCached<Map<String, dynamic>>(
      '/stats/activity',
      queryParameters: {
        'year': ?year,
        'timezoneOffsetMinutes': DateTime.now().timeZoneOffset.inMinutes,
      },
    );
    return ActivityResponse.fromJson(data);
  }

  static Future<ReplayResponse> replay({int? year}) async {
    final data = await ApiClient.instance.getCached<Map<String, dynamic>>(
      '/stats/replay',
      queryParameters: {
        'year': ?year,
        'timezoneOffsetMinutes': DateTime.now().timeZoneOffset.inMinutes,
      },
    );
    return ReplayResponse.fromJson(data);
  }
}
