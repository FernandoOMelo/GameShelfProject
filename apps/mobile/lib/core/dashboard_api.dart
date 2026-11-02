import '../models/dashboard.dart';
import 'api_client.dart';
import 'timezone.dart';

class DashboardApi {
  static Map<String, dynamic> _query({String? from, String? to}) => {
        'from': ?from,
        'to': ?to,
        'timezoneOffsetMinutes': apiTimezoneOffsetMinutes(),
      };

  static Future<Dashboard> load({String? from, String? to}) async {
    final data = await ApiClient.instance.getCached<Map<String, dynamic>>(
      '/dashboard',
      queryParameters: _query(from: from, to: to),
    );
    return Dashboard.fromJson(data);
  }

  static Future<Dashboard> get() => load();

  static Future<DateTime?> cachedAt() =>
      ApiClient.instance.cachedAt('/dashboard', queryParameters: _query());
}
