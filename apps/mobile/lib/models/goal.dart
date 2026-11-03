/// Progresso de meta (`goalProgressSchema`).
///
/// COMPLETED_GAMES e PLAYED_HOURS têm período (ano/mês); COMPLETE_LIST,
/// SESSION_HOURS e CUSTOM têm uma data limite livre e opcional (ADR-040).
class GoalProgress {
  final String id;
  final String kind; // COMPLETED_GAMES | PLAYED_HOURS | COMPLETE_LIST | SESSION_HOURS | CUSTOM
  final String period; // YEAR | MONTH
  final int year;
  final int? month;
  final String? title;
  final String? listName;
  final String? dueDate;
  final bool done;
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
    this.title,
    this.listName,
    this.dueDate,
    this.done = false,
  });

  factory GoalProgress.fromJson(Map<String, dynamic> json) => GoalProgress(
        id: json['id'] as String,
        kind: json['kind'] as String,
        period: json['period'] as String,
        year: json['year'] as int,
        month: json['month'] as int?,
        title: json['title'] as String?,
        listName: json['listName'] as String?,
        dueDate: json['dueDate'] as String?,
        done: json['done'] as bool? ?? false,
        target: (json['target'] as num).toInt(),
        current: (json['current'] as num).toDouble(),
        percent: (json['percent'] as num).toDouble(),
        elapsedPercent: (json['elapsedPercent'] as num).toDouble(),
        achieved: json['achieved'] as bool,
        onTrack: json['onTrack'] as bool,
      );

  bool get hasPeriod => kind == 'COMPLETED_GAMES' || kind == 'PLAYED_HOURS';

  String get kindLabel => switch (kind) {
        'COMPLETED_GAMES' => 'Jogos zerados',
        'PLAYED_HOURS' => 'Horas jogadas',
        'COMPLETE_LIST' => 'Zerar uma lista de jogos',
        'SESSION_HOURS' => 'Horas seguidas em uma sessão',
        _ => 'Texto livre',
      };
}

const goalKindLabels = {
  'COMPLETED_GAMES': 'Jogos zerados',
  'PLAYED_HOURS': 'Horas jogadas',
  'COMPLETE_LIST': 'Zerar uma lista de jogos',
  'SESSION_HOURS': 'Horas seguidas em uma sessão',
  'CUSTOM': 'Texto livre',
};
