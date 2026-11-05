import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/lifecycle_api.dart';
import '../models/game.dart';
import '../models/lifecycle.dart';
import '../providers/active_session_provider.dart';
import '../providers/dashboard_provider.dart';
import '../providers/games_provider.dart';
import '../providers/journey_prompt_provider.dart';

/// Inicia a sessão (o cronômetro começa no toque, nunca espera) e, depois,
/// oferece a jornada com um sheet não bloqueante (ADR-042).
Future<void> startSessionWithJourney(BuildContext context, WidgetRef ref, Game game) async {
  final messenger = ScaffoldMessenger.of(context);
  final navigator = Navigator.of(context, rootNavigator: true);
  await ref.read(activeSessionProvider.notifier).start(game);
  if (!await JourneyPromptNotifier.readAsk()) return;
  // Sessão criada offline recebe um id provisório: não há o que vincular agora.
  // A dica deriva do servidor, então o convite volta na próxima vez com internet.
  final session = ref.read(activeSessionProvider).session;
  if (session == null || session.id.startsWith('offline-')) return;
  try {
    final hint = await LifecycleApi.hint(game.id);
    if (!hint.isOffer) {
      // Já há jornada em andamento: a sessão só é vinculada a ela, sem perguntar.
      await LifecycleApi.startPlaying(game.id, sessionId: session.id, startedAt: session.startedAt);
      return;
    }
    if (!navigator.mounted) return;
    final accepted = await showModalBottomSheet<bool>(
      context: navigator.context,
      backgroundColor: const Color(0xFF1E1E2A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => JourneyStartSheet(game: game, hint: hint),
    );
    if (accepted != true) return;
    await LifecycleApi.startPlaying(game.id, sessionId: session.id, startedAt: session.startedAt);
    ref.invalidate(gamesProvider);
    ref.invalidate(dashboardProvider);
    messenger.showSnackBar(SnackBar(content: Text(_doneMessage(hint))));
  } catch (_) {
    // Melhor esforço: a sessão já está rodando e o convite volta na próxima vez.
  }
}

String _doneMessage(LifecycleHint hint) => switch (hint.startMode) {
      'OFFER_REPLAY' => 'Replay iniciado (jornada #${hint.nextSequence}).',
      'OFFER_RESUME' => 'Jornada retomada.',
      _ => hint.startMode == 'OFFER_PLANNED' ? 'Jornada iniciada.' : 'Jornada #${hint.nextSequence} iniciada.',
    };

/// Convite para iniciar a jornada: um toque confirma, "Agora não" dispensa.
class JourneyStartSheet extends StatelessWidget {
  final Game game;
  final LifecycleHint hint;

  const JourneyStartSheet({super.key, required this.game, required this.hint});

  String get _title => switch (hint.startMode) {
        'OFFER_REPLAY' => 'Começar um replay?',
        'OFFER_RESUME' => 'Retomar a jornada?',
        _ => 'Iniciar a jornada?',
      };

  String get _description => switch (hint.startMode) {
        'OFFER_REPLAY' => 'Você já zerou ${game.title}. Uma nova jornada guarda esta rodada à parte.',
        'OFFER_RESUME' => '${game.title} tem uma jornada pausada ou abandonada. Retomar continua na mesma.',
        'OFFER_PLANNED' => '${game.title} tem uma jornada planejada. Ela começa agora, com a data de hoje.',
        _ => '${game.title} ainda não tem jornada. Ela guarda datas, plataforma e sessões desta rodada.',
      };

  String get _action => switch (hint.startMode) {
        'OFFER_REPLAY' => 'Começar replay (jornada #${hint.nextSequence})',
        'OFFER_RESUME' => 'Retomar jornada',
        'OFFER_PLANNED' => 'Iniciar jornada planejada',
        _ => 'Iniciar jornada #${hint.nextSequence}',
      };

  @override
  Widget build(BuildContext context) {
    final last = hint.lastSession;
    final stoppedAt = last == null
        ? null
        : [if (last.location != null && last.location!.isNotEmpty) last.location!, if (last.progress != null) '${last.progress}%'].join(' · ');
    return Padding(
      padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(_description, style: const TextStyle(color: Color(0xFF8888A0), fontSize: 14)),
          if (stoppedAt != null && stoppedAt.isNotEmpty) ...[
            const SizedBox(height: 12),
            Row(children: [
              const Icon(Icons.bookmark_outline_rounded, size: 18, color: Color(0xFF6C63FF)),
              const SizedBox(width: 8),
              Expanded(child: Text('Parou em: $stoppedAt', style: const TextStyle(fontSize: 14))),
            ]),
          ],
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(onPressed: () => Navigator.pop(context, true), child: Text(_action)),
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Agora não')),
          ),
        ],
      ),
    );
  }
}
