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

class StatsResponse {
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
