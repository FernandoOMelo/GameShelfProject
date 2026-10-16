import 'game.dart';

class QueueItem {
  final int position;
  final DateTime addedAt;
  final Game game;

  const QueueItem({
    required this.position,
    required this.addedAt,
    required this.game,
  });

  factory QueueItem.fromJson(Map<String, dynamic> json) => QueueItem(
        position: json['position'] as int,
        addedAt: DateTime.parse(json['addedAt'] as String),
        game: Game.fromJson(json['game'] as Map<String, dynamic>),
      );
}
