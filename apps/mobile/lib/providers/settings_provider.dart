import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/api_client.dart';

class SettingsNotifier extends Notifier<String> {
  @override
  String build() => ApiClient.instance.baseUrl;

  Future<void> setServerUrl(String url) async {
    await ApiClient.instance.setBaseUrl(url);
    state = ApiClient.instance.baseUrl;
  }
}

final settingsProvider = NotifierProvider<SettingsNotifier, String>(SettingsNotifier.new);
