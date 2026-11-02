import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/platforms_api.dart';
import '../models/platform_summary.dart';

final platformSummariesProvider =
    FutureProvider.autoDispose<List<PlatformSummary>>((ref) => PlatformsApi.summaries());

final platformCatalogProvider =
    FutureProvider.autoDispose<List<PlatformCatalogEntry>>((ref) => PlatformsApi.catalog());

/// `null` quando o estado não pôde ser lido: os cartões só omitem o status de sync.
final syncStateProvider = FutureProvider.autoDispose<SyncState?>((ref) async {
  try {
    return await PlatformsApi.syncState();
  } catch (_) {
    return null;
  }
});
