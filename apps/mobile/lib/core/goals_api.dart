import '../models/goal.dart';
import 'api_client.dart';
import 'timezone.dart';

class GoalsApi {
  static Future<List<GoalProgress>> list() async {
    final data = await ApiClient.instance.getCached<List<dynamic>>(
      '/goals',
      queryParameters: {
        'timezoneOffsetMinutes': apiTimezoneOffsetMinutes(),
      },
    );
    return data.map((e) => GoalProgress.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// `body` segue `goalInputSchema`: metas por período levam period/year/target;
  /// as demais, listId, target (horas seguidas), title e dueDate conforme o tipo.
  static Future<void> create(Map<String, dynamic> body) async {
    await ApiClient.instance.post<dynamic>('/goals', data: body);
  }

  static Future<void> setDone(String id, bool done) async {
    await ApiClient.instance.patch<dynamic>('/goals/$id', data: {'done': done});
  }

  static Future<void> updateTarget(String id, int target) async {
    await ApiClient.instance.patch<dynamic>('/goals/$id', data: {'target': target});
  }

  static Future<void> delete(String id) async {
    await ApiClient.instance.delete('/goals/$id');
  }
}
