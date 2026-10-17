import 'game.dart';
import 'session.dart';

class CompletionPeriod {
  final int year;
  final int? month;
  final int gameCount;

  const CompletionPeriod({required this.year, this.month, required this.gameCount});

  factory CompletionPeriod.fromJson(Map<String, dynamic> json) => CompletionPeriod(
        year: json['year'] as int,
        month: json['month'] as int?,
        gameCount: json['gameCount'] as int,
      );
}

class PlayingGame {
  final Game game;
  final double playedHours;
  final int? progress;
  final Session? lastSession;
  final Session? activeSession;
  final double? estimatedHours;
  final double? remainingHours;

  const PlayingGame({
    required this.game,
    required this.playedHours,
    this.progress,
    this.lastSession,
    this.activeSession,
    this.estimatedHours,
    this.remainingHours,
  });

  factory PlayingGame.fromJson(Map<String, dynamic> json) => PlayingGame(
        game: Game.fromJson(json['game'] as Map<String, dynamic>),
        playedHours: (json['playedHours'] as num).toDouble(),
        progress: json['progress'] as int?,
        lastSession: json['lastSession'] != null
            ? Session.fromJson(json['lastSession'] as Map<String, dynamic>)
            : null,
        activeSession: json['activeSession'] != null
            ? Session.fromJson(json['activeSession'] as Map<String, dynamic>)
            : null,
        estimatedHours: (json['estimatedHours'] as num?)?.toDouble(),
        remainingHours: (json['remainingHours'] as num?)?.toDouble(),
      );
}

/// Jogo estagnado na previsão do backlog.
class StalledGame {
  final Game game;
  final int daysStalled;
  final double? remainingHours;

  const StalledGame({
    required this.game,
    required this.daysStalled,
    this.remainingHours,
  });

  factory StalledGame.fromJson(Map<String, dynamic> json) => StalledGame(
        game: Game.fromJson(json['game'] as Map<String, dynamic>),
        daysStalled: json['daysStalled'] as int,
        remainingHours: (json['remainingHours'] as num?)?.toDouble(),
      );
}

class BacklogForecast {
  final double? estimatedWeeks;
  final double? estimatedMonths;
  final int gamesWithoutEstimate;
  final List<StalledGame> stalledGames;

  const BacklogForecast({
    this.estimatedWeeks,
    this.estimatedMonths,
    required this.gamesWithoutEstimate,
    required this.stalledGames,
  });

  factory BacklogForecast.fromJson(Map<String, dynamic> json) => BacklogForecast(
        estimatedWeeks: (json['estimatedWeeks'] as num?)?.toDouble(),
        estimatedMonths: (json['estimatedMonths'] as num?)?.toDouble(),
        gamesWithoutEstimate: json['gamesWithoutEstimate'] as int,
        stalledGames: (json['stalledGames'] as List<dynamic>)
            .map((e) => StalledGame.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class DashboardPeriodStats {
  final double playedHours;
  final int sessions;
  final int gamesPlayed;
  final int gamesCompleted;

  const DashboardPeriodStats({
    required this.playedHours,
    required this.sessions,
    required this.gamesPlayed,
    required this.gamesCompleted,
  });

  factory DashboardPeriodStats.fromJson(Map<String, dynamic> json) =>
      DashboardPeriodStats(
        playedHours: (json['playedHours'] as num).toDouble(),
        sessions: json['sessions'] as int,
        gamesPlayed: json['gamesPlayed'] as int,
        gamesCompleted: json['gamesCompleted'] as int,
      );
}

/// Resposta de `GET /dashboard` (`dashboardResponseSchema`).
class Dashboard {
  final int gameCount;
  final int desiredCount;
  final int backlogCount;
  final int completedCount;
  final int playingCount;
  final int pausedCount;
  final int abandonedCount;
  final int archivedCount;
  final double totalPlayedHours;
  final double backlogRemainingHours;
  final double weeklyHours;
  final double queueRemainingHours;
  final double? estimatedQueueWeeks;
  final BacklogForecast? backlogForecast;
  final PlayingGame? currentGame;
  final List<PlayingGame> playingGames;
  final String? periodFrom;
  final String? periodTo;
  final DashboardPeriodStats? periodStats;
  final List<CompletionPeriod> completionByYear;
  final List<CompletionPeriod> completionByMonth;

  const Dashboard({
    required this.gameCount,
    required this.completedCount,
    required this.playingCount,
    required this.totalPlayedHours,
    required this.backlogRemainingHours,
    this.desiredCount = 0,
    this.backlogCount = 0,
    this.pausedCount = 0,
    this.abandonedCount = 0,
    this.archivedCount = 0,
    this.weeklyHours = 0,
    this.queueRemainingHours = 0,
    this.estimatedQueueWeeks,
    this.backlogForecast,
    this.currentGame,
    this.playingGames = const [],
    this.periodFrom,
    this.periodTo,
    this.periodStats,
    this.completionByYear = const [],
    this.completionByMonth = const [],
  });

  factory Dashboard.fromJson(Map<String, dynamic> json) => Dashboard(
        gameCount: json['gameCount'] as int,
        desiredCount: json['desiredCount'] as int? ?? 0,
        backlogCount: json['backlogCount'] as int? ?? 0,
        completedCount: json['completedCount'] as int,
        playingCount: json['playingCount'] as int,
        pausedCount: json['pausedCount'] as int? ?? 0,
        abandonedCount: json['abandonedCount'] as int? ?? 0,
        archivedCount: json['archivedCount'] as int? ?? 0,
        totalPlayedHours: (json['totalPlayedHours'] as num).toDouble(),
        backlogRemainingHours: (json['backlogRemainingHours'] as num).toDouble(),
        weeklyHours: (json['weeklyHours'] as num?)?.toDouble() ?? 0,
        queueRemainingHours: (json['queueRemainingHours'] as num?)?.toDouble() ?? 0,
        estimatedQueueWeeks: (json['estimatedQueueWeeks'] as num?)?.toDouble(),
        backlogForecast: json['backlogForecast'] != null
            ? BacklogForecast.fromJson(json['backlogForecast'] as Map<String, dynamic>)
            : null,
        currentGame: json['currentGame'] != null
            ? PlayingGame.fromJson(json['currentGame'] as Map<String, dynamic>)
            : null,
        playingGames: (json['playingGames'] as List<dynamic>? ?? const [])
            .map((e) => PlayingGame.fromJson(e as Map<String, dynamic>))
            .toList(),
        periodFrom: (json['period'] as Map<String, dynamic>?)?['from'] as String?,
        periodTo: (json['period'] as Map<String, dynamic>?)?['to'] as String?,
        periodStats: json['periodStats'] != null
            ? DashboardPeriodStats.fromJson(json['periodStats'] as Map<String, dynamic>)
            : null,
        completionByYear: (json['completionByYear'] as List<dynamic>? ?? const [])
            .map((e) => CompletionPeriod.fromJson(e as Map<String, dynamic>))
            .toList(),
        completionByMonth: (json['completionByMonth'] as List<dynamic>? ?? const [])
            .map((e) => CompletionPeriod.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
