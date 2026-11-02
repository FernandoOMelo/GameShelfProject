import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/achievist_api.dart';
import '../models/external_match.dart';
import '../models/platform_summary.dart';

final achievistStatusProvider = FutureProvider.autoDispose<IntegrationStatus?>((ref) async {
  try {
    return await AchievistApi.status();
  } catch (_) {
    return null;
  }
});

final achievistSyncStateProvider = FutureProvider.autoDispose<SyncState?>((ref) async {
  try {
    return await AchievistApi.syncState();
  } catch (_) {
    return null;
  }
});

/// A fila só existe com a integração ligada; desligada, devolve lista vazia.
final achievistPendingProvider = FutureProvider.autoDispose<List<ExternalPendingMatch>>((ref) async {
  final state = await ref.watch(achievistSyncStateProvider.future);
  if (state == null || state.disabled) return const [];
  return AchievistApi.pending();
});
