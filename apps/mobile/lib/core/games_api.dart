import '../models/game.dart';
import 'api_client.dart';

class GamesApi {
  static Future<List<Game>> list() async {
    final data = await ApiClient.instance.getCached<List<dynamic>>('/games');
    return data.map((e) => Game.fromJson(e as Map<String, dynamic>)).toList();
  }
}
