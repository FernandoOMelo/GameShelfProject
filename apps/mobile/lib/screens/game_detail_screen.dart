import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/catalog.dart';
import '../models/game.dart';
import '../models/session.dart';
import '../providers/active_session_provider.dart';
import '../providers/catalog_provider.dart';
import '../providers/games_provider.dart';
import '../providers/queue_provider.dart';
import '../core/games_api.dart';
import '../core/platforms_api.dart';
import '../providers/game_extras_provider.dart';
import '../widgets/game_cover.dart';
import '../widgets/game_picker.dart';
import '../widgets/platform_logo.dart';
import '../widgets/section.dart';
import '../widgets/status.dart';
import 'end_session_sheet.dart';
import 'game_detail/achievements_panel.dart';
import 'game_detail/dlc_franchise_panel.dart';
import 'game_detail/journey_panel.dart';
import 'game_detail/sessions_panel.dart';
import 'finish_game_sheet.dart';
import 'game_editor_screen.dart';
import 'journey_start_sheet.dart';
import 'quick_log_sheet.dart';
import 'session_editor_sheet.dart';

/// Detalhe do jogo em abas, como na web: Resumo, Conquistas, Sessões e
/// DLC & Franquia, com as ações da web adaptadas ao celular.
class GameDetailScreen extends ConsumerStatefulWidget {
  final Game game;

  /// Jogos na ordem da tela de origem (biblioteca filtrada, lista...). Com mais
  /// de um, o detalhe ganha Anterior/Próximo, como na web.
  final List<Game> siblings;

  const GameDetailScreen({super.key, required this.game, this.siblings = const []});

  @override
  ConsumerState<GameDetailScreen> createState() => _GameDetailScreenState();
}

class _GameDetailScreenState extends ConsumerState<GameDetailScreen> {
  late Game _game = widget.game;

  static const _tabs = ['Resumo', 'Conquistas', 'Sessões', 'DLC & Franquia'];

  @override
  Widget build(BuildContext context) {
    final sessionsAsync = ref.watch(sessionsForGameProvider(_game.id));
    final queue = ref.watch(queueProvider).valueOrNull ?? const [];
    final inQueue = queue.any((item) => item.game.id == _game.id);
    final sessionState = ref.watch(activeSessionProvider);
    final isActive = sessionState.hasActive && sessionState.game?.id == _game.id;
    final position = widget.siblings.indexWhere((game) => game.id == _game.id);

    return DefaultTabController(
      length: _tabs.length,
      child: Scaffold(
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
                if (canFinish(_game)) const PopupMenuItem(value: 'finish', child: Text('Zerar')),
                const PopupMenuItem(value: 'retro', child: Text('Registrar sessão retroativa')),
                const PopupMenuItem(value: 'merge', child: Text('Mesclar duplicado')),
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
        bottomNavigationBar: position < 0 || widget.siblings.length < 2
            ? null
            : SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(8, 4, 8, 4),
                  child: Row(
                    children: [
                      Expanded(
                        child: TextButton.icon(
                          onPressed: position > 0 ? () => _goTo(widget.siblings[position - 1]) : null,
                          icon: const Icon(Icons.chevron_left_rounded),
                          label: const Text('Anterior'),
                        ),
                      ),
                      Text('${position + 1}/${widget.siblings.length}',
                          style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
                      Expanded(
                        child: TextButton.icon(
                          onPressed: position < widget.siblings.length - 1 ? () => _goTo(widget.siblings[position + 1]) : null,
                          iconAlignment: IconAlignment.end,
                          icon: const Icon(Icons.chevron_right_rounded),
                          label: const Text('Próximo'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
        body: NestedScrollView(
          key: ValueKey(_game.id),
          headerSliverBuilder: (context, _) => [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Hero(game: _game),
                    const SizedBox(height: 16),
                    _ActionBar(
                      isActive: isActive,
                      hasActiveElsewhere: sessionState.hasActive && !isActive,
                      onStart: () => startSessionWithJourney(context, ref, _game),
                      onEnd: _endActiveSession,
                      onLog: () => _openSessionEditor(null),
                    ),
                    Wrap(
                      spacing: 4,
                      children: [
                        if (canFinish(_game))
                          TextButton.icon(
                            onPressed: _finish,
                            icon: const Icon(Icons.flag_rounded),
                            label: const Text('Zerar'),
                          ),
                        for (final action in quickStatusActions(_game.status))
                          TextButton(
                            onPressed: () => _quickStatus(action.status, action.message),
                            child: Text(action.label),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            SliverPersistentHeader(
              pinned: true,
              delegate: _TabBarDelegate(
                TabBar(
                  isScrollable: true,
                  tabAlignment: TabAlignment.start,
                  tabs: [for (final tab in _tabs) Tab(text: tab)],
                ),
              ),
            ),
          ],
          body: TabBarView(
            children: [
              _tab([_summary(sessionsAsync)]),
              _tab([GameAchievementsPanel(gameId: _game.id)]),
              _tab([
                sessionsAsync.when(
                  data: (sessions) => SessionsPanel(
                    sessions: sessions,
                    retroactiveHours: _game.retroactivePlayedHours,
                    onSetRetroactive: (total) => _patch({'retroactivePlayedHours': total}),
                    onEdit: _openSessionEditor,
                    onDelete: _deleteSession,
                  ),
                  loading: () => const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
                  error: (_, _) => const Text('Não foi possível carregar as sessões.',
                      style: TextStyle(color: Color(0xFF8888A0), fontSize: 13)),
                ),
              ]),
              _tab([DlcFranchisePanel(game: _game)]),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tab(List<Widget> children) => ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: children,
      );

  Widget _summary(AsyncValue<List<Session>> sessionsAsync) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
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
        const SizedBox(height: 24),
        const SectionTitle('Ficha'),
        if (_game.description != null && _game.description!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(_game.description!, style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 13, height: 1.4)),
          ),
        if (_game.publisher != null) InfoRow(label: 'Publicadora', value: _game.publisher!),
        InfoRow(label: 'Plataforma', value: _platformName()),
        InfoRow(label: 'Franquia', value: _franchiseName()),
        if (_game.gameType != null) InfoRow(label: 'Tipo', value: _game.gameType!),
        if (_game.difficulty != null)
          InfoRow(label: 'Dificuldade', value: difficultyLabels[_game.difficulty] ?? _game.difficulty!),
        if (_game.completionCondition != null) InfoRow(label: 'Conclusão', value: _game.completionCondition!),
        if (_game.notes != null && _game.notes!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Text(_game.notes!, style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 13, height: 1.4)),
          ),
        const SizedBox(height: 24),
        GameJourneyPanel(
          gameId: _game.id,
          gameStatus: _game.status,
          gameStartedAt: _game.startedAt,
          gameCompletedAt: _game.completedAt,
          onApplyDate: (field, value) => _patch({field: value}),
          onGameChanged: _reloadGame,
        ),
      ],
    );
  }

  double _totalHours(List<Session> sessions) {
    final minutes = sessions.fold<int>(0, (total, session) => total + (session.durationMinutes ?? 0));
    return minutes / 60 + _game.retroactivePlayedHours;
  }

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

  /// Recarrega o jogo (por exemplo, depois de lançar horas da plataforma).
  Future<void> _reloadGame() async {
    await ref.read(gamesProvider.notifier).reload();
    final games = ref.read(gamesProvider).valueOrNull ?? const <Game>[];
    final fresh = games.where((game) => game.id == _game.id).firstOrNull;
    if (fresh != null && mounted) setState(() => _game = fresh);
  }

  Future<void> _patch(Map<String, dynamic> values) async {
    try {
      final updated = await ref.read(gamesProvider.notifier).updateGame(_game.id, values);
      if (mounted) setState(() => _game = updated);
    } catch (_) {
      _snack('Não foi possível atualizar o jogo.');
      rethrow;
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
      case 'finish':
        await _finish();
      case 'retro':
        await showQuickLogSheet(context, _game);
        ref.invalidate(sessionsForGameProvider(_game.id));
      case 'merge':
        await _mergeDuplicate();
      case 'queue':
        await _queue(add: true);
      case 'unqueue':
        await _queue(add: false);
      case 'delete':
        await _confirmDelete();
    }
  }

  /// Muda o status em um toque, sem abrir o formulário, e oferece Desfazer.
  Future<void> _quickStatus(String status, String message) async {
    final previous = _game.status;
    try {
      await _patch({'status': status});
    } catch (_) {
      return;
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(
        content: Text(message),
        action: SnackBarAction(label: 'Desfazer', onPressed: () => _patch({'status': previous})),
      ));
  }

  /// Zera o jogo (ADR-042) e recarrega a ficha, que a API alterou.
  Future<void> _finish() async {
    await finishGame(context, ref, _game);
    try {
      final fresh = await GamesApi.get(_game.id);
      if (mounted) setState(() => _game = fresh);
    } catch (_) {/* a ficha atualiza na próxima abertura */}
    ref.invalidate(sessionsForGameProvider(_game.id));
  }

  void _goTo(Game game) => setState(() => _game = game);

  /// Mescla um cadastro duplicado neste jogo: ele permanece e absorve o outro.
  Future<void> _mergeDuplicate() async {
    final library = ref.read(gamesProvider).valueOrNull ?? const <Game>[];
    var suggested = <String>{};
    try {
      suggested = (await GamesApi.duplicatesOf(_game.id)).toSet();
    } catch (_) {
      // Sem sugestões, a busca manual continua disponível.
    }
    if (!mounted) return;
    final source = await pickGame(
      context,
      title: 'Mesclar duplicado em "${_game.title}"',
      games: library,
      excludeIds: {_game.id},
      suggestedIds: suggested,
    );
    if (source == null || !mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Mesclar jogos'),
        content: Text(
          'Mesclar "${source.title}" em "${_game.title}"? Sessões, plataformas, conquistas, jornadas, '
          'DLCs, fila e listas passam para "${_game.title}", as horas lançadas são somadas e '
          '"${source.title}" é removido. Esta ação não pode ser desfeita.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Mesclar')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      final merged = await ref.read(gamesProvider.notifier).merge(_game.id, source.id);
      ref.invalidate(sessionsForGameProvider(_game.id));
      ref.invalidate(gameAchievementsProvider(_game.id));
      ref.invalidate(dlcsProvider(_game.id));
      if (mounted) setState(() => _game = merged);
      _snack('Jogos mesclados.');
    } catch (error) {
      _snack(PlatformsApi.errorMessage(error, 'Não foi possível mesclar os jogos.'));
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

/// Capa, status e selo da plataforma na cor da marca.
class _Hero extends ConsumerWidget {
  final Game game;

  const _Hero({required this.game});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final platforms = ref.watch(platformsProvider).valueOrNull ?? const <CatalogItem>[];
    final linked = <String>{?game.platformId, ...game.platformIds};
    final gamePlatforms = platforms.where((item) => linked.contains(item.id)).toList();
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GameCover(coverUrl: game.coverUrl, width: 96, height: 128),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  StatusPill(status: game.status),
                  if (game.archived) const _Tag('Arquivado'),
                  if (game.gameOfYear) const _Tag('Jogo do ano'),
                ],
              ),
              if (gamePlatforms.isNotEmpty) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final platform in gamePlatforms)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: hexColor(platform.color) ?? const Color(0xFF5B6573),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            PlatformGlyph(iconKey: platform.iconKey, size: 14),
                            const SizedBox(width: 6),
                            Text(platform.name, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 10),
              Text(
                [game.releaseYear, game.developer].where((part) => part != null).join(' · '),
                style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12),
              ),
              const SizedBox(height: 6),
              Text(
                game.owned ? 'Na coleção' : 'Não possui este jogo',
                style: const TextStyle(color: Color(0xFF6B6B7E), fontSize: 12),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;

  const _TabBarDelegate(this.tabBar);

  @override
  double get minExtent => tabBar.preferredSize.height;

  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) =>
      Container(color: const Color(0xFF121218), child: tabBar);

  @override
  bool shouldRebuild(covariant _TabBarDelegate oldDelegate) => oldDelegate.tabBar != tabBar;
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

/// Ação de status em um toque: rótulo do botão, status novo e aviso exibido.
class QuickStatusAction {
  final String label;
  final String status;
  final String message;

  const QuickStatusAction(this.label, this.status, this.message);
}

/// Quais mudanças de status em um toque fazem sentido para o status atual.
List<QuickStatusAction> quickStatusActions(String status) => [
      if (status == 'PLAYING') const QuickStatusAction('Pausar', 'PAUSED', 'Jogo pausado.'),
      if (status == 'PAUSED' || status == 'ABANDONED') const QuickStatusAction('Retomar', 'PLAYING', 'Jogo retomado.'),
      if (status == 'BACKLOG') const QuickStatusAction('Marcar como jogando', 'PLAYING', 'Jogo marcado como jogando.'),
      if (status == 'PLAYING' || status == 'PAUSED' || status == 'BACKLOG')
        const QuickStatusAction('Abandonar', 'ABANDONED', 'Jogo abandonado.'),
    ];
