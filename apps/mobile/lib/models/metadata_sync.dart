import 'metadata.dart';

/// Jogo que pede atenção na captura automática de metadados (ADR-043).
class MetadataSyncItem {
  final String gameId;
  final String title;
  final String? coverUrl;

  /// APPLIED_AUTO (aplicado sozinho), NEEDS_REVIEW ou NOT_FOUND.
  final String status;
  final List<String> appliedFields;
  final List<GameMetadataCandidate> candidates;

  const MetadataSyncItem({
    required this.gameId,
    required this.title,
    required this.status,
    this.coverUrl,
    this.appliedFields = const [],
    this.candidates = const [],
  });

  factory MetadataSyncItem.fromJson(Map<String, dynamic> json) => MetadataSyncItem(
        gameId: json['gameId'] as String,
        title: json['title'] as String,
        coverUrl: json['coverUrl'] as String?,
        status: json['status'] as String,
        appliedFields: [for (final field in json['appliedFields'] as List<dynamic>) field as String],
        candidates: [
          for (final candidate in json['candidates'] as List<dynamic>)
            GameMetadataCandidate.fromJson(candidate as Map<String, dynamic>),
        ],
      );
}

class MetadataReview {
  final int count;
  final List<MetadataSyncItem> items;

  const MetadataReview({required this.count, required this.items});

  factory MetadataReview.fromJson(Map<String, dynamic> json) => MetadataReview(
        count: json['count'] as int,
        items: [for (final item in json['items'] as List<dynamic>) MetadataSyncItem.fromJson(item as Map<String, dynamic>)],
      );
}

/// Rótulos dos campos que a captura preencheu.
const metadataFieldLabels = {
  'description': 'descrição',
  'releaseYear': 'ano',
  'developer': 'desenvolvedora',
  'publisher': 'publicadora',
  'coverUrl': 'capa',
  'backgroundUrl': 'fundo',
  'genreIds': 'gêneros',
  'franchiseId': 'franquia',
  'estimatedMainHours': 'tempo principal',
  'estimatedCompletionistHours': 'tempo completista',
};
