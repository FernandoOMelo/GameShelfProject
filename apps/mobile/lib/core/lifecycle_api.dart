import '../models/lifecycle.dart';
import 'api_client.dart';

/// Comandos do ciclo do jogo (ADR-042): começar a jogar e zerar.
class LifecycleApi {
  static Map<String, dynamic> get _timezone => {'timezoneOffsetMinutes': DateTime.now().timeZoneOffset.inMinutes * -1};

  static Future<LifecycleHint> hint(String gameId) async {
    final response = await ApiClient.instance.get<Map<String, dynamic>>(
      '/games/$gameId/lifecycle',
      queryParameters: _timezone,
    );
    return LifecycleHint.fromJson(response.data!);
  }

  /// Cria ou retoma a jornada e, com [sessionId], vincula a sessão a ela.
  static Future<void> startPlaying(String gameId, {String? sessionId, DateTime? startedAt}) async {
    await ApiClient.instance.dio.post<Map<String, dynamic>>(
      '/games/$gameId/start-playing',
      data: {
        'sessionId': ?sessionId,
        if (startedAt != null) 'startedAt': startedAt.toUtc().toIso8601String(),
        ..._timezone,
      },
    );
  }

  /// Grava a conclusão. [completedAt] no formato AAAA-MM-DD; sem ele vale hoje.
  static Future<FinishResult> finish(String gameId, {String? completedAt}) async {
    final response = await ApiClient.instance.dio.post<Map<String, dynamic>>(
      '/games/$gameId/finish',
      data: {'completedAt': ?completedAt, ..._timezone},
    );
    return FinishResult.fromJson(response.data!);
  }

  static Future<void> undoFinish(String gameId, Map<String, dynamic> undo) async {
    await ApiClient.instance.dio.post<Map<String, dynamic>>('/games/$gameId/finish/undo', data: undo);
  }
}
