import '../models/challenge.dart';
import 'api_client.dart';

/// Missão principal (`/challenge`): um objetivo de longo prazo sobre uma lista.
class ChallengeApi {
  /// Devolve `null` quando nenhuma missão está definida (a API responde `null`).
  static Future<MainChallenge?> get() async {
    final data = await ApiClient.instance
        .getCached<Map<String, dynamic>?>('/challenge');
    return data == null ? null : MainChallenge.fromJson(data);
  }

  static Future<void> save({required String title, required String listId}) async {
    await ApiClient.instance.put<dynamic>(
      '/challenge',
      data: {'title': title.trim(), 'listId': listId},
    );
  }

  static Future<void> clear() async {
    await ApiClient.instance.delete('/challenge');
  }
}
