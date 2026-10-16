import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/local_db.dart';

final connectivityProvider = StreamProvider<bool>((ref) {
  return Connectivity().onConnectivityChanged.map(
        (results) => results.any((r) => r != ConnectivityResult.none),
      );
});

final pendingCountProvider = FutureProvider<int>((ref) async {
  ref.watch(connectivityProvider);
  return LocalDb.instance.pendingCount();
});
