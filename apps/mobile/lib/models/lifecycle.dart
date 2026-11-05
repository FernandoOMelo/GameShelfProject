import 'game.dart';

/// Último ponto onde o jogador parou, para a retomada.
class LastSessionHint {
  final DateTime endedAt;
  final int? progress;
  final String? location;
  final String? keyDecisions;

  const LastSessionHint({required this.endedAt, this.progress, this.location, this.keyDecisions});

  factory LastSessionHint.fromJson(Map<String, dynamic> json) => LastSessionHint(
        endedAt: DateTime.parse(json['endedAt'] as String),
        progress: json['progress'] as int?,
        location: json['location'] as String?,
        keyDecisions: json['keyDecisions'] as String?,
      );
}

/// O que oferecer ao iniciar uma sessão (ADR-042). O servidor decide o modo.
class LifecycleHint {
  /// LINK_ACTIVE, OFFER_FIRST, OFFER_REPLAY, OFFER_RESUME ou OFFER_PLANNED.
  final String startMode;
  final String? journeyId;
  final int nextSequence;
  final String? suggestedPlatformId;
  final LastSessionHint? lastSession;
  final String suggestedCompletedAt;

  const LifecycleHint({
    required this.startMode,
    required this.nextSequence,
    required this.suggestedCompletedAt,
    this.journeyId,
    this.suggestedPlatformId,
    this.lastSession,
  });

  bool get isOffer => startMode != 'LINK_ACTIVE';

  factory LifecycleHint.fromJson(Map<String, dynamic> json) {
    final start = json['start'] as Map<String, dynamic>;
    final finish = json['finish'] as Map<String, dynamic>;
    final last = start['lastSession'] as Map<String, dynamic>?;
    return LifecycleHint(
      startMode: start['mode'] as String,
      journeyId: start['journeyId'] as String?,
      nextSequence: start['nextSequence'] as int,
      suggestedPlatformId: start['suggestedPlatformId'] as String?,
      lastSession: last == null ? null : LastSessionHint.fromJson(last),
      suggestedCompletedAt: finish['suggestedCompletedAt'] as String,
    );
  }
}

/// Resultado de "Zerar": o jogo atualizado e o descritor para desfazer.
class FinishResult {
  final Game game;
  final Map<String, dynamic> undo;

  const FinishResult({required this.game, required this.undo});

  factory FinishResult.fromJson(Map<String, dynamic> json) => FinishResult(
        game: Game.fromJson(json['game'] as Map<String, dynamic>),
        undo: Map<String, dynamic>.from(json['undo'] as Map),
      );
}
