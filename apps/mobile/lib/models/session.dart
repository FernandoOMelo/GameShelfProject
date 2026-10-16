class Session {
  final String id;
  final String gameId;
  final DateTime startedAt;
  final DateTime? endedAt;
  final int? durationMinutes;
  final int? progress;
  final String? notes;
  final String? location;
  final String? keyDecisions;
  final String? tips;

  const Session({
    required this.id,
    required this.gameId,
    required this.startedAt,
    this.endedAt,
    this.durationMinutes,
    this.progress,
    this.notes,
    this.location,
    this.keyDecisions,
    this.tips,
  });

  bool get isActive => endedAt == null;

  factory Session.fromJson(Map<String, dynamic> json) => Session(
        id: json['id'] as String,
        gameId: json['gameId'] as String,
        startedAt: DateTime.parse(json['startedAt'] as String),
        endedAt: json['endedAt'] != null ? DateTime.parse(json['endedAt'] as String) : null,
        durationMinutes: json['durationMinutes'] as int?,
        progress: json['progress'] as int?,
        notes: json['notes'] as String?,
        location: json['location'] as String?,
        keyDecisions: json['keyDecisions'] as String?,
        tips: json['tips'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'startedAt': startedAt.toUtc().toIso8601String(),
        if (endedAt != null) 'endedAt': endedAt!.toUtc().toIso8601String(),
        if (progress != null) 'progress': progress,
        if (notes != null) 'notes': notes,
        if (location != null) 'location': location,
        if (keyDecisions != null) 'keyDecisions': keyDecisions,
        if (tips != null) 'tips': tips,
      };
}
