/// Conquista desbloqueada, como o Achievist a informa (`timelineAchievementSchema`).
/// Troféus secretos podem vir sem nome, descrição ou ícone.
class TimelineAchievement {
  final String? name;
  final String? description;
  final String? iconUrl;
  final DateTime unlockedAt;

  const TimelineAchievement({this.name, this.description, this.iconUrl, required this.unlockedAt});

  factory TimelineAchievement.fromJson(Map<String, dynamic> json) => TimelineAchievement(
        name: json['name'] as String?,
        description: json['description'] as String?,
        iconUrl: json['iconUrl'] as String?,
        unlockedAt: DateTime.parse(json['unlockedAt'] as String),
      );
}

/// Evento da linha do tempo (`timelineEventSchema`, união discriminada por `type`).
class TimelineEvent {
  static const gameAdded = 'GAME_ADDED';
  static const gameStarted = 'GAME_STARTED';
  static const gameCompleted = 'GAME_COMPLETED';
  static const session = 'SESSION';
  static const externalPlaytimeImported = 'EXTERNAL_PLAYTIME_IMPORTED';
  static const achievementsUnlocked = 'ACHIEVEMENTS_UNLOCKED';
  static const challengeCompleted = 'CHALLENGE_COMPLETED';

  final String type;
  final DateTime at;
  final String date;

  final String? gameId;
  final String? gameTitle;
  final String? coverUrl;

  final String? sessionId;
  final int? durationMinutes;
  final int? progress;
  final String? location;
  final String? notes;
  final String? keyDecisions;
  final String? tips;

  /// Plataforma da sessão ou das conquistas (para o ícone do cartão).
  final String? platformId;

  /// Conquistas dentro da sessão, ou as do dia quando não há sessão.
  final List<TimelineAchievement> achievements;

  /// Total de conquistas do dia em `ACHIEVEMENTS_UNLOCKED` (pode passar de `achievements`).
  final int? count;

  /// Tempo importado de uma plataforma (`EXTERNAL_PLAYTIME_IMPORTED`).
  final String? platformName;
  final int? importedMinutes;

  final String? challengeTitle;
  final int? gamesCount;

  const TimelineEvent({
    required this.type,
    required this.at,
    required this.date,
    this.gameId,
    this.gameTitle,
    this.coverUrl,
    this.sessionId,
    this.durationMinutes,
    this.progress,
    this.location,
    this.notes,
    this.keyDecisions,
    this.tips,
    this.platformId,
    this.achievements = const [],
    this.count,
    this.platformName,
    this.importedMinutes,
    this.challengeTitle,
    this.gamesCount,
  });

  /// Quantas conquistas o cartão anuncia: o total do dia ou as da sessão.
  int get unlockedCount => count ?? achievements.length;

  factory TimelineEvent.fromJson(Map<String, dynamic> json) => TimelineEvent(
        type: json['type'] as String,
        at: DateTime.parse(json['at'] as String),
        date: json['date'] as String,
        gameId: json['gameId'] as String?,
        gameTitle: json['gameTitle'] as String?,
        coverUrl: json['coverUrl'] as String?,
        sessionId: json['sessionId'] as String?,
        durationMinutes: json['durationMinutes'] as int?,
        progress: json['progress'] as int?,
        location: json['location'] as String?,
        notes: json['notes'] as String?,
        keyDecisions: json['keyDecisions'] as String?,
        tips: json['tips'] as String?,
        platformId: json['platformId'] as String?,
        achievements: ((json['achievements'] as List<dynamic>?) ?? const [])
            .map((e) => TimelineAchievement.fromJson(e as Map<String, dynamic>))
            .toList(),
        count: json['type'] == 'ACHIEVEMENTS_UNLOCKED' ? json['count'] as int? : null,
        platformName: json['platformName'] as String?,
        importedMinutes: json['importedMinutes'] as int?,
        challengeTitle: json['title'] as String?,
        gamesCount: json['gamesCount'] as int?,
      );
}

/// Página da linha do tempo (`timelineResponseSchema`). A paginação é por cursor
/// (`nextBefore`), não por offset.
class TimelineResponse {
  final List<TimelineEvent> events;
  final DateTime? nextBefore;

  const TimelineResponse({required this.events, this.nextBefore});

  factory TimelineResponse.fromJson(Map<String, dynamic> json) => TimelineResponse(
        events: (json['events'] as List<dynamic>)
            .map((e) => TimelineEvent.fromJson(e as Map<String, dynamic>))
            .toList(),
        nextBefore: json['nextBefore'] != null
            ? DateTime.parse(json['nextBefore'] as String)
            : null,
      );
}
