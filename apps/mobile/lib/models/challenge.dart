/// Progresso da missão principal (`mainChallengeSchema`).
///
/// A missão acompanha uma lista: o progresso é quantos jogos dela já foram
/// zerados. O cálculo vem pronto da API.
class MainChallenge {
  final String title;
  final String listId;
  final String listName;
  final int totalGames;
  final int completedGames;
  final double percent;

  const MainChallenge({
    required this.title,
    required this.listId,
    required this.listName,
    required this.totalGames,
    required this.completedGames,
    required this.percent,
  });

  factory MainChallenge.fromJson(Map<String, dynamic> json) => MainChallenge(
        title: json['title'] as String,
        listId: json['listId'] as String,
        listName: json['listName'] as String,
        totalGames: json['totalGames'] as int,
        completedGames: json['completedGames'] as int,
        percent: (json['percent'] as num).toDouble(),
      );
}
