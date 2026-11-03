import '../models/integration_health.dart';
import '../models/mission.dart';
import 'api_client.dart';

/// Missões (`/missions`) e saúde das integrações (`/integrations/health`).
class MissionsApi {
  static Future<List<Mission>> list() async {
    final data = await ApiClient.instance.getCached<List<dynamic>>('/missions');
    return data.map((e) => Mission.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> create(Map<String, dynamic> body) async {
    await ApiClient.instance.post<dynamic>('/missions', data: body);
  }

  static Future<void> update(String id, Map<String, dynamic> body) async {
    await ApiClient.instance.patch<dynamic>('/missions/$id', data: body);
  }

  static Future<void> delete(String id) async {
    await ApiClient.instance.delete('/missions/$id');
  }
}

class IntegrationHealthApi {
  static Future<List<IntegrationHealth>> list() async {
    final response = await ApiClient.instance.get<List<dynamic>>('/integrations/health');
    return (response.data ?? const []).map((e) => IntegrationHealth.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<IntegrationHealth> test(String key) async {
    final response = await ApiClient.instance.post<Map<String, dynamic>>('/integrations/health/$key/test');
    return IntegrationHealth.fromJson(response.data!);
  }
}
