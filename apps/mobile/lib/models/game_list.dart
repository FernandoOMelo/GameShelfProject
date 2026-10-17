import 'game.dart';

/// Resumo de lista (`gameListSummarySchema`).
class GameListSummary {
  final String id;
  final String name;
  final int gameCount;

  const GameListSummary({
    required this.id,
    required this.name,
    required this.gameCount,
  });

  factory GameListSummary.fromJson(Map<String, dynamic> json) => GameListSummary(
        id: json['id'] as String,
        name: json['name'] as String,
        gameCount: json['gameCount'] as int,
      );
}

/// Lista com seus jogos (`gameListSchema`).
class GameList {
  final String id;
  final String name;
  final int gameCount;
  final List<Game> games;

  const GameList({
    required this.id,
    required this.name,
    required this.gameCount,
    required this.games,
  });

  factory GameList.fromJson(Map<String, dynamic> json) => GameList(
        id: json['id'] as String,
        name: json['name'] as String,
        gameCount: json['gameCount'] as int,
        games: (json['games'] as List<dynamic>)
            .map((e) => Game.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
