import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../models/game.dart';
import '../models/session.dart';
import '../providers/active_session_provider.dart';
import '../providers/catalog_provider.dart';
import '../providers/games_provider.dart';
import '../providers/queue_provider.dart';
import '../widgets/game_cover.dart';
import '../widgets/section.dart';
import '../widgets/status.dart';
import 'end_session_sheet.dart';
import 'game_editor_screen.dart';
import 'quick_log_sheet.dart';
import 'session_editor_sheet.dart';

/// Detalhe do jogo, somente leitura e com as ações da web adaptadas ao celular.
class GameDetailScreen extends ConsumerStatefulWidget {
  final Game game;

  const GameDetailScreen({super.key, required this.game});

  @override
  ConsumerState<GameDetailScreen> createState() => _GameDetailScreenState();
}

class _GameDetailScreenState extends ConsumerState<GameDetailScreen> {
  late Game _game = widget.game;

  @override
  Widget build(BuildContext context) {
    final sessionsAsync = ref.watch(sessionsForGameProvider(_game.id));
    final queue = ref.watch(queueProvider).valueOrNull ?? const [];
    final inQueue = queue.any((item) => item.game.id == _game.id);
    final sessionState = ref.watch(activeSessionProvider);
    final isActive = sessionState.hasActive && sessionState.game?.id == _game.id;

    return Scaffold(
      appBar: AppBar(
        title: Text(_game.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            tooltip: _game.favorite ? 'Remover dos favoritos' : 'Favoritar',
            icon: Icon(
              _game.favorite ? Icons.favorite : Icons.favorite_border,
              color: _game.favorite ? const Color(0xFFE53E3E) : null,
            ),
            onPressed: () => _patch({'favorite': !_game.favorite}),
          ),
          PopupMenuButton<String>(
            onSelected: _onMenu,
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'edit', child: Text('Editar')),
              PopupMenuItem(value: 'retro', child: const Text('Registrar sessão retroativa')),
              PopupMenuItem(
                value: inQueue ? 'unqueue' : 'queue',
                enabled: _game.owned && !_game.archived,
                child: Text(inQueue ? 'Remover da fila' : 'Adicionar à fila'),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'delete',
                child: Text('Excluir', style: TextStyle(color: Color(0xFFE53E3E))),
              ),
            ],
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GameCover(coverUrl: _game.coverUrl, width: 96, height: 128),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        StatusPill(status: _game.status),
                        if (_game.archived) ...[
                          const SizedBox(width: 6),
                          const _Tag('Arquivado'),
                        ],
                        if (_game.gameOfYear) ...[
                          const SizedBox(width: 6),
                          const _Tag('Jogo do ano'),
                        ],
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      [
                        _game.releaseYear,
                        _game.developer,
                      ].where((part) => part != null).join(' · '),
                      style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _game.owned ? 'Na coleção' : 'Não possui este jogo',
                      style: const TextStyle(color: Color(0xFF6B6B7E), fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _ActionBar(
            isActive: isActive,
            hasActiveElsewhere: sessionState.hasActive && !isActive,
            onStart: () => ref.read(activeSessionProvider.notifier).start(_game),
            onEnd: _endActiveSession,
            onLog: () => _openSessionEditor(null),
          ),
          const SizedBox(height: 24),
          const SectionTitle('Progresso'),
          sessionsAsync.when(
            data: (sessions) => Column(
              children: [
                InfoRow(label: 'Total jogado', value: formatHours(_totalHours(sessions))),
                InfoRow(label: 'História principal', value: formatHours(_game.estimatedMainHours)),
                InfoRow(label: 'Pessoal (principal + extras)', value: formatHours(_game.personalEstimatedHours)),
                InfoRow(label: 'Completista', value: formatHours(_game.estimatedCompletionistHours)),
                InfoRow(label: 'Horas sem sessão', value: formatHours(_game.retroactivePlayedHours)),
                InfoRow(label: 'Sessões', value: '${sessions.length}'),
                if (_game.rating != null) InfoRow(label: 'Avaliação', value: '${_game.rating}'),
              ],
            ),
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, _) => const Text('Não foi possível carregar as sessões.',
                style: TextStyle(color: Color(0xFF8888A0), fontSize: 13)),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _addRetroactiveHours(),
                  icon: const Icon(Icons.add_rounded, size: 18),
                  label: const Text('Horas retroativas'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const SectionTitle('Ficha'),
          if (_game.description != null && _game.description!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(_game.description!,
                  style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 13, height: 1.4)),
            ),
          if (_game.publisher != null) InfoRow(label: 'Publicadora', value: _game.publisher!),
          InfoRow(label: 'Plataforma', value: _platformName()),
          InfoRow(label: 'Franquia', value: _franchiseName()),
          if (_game.gameType != null) InfoRow(label: 'Tipo', value: _game.gameType!),
          if (_game.difficulty != null)
            InfoRow(label: 'Dificuldade', value: difficultyLabels[_game.difficulty] ?? _game.difficulty!),
          if (_game.completionCondition != null)
            InfoRow(label: 'Conclusão', value: _game.completionCondition!),
          if (_game.notes != null && _game.notes!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(_game.notes!,
                  style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 13, height: 1.4)),
            ),
          const SizedBox(height: 24),
          const SectionTitle('Sessões'),
          sessionsAsync.when(
            data: (sessions) {
              if (sessions.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Text('Nenhuma sessão registrada.',
                      style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13)),
                );
              }
              final journal = _latestJournal(sessions);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (journal.isNotEmpty) ...[
                    const SectionTitle('Diário'),
                    for (final entry in journal)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(entry.$1,
                                style: const TextStyle(
                                    color: Color(0xFF6C63FF), fontSize: 10, fontWeight: FontWeight.w700)),
                            Text(entry.$2,
                                style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 13)),
                          ],
                        ),
                      ),
                    const SizedBox(height: 8),
                  ],
                  for (final session in sessions)
                    _SessionTile(
                      session: session,
                      onEdit: () => _openSessionEditor(session),
                      onDelete: () => _deleteSession(session),
                    ),
                ],
              );
            },
            loading: () => const SizedBox.shrink(),
            error: (_, _) => const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  double _totalHours(List<Session> sessions) {
    final minutes = sessions.fold<int>(0, (total, session) => total + (session.durationMinutes ?? 0));
    return minutes / 60 + _game.retroactivePlayedHours;
  }

  List<(String, String)> _latestJournal(List<Session> sessions) {
    const keys = ['location', 'notes', 'keyDecisions', 'tips'];
    const labels = ['Onde parei', 'Resumo da história', 'Decisões importantes', 'Dicas e lembretes'];
    final result = <(String, String)>[];
    for (var i = 0; i < keys.length; i++) {
      for (final session in sessions) {
        final value = _field(session, keys[i]);
        if (value != null && value.isNotEmpty) {
          result.add((labels[i], value));
          break;
        }
      }
    }
    return result;
  }

  static String? _field(Session session, String key) => switch (key) {
        'location' => session.location,
        'notes' => session.notes,
        'keyDecisions' => session.keyDecisions,
        'tips' => session.tips,
        _ => null,
      };

  String _platformName() {
    if (_game.platformId == null) return '—';
    final items = ref.watch(platformsProvider).valueOrNull ?? const [];
    return _nameOf(items, _game.platformId!);
  }

  String _franchiseName() {
    if (_game.franchiseId == null) return '—';
    final items = ref.watch(franchisesProvider).valueOrNull ?? const [];
    return _nameOf(items, _game.franchiseId!);
  }

  static String _nameOf(List<dynamic> items, String id) {
    for (final item in items) {
      if (item.id == id) return item.name as String;
    }
    return '—';
  }

  Future<void> _patch(Map<String, dynamic> values) async {
    try {
      final updated = await ref.read(gamesProvider.notifier).updateGame(_game.id, values);
      setState(() => _game = updated);
    } catch (_) {
      _snack('Não foi possível atualizar o jogo.');
    }
  }

  Future<void> _onMenu(String value) async {
    switch (value) {
      case 'edit':
        final saved = await Navigator.push<Game>(
          context,
          MaterialPageRoute(builder: (_) => GameEditorScreen(game: _game)),
        );
        if (saved != null) setState(() => _game = saved);
      case 'retro':
        await showQuickLogSheet(context, _game);
        ref.invalidate(sessionsForGameProvider(_game.id));
      case 'queue':
        await _queue(add: true);
      case 'unqueue':
        await _queue(add: false);
      case 'delete':
        await _confirmDelete();
    }
  }

  Future<void> _queue({required bool add}) async {
    try {
      final notifier = ref.read(queueProvider.notifier);
      if (add) {
        await notifier.add(_game);
      } else {
        await notifier.remove(_game.id);
      }
    } catch (_) {
      _snack(add ? 'Não foi possível adicionar à fila.' : 'Não foi possível remover da fila.');
    }
  }

  Future<void> _addRetroactiveHours() async {
    final controller = TextEditingController();
    final value = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Horas retroativas'),
        content: TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(labelText: 'Horas a somar'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          TextButton(onPressed: () => Navigator.pop(context, controller.text), child: const Text('Adicionar')),
        ],
      ),
    );
    if (value == null) return;
    final amount = double.tryParse(value.trim().replaceAll(',', '.')) ?? 0;
    if (amount <= 0) return;
    final total = ((_game.retroactivePlayedHours + amount) * 100).round() / 100;
    await _patch({'retroactivePlayedHours': total});
    _snack('Horas retroativas adicionadas.');
  }

  Future<void> _openSessionEditor(Session? session) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1E2A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SessionEditorSheet(gameId: _game.id, session: session),
    );
    if (saved == true) ref.invalidate(sessionsForGameProvider(_game.id));
  }

  Future<void> _deleteSession(Session session) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Excluir sessão'),
        content: const Text('Excluir esta sessão? Esta ação não pode ser desfeita.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Excluir', style: TextStyle(color: Color(0xFFE53E3E))),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(sessionsForGameProvider(_game.id).notifier).delete(session.id);
    } catch (_) {
      _snack('Não foi possível excluir a sessão.');
    }
  }

  Future<void> _endActiveSession() async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1E2A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const EndSessionSheet(),
    );
    ref.invalidate(sessionsForGameProvider(_game.id));
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Excluir jogo'),
        content: Text(
          'Excluir ${_game.title} e todo o histórico de sessões relacionado? '
          'Esta ação não pode ser desfeita.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Excluir', style: TextStyle(color: Color(0xFFE53E3E))),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(gamesProvider.notifier).delete(_game.id);
      if (mounted) Navigator.pop(context);
    } catch (_) {
      _snack('Não foi possível excluir o jogo.');
    }
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _ActionBar extends StatelessWidget {
  final bool isActive;
  final bool hasActiveElsewhere;
  final VoidCallback onStart;
  final VoidCallback onEnd;
  final VoidCallback onLog;

  const _ActionBar({
    required this.isActive,
    required this.hasActiveElsewhere,
    required this.onStart,
    required this.onEnd,
    required this.onLog,
  });

  @override
  Widget build(BuildContext context) {
    if (isActive) {
      return ElevatedButton.icon(
        onPressed: onEnd,
        icon: const Icon(Icons.stop_circle_outlined),
        label: const Text('Encerrar sessão'),
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFE53E3E),
          minimumSize: const Size.fromHeight(48),
        ),
      );
    }
    return Row(
      children: [
        Expanded(
          child: ElevatedButton.icon(
            onPressed: hasActiveElsewhere ? null : onStart,
            icon: const Icon(Icons.play_arrow_rounded),
            label: Text(hasActiveElsewhere ? 'Há uma sessão ativa' : 'Iniciar sessão'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: OutlinedButton.icon(
            onPressed: onLog,
            icon: const Icon(Icons.add_rounded),
            label: const Text('Registrar'),
          ),
        ),
      ],
    );
  }
}

class _Tag extends StatelessWidget {
  final String label;

  const _Tag(this.label);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFF2A2A3A),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label, style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 10)),
    );
  }
}

class _SessionTile extends StatelessWidget {
  final Session session;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _SessionTile({required this.session, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final details = [session.location, session.progress == null ? null : '${session.progress}%']
        .where((part) => part != null)
        .join(' · ');

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(12, 12, 4, 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2A),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  DateFormat("d 'de' MMM 'de' y · HH:mm", 'pt_BR').format(session.startedAt.toLocal()),
                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ),
              Text(
                session.isActive ? 'Em andamento' : formatMinutes(session.durationMinutes),
                style: TextStyle(
                  color: session.isActive ? const Color(0xFF48BB78) : const Color(0xFF8888A0),
                  fontSize: 12,
                ),
              ),
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert_rounded, size: 18, color: Color(0xFF6B6B7E)),
                onSelected: (value) => value == 'edit' ? onEdit() : onDelete(),
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'edit', child: Text('Editar')),
                  PopupMenuItem(value: 'delete', child: Text('Excluir')),
                ],
              ),
            ],
          ),
          if (details.isNotEmpty) ...[
            const SizedBox(height: 5),
            Text(details, style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
          ],
          for (final entry in [
            ('Resumo da história', session.notes),
            ('Decisões importantes', session.keyDecisions),
            ('Dicas e lembretes', session.tips),
          ])
            if (entry.$2 != null && entry.$2!.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(entry.$1,
                  style: const TextStyle(color: Color(0xFF6C63FF), fontSize: 10, fontWeight: FontWeight.w600)),
              Text(entry.$2!, style: const TextStyle(color: Color(0xFF6B6B7E), fontSize: 12)),
            ],
        ],
      ),
    );
  }
}
