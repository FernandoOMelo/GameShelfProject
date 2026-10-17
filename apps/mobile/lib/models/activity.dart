import 'stats.dart';

/// Heatmap de atividade (`activityResponseSchema`).
class ActivityResponse {
  final int year;
  final List<ActivityDay> days;
  final int activeDays;
  final int totalMinutes;
  final int maxDayMinutes;
  final int currentStreak;
  final int longestStreak;

  const ActivityResponse({
    required this.year,
    required this.days,
    required this.activeDays,
    required this.totalMinutes,
    required this.maxDayMinutes,
    required this.currentStreak,
    required this.longestStreak,
  });

  factory ActivityResponse.fromJson(Map<String, dynamic> json) => ActivityResponse(
        year: json['year'] as int,
        days: (json['days'] as List<dynamic>)
            .map((e) => ActivityDay.fromJson(e as Map<String, dynamic>))
            .toList(),
        activeDays: json['activeDays'] as int,
        totalMinutes: json['totalMinutes'] as int,
        maxDayMinutes: json['maxDayMinutes'] as int,
        currentStreak: json['currentStreak'] as int,
        longestStreak: json['longestStreak'] as int,
      );
}

class ActivityDay {
  final String date;
  final int minutes;

  const ActivityDay({required this.date, required this.minutes});

  factory ActivityDay.fromJson(Map<String, dynamic> json) =>
      ActivityDay(date: json['date'] as String, minutes: json['minutes'] as int);
}

/// Jogo destacado no replay, com os minutos jogados no ano.
class ReplayGameRef {
  final String id;
  final String title;
  final String? coverUrl;
  final int minutes;

  const ReplayGameRef({
    required this.id,
    required this.title,
    required this.minutes,
    this.coverUrl,
  });

  factory ReplayGameRef.fromJson(Map<String, dynamic> json) => ReplayGameRef(
        id: json['id'] as String,
        title: json['title'] as String,
        coverUrl: json['coverUrl'] as String?,
        minutes: json['minutes'] as int,
      );
}

class ReplayGenreRef {
  final String name;
  final int minutes;

  const ReplayGenreRef({required this.name, required this.minutes});

  factory ReplayGenreRef.fromJson(Map<String, dynamic> json) =>
      ReplayGenreRef(name: json['name'] as String, minutes: json['minutes'] as int);
}

class ReplayMonthRef {
  final int month;
  final int minutes;

  const ReplayMonthRef({required this.month, required this.minutes});

  factory ReplayMonthRef.fromJson(Map<String, dynamic> json) =>
      ReplayMonthRef(month: json['month'] as int, minutes: json['minutes'] as int);
}

class ReplaySessionRef {
  final String gameId;
  final String title;
  final String date;
  final int minutes;

  const ReplaySessionRef({
    required this.gameId,
    required this.title,
    required this.date,
    required this.minutes,
  });

  factory ReplaySessionRef.fromJson(Map<String, dynamic> json) => ReplaySessionRef(
        gameId: json['gameId'] as String,
        title: json['title'] as String,
        date: json['date'] as String,
        minutes: json['minutes'] as int,
      );
}

/// Resumo anual (`replayResponseSchema`).
class ReplayResponse {
  final int year;
  final int totalMinutes;
  final int sessionCount;
  final int activeDays;
  final int completedCount;
  final ReplayGameRef? mostPlayedGame;
  final ReplayGenreRef? topGenre;
  final ReplaySessionRef? longestSession;
  final ReplayMonthRef? busiestMonth;
  final StatsGameRef? gameOfYear;

  const ReplayResponse({
    required this.year,
    required this.totalMinutes,
    required this.sessionCount,
    required this.activeDays,
    required this.completedCount,
    this.mostPlayedGame,
    this.topGenre,
    this.longestSession,
    this.busiestMonth,
    this.gameOfYear,
  });

  factory ReplayResponse.fromJson(Map<String, dynamic> json) => ReplayResponse(
        year: json['year'] as int,
        totalMinutes: json['totalMinutes'] as int,
        sessionCount: json['sessionCount'] as int,
        activeDays: json['activeDays'] as int,
        completedCount: json['completedCount'] as int,
        mostPlayedGame: json['mostPlayedGame'] != null
            ? ReplayGameRef.fromJson(json['mostPlayedGame'] as Map<String, dynamic>)
            : null,
        topGenre: json['topGenre'] != null
            ? ReplayGenreRef.fromJson(json['topGenre'] as Map<String, dynamic>)
            : null,
        longestSession: json['longestSession'] != null
            ? ReplaySessionRef.fromJson(json['longestSession'] as Map<String, dynamic>)
            : null,
        busiestMonth: json['busiestMonth'] != null
            ? ReplayMonthRef.fromJson(json['busiestMonth'] as Map<String, dynamic>)
            : null,
        gameOfYear: json['gameOfYear'] != null
            ? StatsGameRef.fromJson(json['gameOfYear'] as Map<String, dynamic>)
            : null,
      );
}
