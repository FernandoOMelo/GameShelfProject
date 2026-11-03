import '../models/game.dart';
import '../models/game_usage.dart';
import 'api_client.dart';

class GamesApi {
  static Future<List<Game>> list() async {
    final data = await ApiClient.instance.getCached<List<dynamic>>('/games');
    return data.map((e) => Game.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<Game> get(String id) async {
    final data = await ApiClient.instance.getCached<Map<String, dynamic>>('/games/$id');
    return Game.fromJson(data);
  }

  static Future<Game> create(Game game) async {
    final response = await ApiClient.instance.post<Map<String, dynamic>>(
      '/games',
      data: game.toInputJson(),
    );
    return Game.fromJson(response.data!);
  }

  /// Atualização parcial: só os campos de [values] são enviados (`PATCH`).
  static Future<Game> update(String id, Map<String, dynamic> values) async {
    final response = await ApiClient.instance.patch<Map<String, dynamic>>(
      '/games/$id',
      data: values,
    );
    return Game.fromJson(response.data!);
  }

  static Future<void> delete(String id) async {
    await ApiClient.instance.delete('/games/$id');
  }

  /// Tempo consolidado e conquistas por jogo (cartões e ordenação da biblioteca).
  static Future<Map<String, GameUsage>> usage() async {
    final data = await ApiClient.instance.getCached<List<dynamic>>('/games/usage');
    return {
      for (final item in data) (item as Map<String, dynamic>)['gameId'] as String: GameUsage.fromJson(item),
    };
  }

  /// Ids de jogos que parecem duplicatas de [gameId] (mesmo título normalizado).
  static Future<List<String>> duplicatesOf(String gameId) async {
    final response = await ApiClient.instance.get<List<dynamic>>('/games/duplicates');
    final ids = <String>[];
    for (final group in response.data ?? const []) {
      final groupIds = ((group as Map<String, dynamic>)['gameIds'] as List<dynamic>).cast<String>();
      if (groupIds.contains(gameId)) ids.addAll(groupIds.where((id) => id != gameId));
    }
    return ids;
  }

  /// Absorve [sourceId] em [targetId]; o jogo de origem deixa de existir.
  static Future<Game> merge(String targetId, String sourceId) async {
    final response = await ApiClient.instance.post<Map<String, dynamic>>(
      '/games/$targetId/merge',
      data: {'sourceGameId': sourceId},
    );
    return Game.fromJson(response.data!);
  }
}
