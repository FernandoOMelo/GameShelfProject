/// Tempo consolidado e conquistas de um jogo, para os cartões da biblioteca.
/// Espelha `gameUsageSchema` de `packages/contracts`.
class GameUsage {
  final String gameId;
  final double playedHours;
  final int achievementsUnlocked;
  final int achievementsTotal;

  const GameUsage({
    required this.gameId,
    this.playedHours = 0,
    this.achievementsUnlocked = 0,
    this.achievementsTotal = 0,
  });

  factory GameUsage.fromJson(Map<String, dynamic> json) => GameUsage(
        gameId: json['gameId'] as String,
        playedHours: (json['playedHours'] as num?)?.toDouble() ?? 0,
        achievementsUnlocked: json['achievementsUnlocked'] as int? ?? 0,
        achievementsTotal: json['achievementsTotal'] as int? ?? 0,
      );
}
