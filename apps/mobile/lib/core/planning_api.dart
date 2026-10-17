import 'api_client.dart';

/// Configurações de planejamento (`/planning/settings`).
///
/// Hoje só carrega os minutos semanais disponíveis, que alimentam a previsão do
/// backlog e o indicador "horas disponíveis por semana" do painel.
class PlanningApi {
  static Future<int> getWeeklyMinutes() async {
    final data =
        await ApiClient.instance.getCached<Map<String, dynamic>>('/planning/settings');
    return data['weeklyMinutes'] as int;
  }

  static Future<void> setWeeklyMinutes(int minutes) async {
    await ApiClient.instance.put<dynamic>(
      '/planning/settings',
      data: {'weeklyMinutes': minutes},
    );
  }
}
