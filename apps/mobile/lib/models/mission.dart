/// Missão (`missionSchema`): objetivo de médio prazo; várias ativas, uma principal.
class Mission {
  final String id;
  final String title;
  final String? description;
  final String kind; // LIST | GAMES_COUNT | HOURS | CUSTOM
  final String? listName;
  final int target;
  final double current;
  final double percent;
  final String? dueDate;
  final bool done;
  final bool achieved;
  final bool isPrimary;

  const Mission({
    required this.id,
    required this.title,
    required this.kind,
    required this.target,
    required this.current,
    required this.percent,
    required this.done,
    required this.achieved,
    required this.isPrimary,
    this.description,
    this.listName,
    this.dueDate,
  });

  factory Mission.fromJson(Map<String, dynamic> json) => Mission(
        id: json['id'] as String,
        title: json['title'] as String,
        description: json['description'] as String?,
        kind: json['kind'] as String,
        listName: json['listName'] as String?,
        target: (json['target'] as num).toInt(),
        current: (json['current'] as num).toDouble(),
        percent: (json['percent'] as num).toDouble(),
        dueDate: json['dueDate'] as String?,
        done: json['done'] as bool? ?? false,
        achieved: json['achieved'] as bool? ?? false,
        isPrimary: json['isPrimary'] as bool? ?? false,
      );
}

const missionKindLabels = {
  'LIST': 'Zerar uma lista de jogos',
  'GAMES_COUNT': 'Zerar uma quantidade de jogos',
  'HOURS': 'Jogar uma quantidade de horas',
  'CUSTOM': 'Texto livre',
};
