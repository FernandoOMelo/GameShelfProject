import 'game.dart';

/// Sugestão de próximo jogo (`suggestionSchema`).
class Suggestion {
  final Game game;
  final double score;
  final List<String> reasons;

  const Suggestion({required this.game, required this.score, required this.reasons});

  factory Suggestion.fromJson(Map<String, dynamic> json) => Suggestion(
        game: Game.fromJson(json['game'] as Map<String, dynamic>),
        score: (json['score'] as num).toDouble(),
        reasons: (json['reasons'] as List<dynamic>).map((e) => e as String).toList(),
      );
}
