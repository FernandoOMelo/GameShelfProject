import '../models/external_match.dart';
import '../models/platform_summary.dart';
import 'api_client.dart';
import 'platforms_api.dart';

/// Integração com o Achievist (ADR-024): conexão, sincronização manual e a fila
/// de entradas a vincular. As credenciais ficam só no servidor; o app só fala
/// com a API do GameShelf.
class AchievistApi {
  static const _base = '/integrations/achievist';

  static Future<IntegrationStatus> status() async {
    final response = await ApiClient.instance.get<Map<String, dynamic>>('$_base/status');
    return IntegrationStatus.fromJson(response.data!);
  }

  static Future<SyncState> syncState() => PlatformsApi.syncState();

  static Future<bool> startSync() => PlatformsApi.startSync();

  static Future<List<ExternalPendingMatch>> pending() async {
    final response = await ApiClient.instance.get<List<dynamic>>('$_base/pending');
    return (response.data ?? const []).map((e) => ExternalPendingMatch.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Vincula a entrada a um jogo da biblioteca. Sem [platformId], a API resolve
  /// ou cria a plataforma pelo nome da fonte.
  static Future<void> confirm(String matchId, {required String gameId, String? platformId}) async {
    await ApiClient.instance.post<dynamic>('$_base/pending/$matchId/confirm', data: {
      'gameId': gameId,
      'platformId': ?platformId,
    });
  }

  /// Cadastra o jogo que ainda não existe na biblioteca e já o vincula.
  static Future<void> createGame(
    String matchId, {
    required String title,
    required String status,
    required bool owned,
    String? platformId,
  }) async {
    await ApiClient.instance.post<dynamic>('$_base/pending/$matchId/create-game', data: {
      'game': {'title': title, 'status': status, 'owned': owned},
      'platformId': ?platformId,
    });
  }

  static Future<void> ignore(String matchId) async {
    await ApiClient.instance.post<dynamic>('$_base/pending/$matchId/ignore');
  }
}
