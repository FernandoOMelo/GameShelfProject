import '../models/activity.dart';
import 'achievement_series.dart';
import '../models/stats.dart';
import 'api_client.dart';
import 'timezone.dart';

/// Estatísticas, atividade e replay. Os cálculos vêm todos da API.
class StatsApi {
  /// [year] limita os números dos jogos zerados aos concluídos naquele ano; a
  /// biblioteca, as jornadas e as plataformas seguem completas.
  static Future<StatsResponse> stats({int? year}) async {
    final data = await ApiClient.instance.getCached<Map<String, dynamic>>(
      '/stats',
      queryParameters: {'year': ?year},
    );
    return StatsResponse.fromJson(data);
  }

  /// Conquistas desbloqueadas por dia (todos os jogos vinculados).
  static Future<AchievementSeries> achievementSeries() async {
    final data = await ApiClient.instance.getCached<Map<String, dynamic>>(
      '/stats/achievements',
      queryParameters: {'timezoneOffsetMinutes': apiTimezoneOffsetMinutes()},
    );
    return AchievementSeries.fromJson(data);
  }

  static Future<ActivityResponse> activity({int? year}) async {
    final data = await ApiClient.instance.getCached<Map<String, dynamic>>(
      '/stats/activity',
      queryParameters: {
        'year': ?year,
        'timezoneOffsetMinutes': apiTimezoneOffsetMinutes(),
      },
    );
    return ActivityResponse.fromJson(data);
  }

  static Future<ReplayResponse> replay({int? year}) async {
    final data = await ApiClient.instance.getCached<Map<String, dynamic>>(
      '/stats/replay',
      queryParameters: {
        'year': ?year,
        'timezoneOffsetMinutes': apiTimezoneOffsetMinutes(),
      },
    );
    return ReplayResponse.fromJson(data);
  }
}
