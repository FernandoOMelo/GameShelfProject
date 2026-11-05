import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/metadata_sync_api.dart';
import '../models/metadata_sync.dart';

/// Jogos que pedem atenção; `invalidate` depois de cada ação.
final metadataReviewProvider = FutureProvider.autoDispose<MetadataReview>((ref) => MetadataSyncApi.review());

/// Contagem para o selo de "Mais". Falha silenciosa: sem servidor, sem selo.
final metadataReviewCountProvider = FutureProvider.autoDispose<int>((ref) async {
  try {
    return (await ref.watch(metadataReviewProvider.future)).count;
  } catch (_) {
    return 0;
  }
});
