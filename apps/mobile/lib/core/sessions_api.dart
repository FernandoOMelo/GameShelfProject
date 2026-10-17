import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import '../models/session.dart';
import 'api_client.dart';
import 'local_db.dart';

class SessionsApi {
  static Future<bool> _isOnline() async {
    final result = await Connectivity().checkConnectivity();
    return result.any((r) => r != ConnectivityResult.none);
  }

  static Future<List<Session>> list(String gameId) async {
    final data = await ApiClient.instance.getCached<List<dynamic>>('/games/$gameId/sessions');
    return data.map((e) => Session.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<Session?> create(String gameId, Session session) async {
    final body = session.toJson();
    if (await _isOnline()) {
      try {
        final res = await ApiClient.instance.post<Map<String, dynamic>>(
          '/games/$gameId/sessions',
          data: body,
        );
        return Session.fromJson(res.data!);
      } on DioException {
        await _enqueueCreate(gameId, body);
        return null;
      }
    } else {
      await _enqueueCreate(gameId, body);
      return null;
    }
  }

  static Future<Session?> update(String gameId, String sessionId, Map<String, dynamic> patch) async {
    if (await _isOnline()) {
      try {
        final res = await ApiClient.instance.patch<Map<String, dynamic>>(
          '/games/$gameId/sessions/$sessionId',
          data: patch,
        );
        return Session.fromJson(res.data!);
      } on DioException {
        await _enqueueUpdate(gameId, sessionId, patch);
        return null;
      }
    } else {
      await _enqueueUpdate(gameId, sessionId, patch);
      return null;
    }
  }

  static Future<void> remove(String gameId, String sessionId) async {
    await ApiClient.instance.delete('/games/$gameId/sessions/$sessionId');
  }

  static Future<void> _enqueueCreate(String gameId, Map<String, dynamic> body) async {
    await LocalDb.instance.enqueue(OfflineOp(
      method: 'POST',
      path: '/games/$gameId/sessions',
      body: body,
      createdAt: DateTime.now().millisecondsSinceEpoch,
    ));
  }

  static Future<void> _enqueueUpdate(String gameId, String sessionId, Map<String, dynamic> body) async {
    await LocalDb.instance.enqueue(OfflineOp(
      method: 'PATCH',
      path: '/games/$gameId/sessions/$sessionId',
      body: body,
      createdAt: DateTime.now().millisecondsSinceEpoch,
    ));
  }
}
