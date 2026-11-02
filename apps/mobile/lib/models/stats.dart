/// Estatísticas da coleção (`statsResponseSchema`).
///
/// Todos os números chegam calculados da API: o app só apresenta.
library;

class StatsGameRef {
  final String id;
  final String title;
  final String? coverUrl;
  final double hours;
  final int? rating;

  const StatsGameRef({
    required this.id,
    required this.title,
    required this.hours,
    this.coverUrl,
    this.rating,
  });

  factory StatsGameRef.fromJson(Map<String, dynamic> json) => StatsGameRef(
        id: json['id'] as String,
        title: json['title'] as String,
        coverUrl: json['coverUrl'] as String?,
        hours: (json['hours'] as num?)?.toDouble() ?? 0,
        rating: json['rating'] as int?,
      );
}

class StatsGroup {
  final String key;
  final String name;
  final int completedCount;
  final double hours;
  final double? averageRating;

  const StatsGroup({
    required this.key,
    required this.name,
    required this.completedCount,
    required this.hours,
    this.averageRating,
  });

  factory StatsGroup.fromJson(Map<String, dynamic> json) => StatsGroup(
        key: json['key'] as String,
        name: json['name'] as String,
        completedCount: json['completedCount'] as int,
        hours: (json['hours'] as num).toDouble(),
        averageRating: (json['averageRating'] as num?)?.toDouble(),
      );
}

class StatsTotals {
  final int completedCount;
  final double completedHours;
  final double? averageCompletedHours;
  final StatsGameRef? longestGame;
  final StatsGameRef? shortestGame;
  final String? journeyStart;
  final int journeyDays;
  final double completionRate;
  final double? averageHoursPerGame;

  const StatsTotals({
    required this.completedCount,
    required this.completedHours,
    required this.completionRate,
    required this.journeyDays,
    this.averageCompletedHours,
    this.longestGame,
    this.shortestGame,
    this.journeyStart,
    this.averageHoursPerGame,
  });

  factory StatsTotals.fromJson(Map<String, dynamic> json) => StatsTotals(
        completedCount: json['completedCount'] as int,
        completedHours: (json['completedHours'] as num).toDouble(),
        averageCompletedHours: (json['averageCompletedHours'] as num?)?.toDouble(),
        longestGame: json['longestGame'] != null
            ? StatsGameRef.fromJson(json['longestGame'] as Map<String, dynamic>)
            : null,
        shortestGame: json['shortestGame'] != null
            ? StatsGameRef.fromJson(json['shortestGame'] as Map<String, dynamic>)
            : null,
        journeyStart: json['journeyStart'] as String?,
        journeyDays: json['journeyDays'] as int,
        completionRate: (json['completionRate'] as num).toDouble(),
        averageHoursPerGame: (json['averageHoursPerGame'] as num?)?.toDouble(),
      );
}

class StatsCountBucket {
  final String label;
  final int count;

  const StatsCountBucket({required this.label, required this.count});
}

class StatsYearBucket {
  final int year;
  final int completedCount;
  final double hours;
  final StatsGameRef? gameOfYear;

  const StatsYearBucket({
    required this.year,
    required this.completedCount,
    required this.hours,
    this.gameOfYear,
  });

  factory StatsYearBucket.fromJson(Map<String, dynamic> json) => StatsYearBucket(
        year: json['year'] as int,
        completedCount: json['completedCount'] as int,
        hours: (json['hours'] as num).toDouble(),
        gameOfYear: json['gameOfYear'] != null
            ? StatsGameRef.fromJson(json['gameOfYear'] as Map<String, dynamic>)
            : null,
      );
}

/// Tempo informado por uma plataforma (Achievist), para o gráfico de barras.
class ExternalPlaytimeByPlatform {
  final String key;
  final String name;
  final double hours;

  const ExternalPlaytimeByPlatform({required this.key, required this.name, required this.hours});

  factory ExternalPlaytimeByPlatform.fromJson(Map<String, dynamic> json) => ExternalPlaytimeByPlatform(
        key: json['key'] as String,
        name: json['name'] as String,
        hours: (json['hours'] as num).toDouble(),
      );
}

/// Números da biblioteca inteira (`libraryStatsSchema`): um jogo em três
/// plataformas continua sendo um jogo, e o tempo local fica separado do tempo
/// informado pelas plataformas, que nunca são somados.
class LibraryStats {
  final int gameCount;
  final int platformLinkCount;
  final int playthroughsStarted;
  final int playthroughsCompleted;
  final int replaysStarted;
  final int gamesWithCompletedPlaythrough;
  final double localPlayedHours;
  final double externalPlaytimeHours;
  final double externalCountedHours;
  final double consolidatedPlayedHours;
  final List<ExternalPlaytimeByPlatform> externalPlaytimeByPlatform;

  const LibraryStats({
    this.gameCount = 0,
    this.platformLinkCount = 0,
    this.playthroughsStarted = 0,
    this.playthroughsCompleted = 0,
    this.replaysStarted = 0,
    this.gamesWithCompletedPlaythrough = 0,
    this.localPlayedHours = 0,
    this.externalPlaytimeHours = 0,
    this.externalCountedHours = 0,
    this.consolidatedPlayedHours = 0,
    this.externalPlaytimeByPlatform = const [],
  });

  factory LibraryStats.fromJson(Map<String, dynamic> json) => LibraryStats(
        gameCount: json['gameCount'] as int? ?? 0,
        platformLinkCount: json['platformLinkCount'] as int? ?? 0,
        playthroughsStarted: json['playthroughsStarted'] as int? ?? 0,
        playthroughsCompleted: json['playthroughsCompleted'] as int? ?? 0,
        replaysStarted: json['replaysStarted'] as int? ?? 0,
        gamesWithCompletedPlaythrough: json['gamesWithCompletedPlaythrough'] as int? ?? 0,
        localPlayedHours: (json['localPlayedHours'] as num?)?.toDouble() ?? 0,
        externalPlaytimeHours: (json['externalPlaytimeHours'] as num?)?.toDouble() ?? 0,
        externalCountedHours: (json['externalCountedHours'] as num?)?.toDouble() ?? 0,
        consolidatedPlayedHours: (json['consolidatedPlayedHours'] as num?)?.toDouble() ?? 0,
        externalPlaytimeByPlatform: ((json['externalPlaytimeByPlatform'] as List<dynamic>?) ?? const [])
            .map((e) => ExternalPlaytimeByPlatform.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class StatsResponse {
  final LibraryStats? library;
  final StatsTotals totals;
  final List<StatsCountBucket> ratingDistribution;
  final List<StatsCountBucket> difficultyDistribution;
  final List<StatsGroup> byGenre;
  final List<StatsGroup> byType;
  final List<StatsGroup> byPlatform;
  final List<StatsYearBucket> byYear;
  final List<StatsGameRef> favorites;
  final List<StatsGroup> topGenres;
  final List<StatsGroup> topTypes;
  final List<StatsCountBucket> byReleaseYear;
  final List<StatsGroup> byDeveloper;

  const StatsResponse({
    this.library,
    required this.totals,
    required this.ratingDistribution,
    required this.difficultyDistribution,
    required this.byGenre,
    required this.byType,
    required this.byPlatform,
    required this.byYear,
    required this.favorites,
    required this.topGenres,
    required this.topTypes,
    required this.byReleaseYear,
    required this.byDeveloper,
  });

  factory StatsResponse.fromJson(Map<String, dynamic> json) => StatsResponse(
        library: json['library'] is Map<String, dynamic>
            ? LibraryStats.fromJson(json['library'] as Map<String, dynamic>)
            : null,
        totals: StatsTotals.fromJson(json['totals'] as Map<String, dynamic>),
        ratingDistribution: (json['ratingDistribution'] as List<dynamic>)
            .map((e) => e as Map<String, dynamic>)
            .map((e) => StatsCountBucket(
                label: '${e['rating']}', count: e['count'] as int))
            .toList(),
        difficultyDistribution: (json['difficultyDistribution'] as List<dynamic>)
            .map((e) => e as Map<String, dynamic>)
            .map((e) => StatsCountBucket(
                label: e['difficulty'] as String, count: e['count'] as int))
            .toList(),
        byGenre: _groups(json['byGenre']),
        byType: _groups(json['byType']),
        byPlatform: _groups(json['byPlatform']),
        byYear: (json['byYear'] as List<dynamic>)
            .map((e) => StatsYearBucket.fromJson(e as Map<String, dynamic>))
            .toList(),
        favorites: (json['favorites'] as List<dynamic>)
            .map((e) => StatsGameRef.fromJson(e as Map<String, dynamic>))
            .toList(),
        topGenres: _groups(json['topGenres']),
        topTypes: _groups(json['topTypes']),
        byReleaseYear: (json['byReleaseYear'] as List<dynamic>)
            .map((e) => e as Map<String, dynamic>)
            .map((e) => StatsCountBucket(
                label: '${e['year']}', count: e['count'] as int))
            .toList(),
        byDeveloper: _groups(json['byDeveloper']),
      );

  static List<StatsGroup> _groups(dynamic value) => (value as List<dynamic>)
      .map((e) => StatsGroup.fromJson(e as Map<String, dynamic>))
      .toList();
}
