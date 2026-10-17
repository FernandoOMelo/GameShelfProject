import '../models/game_list.dart';
import 'api_client.dart';

class ListsApi {
  static Future<List<GameListSummary>> list() async {
    final data = await ApiClient.instance.getCached<List<dynamic>>('/lists');
    return data
        .map((e) => GameListSummary.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  static Future<GameList> get(String listId) async {
    final data =
        await ApiClient.instance.getCached<Map<String, dynamic>>('/lists/$listId');
    return GameList.fromJson(data);
  }

  /// Cria uma lista; quando [gameIds] é informado, já entra com esses jogos
  /// (`gameListCreateSchema`).
  static Future<GameListSummary> create(String name, {List<String> gameIds = const []}) async {
    final response = await ApiClient.instance.post<Map<String, dynamic>>(
      '/lists',
      data: {'name': name, if (gameIds.isNotEmpty) 'gameIds': gameIds},
    );
    return GameListSummary.fromJson(response.data!);
  }

  static Future<GameListSummary> rename(String listId, String name) async {
    final response = await ApiClient.instance.patch<Map<String, dynamic>>(
      '/lists/$listId',
      data: {'name': name},
    );
    return GameListSummary.fromJson(response.data!);
  }

  static Future<void> delete(String listId) async {
    await ApiClient.instance.delete('/lists/$listId');
  }

  static Future<void> addGame(String listId, String gameId) async {
    await ApiClient.instance.post<dynamic>(
      '/lists/$listId/games',
      data: {'gameId': gameId},
    );
  }

  static Future<void> removeGame(String listId, String gameId) async {
    await ApiClient.instance.delete('/lists/$listId/games/$gameId');
  }
}
