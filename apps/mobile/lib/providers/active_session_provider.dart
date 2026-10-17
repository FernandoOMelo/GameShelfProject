import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/sessions_api.dart';
import '../models/game.dart';
import '../models/session.dart';

class ActiveSessionState {
  final Game? game;
  final Session? session;
  final bool loading;

  const ActiveSessionState({this.game, this.session, this.loading = false});

  bool get hasActive => game != null && session != null;

  ActiveSessionState copyWith({Game? game, Session? session, bool? loading}) =>
      ActiveSessionState(
        game: game ?? this.game,
        session: session ?? this.session,
        loading: loading ?? this.loading,
      );
}

class ActiveSessionNotifier extends Notifier<ActiveSessionState> {
  static const _gameIdKey = 'active_session_game_id';
  static const _sessionIdKey = 'active_session_id';
  static const _startedAtKey = 'active_session_started_at';

  @override
  ActiveSessionState build() => const ActiveSessionState();

  Future<void> restoreFromPrefs(Game? game) async {
    final prefs = await SharedPreferences.getInstance();
    final sessionId = prefs.getString(_sessionIdKey);
    final startedAtStr = prefs.getString(_startedAtKey);
    final gameId = prefs.getString(_gameIdKey);
    if (sessionId != null && startedAtStr != null && game != null && game.id == gameId) {
      final session = Session(
        id: sessionId,
        gameId: game.id,
        startedAt: DateTime.parse(startedAtStr),
      );
      state = ActiveSessionState(game: game, session: session);
    }
  }

  Future<void> setActive(Game game, Session session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_gameIdKey, game.id);
    await prefs.setString(_sessionIdKey, session.id);
    await prefs.setString(_startedAtKey, session.startedAt.toIso8601String());
    state = ActiveSessionState(game: game, session: session);
  }

  Future<void> start(Game game) async {
    state = state.copyWith(loading: true);
    final now = DateTime.now().toUtc();
    final template = Session(id: '', gameId: game.id, startedAt: now);
    final created = await SessionsApi.create(game.id, template);
    final session = created ?? Session(id: 'offline-${now.millisecondsSinceEpoch}', gameId: game.id, startedAt: now);
    await setActive(game, session);
    state = state.copyWith(loading: false);
  }

  Future<void> end({int? progress, String? location, String? notes, String? keyDecisions, String? tips}) async {
    final current = state;
    if (!current.hasActive) return;
    state = state.copyWith(loading: true);
    final now = DateTime.now().toUtc();
    await SessionsApi.update(
      current.game!.id,
      current.session!.id,
      {
        'endedAt': now.toIso8601String(),
        'progress': ?progress,
        if (location != null && location.isNotEmpty) 'location': location,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        if (keyDecisions != null && keyDecisions.isNotEmpty) 'keyDecisions': keyDecisions,
        if (tips != null && tips.isNotEmpty) 'tips': tips,
      },
    );
    await _clearPrefs();
    state = const ActiveSessionState();
  }

  Future<void> _clearPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_gameIdKey);
    await prefs.remove(_sessionIdKey);
    await prefs.remove(_startedAtKey);
  }

  Future<void> clear() async {
    await _clearPrefs();
    state = const ActiveSessionState();
  }
}

final activeSessionProvider =
    NotifierProvider<ActiveSessionNotifier, ActiveSessionState>(ActiveSessionNotifier.new);
