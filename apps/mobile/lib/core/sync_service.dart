import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'api_client.dart';
import 'local_db.dart';

class SyncService {
  static SyncService? _instance;
  bool _syncing = false;

  SyncService._();

  static SyncService get instance {
    _instance ??= SyncService._();
    return _instance!;
  }

  void startListening() {
    Connectivity().onConnectivityChanged.listen((results) {
      final connected = results.any((r) => r != ConnectivityResult.none);
      if (connected) flush();
    });
  }

  Future<void> flush() async {
    if (_syncing) return;
    _syncing = true;
    try {
      final ops = await LocalDb.instance.pendingOps();
      for (final op in ops) {
        try {
          if (op.method == 'POST') {
            await ApiClient.instance.post(op.path, data: op.body);
          } else if (op.method == 'PATCH') {
            await ApiClient.instance.patch(op.path, data: op.body);
          }
          await LocalDb.instance.deleteOp(op.id!);
        } on DioException catch (error) {
          if (error.response?.statusCode == 409) {
            await LocalDb.instance.deleteOp(op.id!);
            continue;
          }
          break;
        } catch (_) {
          break;
        }
      }
    } finally {
      _syncing = false;
    }
  }
}
