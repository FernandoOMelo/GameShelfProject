import '../models/timeline.dart';
import 'api_client.dart';
import 'timezone.dart';

class TimelineApi {
  /// Uma página da linha do tempo. [before] é o cursor devolvido como `nextBefore`.
  static Future<TimelineResponse> page({DateTime? before, int limit = 50}) async {
    final data = await ApiClient.instance.get<Map<String, dynamic>>(
      '/stats/timeline',
      queryParameters: {
        'limit': limit,
        if (before != null) 'before': before.toUtc().toIso8601String(),
        'timezoneOffsetMinutes': apiTimezoneOffsetMinutes(),
      },
    );
    return TimelineResponse.fromJson(data.data!);
  }
}
