import '../models/game.dart';
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
}
