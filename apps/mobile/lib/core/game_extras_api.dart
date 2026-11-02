import '../models/game_extras.dart';
import 'api_client.dart';

/// Plataformas associadas, jornadas, conquistas, DLC e franquia de um jogo.
/// Leituras vão pelo cache da API (funcionam sem rede com o último dado);
/// qualquer escrita exige conexão, como as demais edições do app.
class GameExtrasApi {
  static final _client = ApiClient.instance;

  // ── Plataformas associadas ──
  static Future<List<GamePlatform>> platforms(String gameId) async {
    final data = await _client.getCached<List<dynamic>>('/games/$gameId/platforms');
    return data.map((e) => GamePlatform.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> addPlatform(String gameId, Map<String, dynamic> body) async {
    await _client.post<dynamic>('/games/$gameId/platforms', data: body);
  }

  static Future<void> updatePlatform(String gameId, String id, Map<String, dynamic> body) async {
    await _client.patch<dynamic>('/games/$gameId/platforms/$id', data: body);
  }

  static Future<void> removePlatform(String gameId, String id) async {
    await _client.delete<dynamic>('/games/$gameId/platforms/$id');
  }

  /// Lança o tempo informado pela plataforma como horas retroativas do jogo.
  static Future<void> importPlaytime(String gameId, String id) async {
    await _client.post<dynamic>('/games/$gameId/platforms/$id/import-playtime');
  }

  // ── Jornadas ──
  static Future<List<Playthrough>> playthroughs(String gameId) async {
    final data = await _client.getCached<List<dynamic>>('/games/$gameId/playthroughs');
    return data.map((e) => Playthrough.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<PlaythroughMetrics> playthroughMetrics(String gameId) async {
    final data = await _client.getCached<Map<String, dynamic>>('/games/$gameId/playthroughs/metrics');
    return PlaythroughMetrics.fromJson(data);
  }

  static Future<void> createPlaythrough(String gameId, Map<String, dynamic> body) async {
    await _client.post<dynamic>('/games/$gameId/playthroughs', data: body);
  }

  static Future<void> updatePlaythrough(String gameId, String id, Map<String, dynamic> body) async {
    await _client.patch<dynamic>('/games/$gameId/playthroughs/$id', data: body);
  }

  static Future<void> removePlaythrough(String gameId, String id) async {
    await _client.delete<dynamic>('/games/$gameId/playthroughs/$id');
  }

  // ── Conquistas ──
  static Future<GameAchievements> achievements(String gameId) async {
    final data = await _client.getCached<Map<String, dynamic>>('/games/$gameId/achievements');
    return GameAchievements.fromJson(data);
  }

  // ── DLC ──
  static Future<List<Dlc>> dlcs(String gameId) async {
    final data = await _client.getCached<List<dynamic>>('/games/$gameId/dlcs');
    return data.map((e) => Dlc.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<void> createDlc(String gameId, Map<String, dynamic> body) async {
    await _client.post<dynamic>('/games/$gameId/dlcs', data: body);
  }

  static Future<void> updateDlc(String gameId, String id, Map<String, dynamic> body) async {
    await _client.patch<dynamic>('/games/$gameId/dlcs/$id', data: body);
  }

  static Future<void> removeDlc(String gameId, String id) async {
    await _client.delete<dynamic>('/games/$gameId/dlcs/$id');
  }

  // ── Franquia ──
  static Future<FranchiseGames> franchiseGames(String franchiseId) async {
    final data = await _client.getCached<Map<String, dynamic>>('/franchises/$franchiseId/igdb-games');
    return FranchiseGames.fromJson(data);
  }
}
