/// Progresso de meta (`goalProgressSchema`).
class GoalProgress {
  final String id;
  final String kind; // COMPLETED_GAMES | PLAYED_HOURS
  final String period; // YEAR | MONTH
  final int year;
  final int? month;
  final int target;
  final double current;
  final double percent;
  final double elapsedPercent;
  final bool achieved;
  final bool onTrack;

  const GoalProgress({
    required this.id,
    required this.kind,
    required this.period,
    required this.year,
    required this.target,
    required this.current,
    required this.percent,
    required this.elapsedPercent,
    required this.achieved,
    required this.onTrack,
    this.month,
  });

  factory GoalProgress.fromJson(Map<String, dynamic> json) => GoalProgress(
        id: json['id'] as String,
        kind: json['kind'] as String,
        period: json['period'] as String,
        year: json['year'] as int,
        month: json['month'] as int?,
        target: json['target'] as int,
        current: (json['current'] as num).toDouble(),
        percent: (json['percent'] as num).toDouble(),
        elapsedPercent: (json['elapsedPercent'] as num).toDouble(),
        achieved: json['achieved'] as bool,
        onTrack: json['onTrack'] as bool,
      );

  String get kindLabel => kind == 'COMPLETED_GAMES' ? 'Jogos zerados' : 'Horas jogadas';
}
