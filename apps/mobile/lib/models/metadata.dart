/// Candidato de metadata externa (`gameMetadataCandidateSchema`, IGDB).
class GameMetadataCandidate {
  final String providerId;
  final String title;
  final String? description;
  final String? coverUrl;
  final String? backgroundUrl;
  final int? releaseYear;
  final String? developer;
  final String? publisher;
  final String? franchise;
  final List<String> genres;

  const GameMetadataCandidate({
    required this.providerId,
    required this.title,
    this.description,
    this.coverUrl,
    this.backgroundUrl,
    this.releaseYear,
    this.developer,
    this.publisher,
    this.franchise,
    this.genres = const [],
  });

  factory GameMetadataCandidate.fromJson(Map<String, dynamic> json) =>
      GameMetadataCandidate(
        providerId: json['providerId'] as String,
        title: json['title'] as String,
        description: json['description'] as String?,
        coverUrl: json['coverUrl'] as String?,
        backgroundUrl: json['backgroundUrl'] as String?,
        releaseYear: json['releaseYear'] as int?,
        developer: json['developer'] as String?,
        publisher: json['publisher'] as String?,
        franchise: json['franchise'] as String?,
        genres: (json['genres'] as List<dynamic>? ?? const [])
            .map((e) => e as String)
            .toList(),
      );
}

/// Estimativa de tempo (`gameTimeEstimateSchema`, HowLongToBeat).
class GameTimeEstimate {
  final String providerId;
  final String title;
  final int? releaseYear;
  final double? mainHours;
  final double? mainExtraHours;
  final double? completionistHours;

  const GameTimeEstimate({
    required this.providerId,
    required this.title,
    this.releaseYear,
    this.mainHours,
    this.mainExtraHours,
    this.completionistHours,
  });

  factory GameTimeEstimate.fromJson(Map<String, dynamic> json) => GameTimeEstimate(
        providerId: json['providerId'] as String,
        title: json['title'] as String,
        releaseYear: json['releaseYear'] as int?,
        mainHours: (json['mainHours'] as num?)?.toDouble(),
        mainExtraHours: (json['mainExtraHours'] as num?)?.toDouble(),
        completionistHours: (json['completionistHours'] as num?)?.toDouble(),
      );
}
