import 'game.dart';
import 'session.dart';

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

class Dashboard {
  final int gameCount;
  final int completedCount;
  final int playingCount;
  final double totalPlayedHours;
  final double backlogRemainingHours;
  final PlayingGame? currentGame;
  final List<PlayingGame> playingGames;

  const Dashboard({
    required this.gameCount,
    required this.completedCount,
    required this.playingCount,
    required this.totalPlayedHours,
    required this.backlogRemainingHours,
    this.currentGame,
    required this.playingGames,
  });

  factory Dashboard.fromJson(Map<String, dynamic> json) => Dashboard(
        gameCount: json['gameCount'] as int,
        completedCount: json['completedCount'] as int,
        playingCount: json['playingCount'] as int,
        totalPlayedHours: (json['totalPlayedHours'] as num).toDouble(),
        backlogRemainingHours: (json['backlogRemainingHours'] as num).toDouble(),
        currentGame: json['currentGame'] != null
            ? PlayingGame.fromJson(json['currentGame'] as Map<String, dynamic>)
            : null,
        playingGames: (json['playingGames'] as List<dynamic>)
            .map((e) => PlayingGame.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
