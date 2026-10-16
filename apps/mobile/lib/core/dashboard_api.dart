import '../models/dashboard.dart';
import 'api_client.dart';

class DashboardApi {
  static Map<String, dynamic> get _query => {'timezoneOffsetMinutes': DateTime.now().timeZoneOffset.inMinutes};

  static Future<Dashboard> get() async {
    final data = await ApiClient.instance.getCached<Map<String, dynamic>>('/dashboard', queryParameters: _query);
    return Dashboard.fromJson(data);
  }

  static Future<DateTime?> cachedAt() => ApiClient.instance.cachedAt('/dashboard', queryParameters: _query);
}
