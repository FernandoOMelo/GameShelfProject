import '../models/goal.dart';
import 'api_client.dart';

class GoalsApi {
  static Future<List<GoalProgress>> list() async {
    final data = await ApiClient.instance.getCached<List<dynamic>>(
      '/goals',
      queryParameters: {
        'timezoneOffsetMinutes': DateTime.now().timeZoneOffset.inMinutes,
      },
    );
    return data.map((e) => GoalProgress.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> create({
    required String kind,
    required String period,
    required int year,
    int? month,
    required int target,
  }) async {
    await ApiClient.instance.post<dynamic>('/goals', data: {
      'kind': kind,
      'period': period,
      'year': year,
      'month': ?month,
      'target': target,
    });
  }

  static Future<void> updateTarget(String id, int target) async {
    await ApiClient.instance.patch<dynamic>('/goals/$id', data: {'target': target});
  }

  static Future<void> delete(String id) async {
    await ApiClient.instance.delete('/goals/$id');
  }
}
