/// Evento da linha do tempo (`timelineEventSchema`, união discriminada por `type`).
class TimelineEvent {
  static const gameAdded = 'GAME_ADDED';
  static const gameStarted = 'GAME_STARTED';
  static const gameCompleted = 'GAME_COMPLETED';
  static const session = 'SESSION';
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
    this.challengeTitle,
    this.gamesCount,
  });

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
