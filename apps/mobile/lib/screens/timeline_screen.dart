import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../models/game.dart';
import '../models/timeline.dart';
import '../providers/games_provider.dart';
import '../providers/timeline_provider.dart';
import '../widgets/section.dart';
import 'game_detail_screen.dart';

/// Linha do tempo da biblioteca — paridade com o `TimelineView` da web.
///
/// A paginação é por cursor (`nextBefore`): o notifier acumula os eventos e a
/// tela carrega a próxima página ao aproximar do fim da lista.
class TimelineScreen extends ConsumerStatefulWidget {
  const TimelineScreen({super.key});

  @override
  ConsumerState<TimelineScreen> createState() => _TimelineScreenState();
}

class _TimelineScreenState extends ConsumerState<TimelineScreen> {
  final _controller = ScrollController();

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onScroll);
  }

  @override
  void dispose() {
    _controller.removeListener(_onScroll);
    _controller.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_controller.hasClients) return;
    final position = _controller.position;
    if (position.pixels >= position.maxScrollExtent - 400) {
      ref.read(timelineProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final timelineAsync = ref.watch(timelineProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Linha do tempo'),
        actions: [
          IconButton(
            tooltip: 'Atualizar',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.read(timelineProvider.notifier).refresh(),
          ),
        ],
      ),
      body: timelineAsync.when(
        data: (state) => state.events.isEmpty
            ? const MessageState(
                icon: Icons.history_rounded,
                message: 'Nada registrado ainda.\n'
                    'Adicione um jogo ou registre uma sessão para começar seu histórico.',
              )
            : RefreshIndicator(
                onRefresh: () => ref.read(timelineProvider.notifier).refresh(),
                child: _TimelineList(
                  controller: _controller,
                  state: state,
                  onLoadMore: () => ref.read(timelineProvider.notifier).loadMore(),
                  onOpenGame: (id) => _openGame(context, ref, id),
                ),
              ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => MessageState(
          icon: Icons.cloud_off_rounded,
          message: 'Não foi possível carregar a linha do tempo',
          actionLabel: 'Tentar novamente',
          onAction: () => ref.read(timelineProvider.notifier).refresh(),
        ),
      ),
    );
  }

  void _openGame(BuildContext context, WidgetRef ref, String gameId) {
    final games = ref.read(gamesProvider).valueOrNull ?? const <Game>[];
    for (final game in games) {
      if (game.id == gameId) {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => GameDetailScreen(game: game)),
        );
        return;
      }
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Jogo não encontrado na biblioteca.')),
    );
  }
}

class _TimelineList extends StatelessWidget {
  final ScrollController controller;
  final TimelineState state;
  final VoidCallback onLoadMore;
  final ValueChanged<String> onOpenGame;

  const _TimelineList({
    required this.controller,
    required this.state,
    required this.onLoadMore,
    required this.onOpenGame,
  });

  @override
  Widget build(BuildContext context) {
    final days = _groupByDay(state.events);

    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        for (final day in days) ...[
          Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 8),
            child: Text(
              _formatDay(day.$1),
              style: const TextStyle(
                color: Color(0xFF6C63FF),
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.4,
              ),
            ),
          ),
          for (final event in day.$2)
            _TimelineTile(event: event, onOpenGame: onOpenGame),
        ],
        if (state.hasMore)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Center(
              child: state.loadingMore
                  ? const CircularProgressIndicator()
                  : OutlinedButton(onPressed: onLoadMore, child: const Text('Carregar mais')),
            ),
          ),
      ],
    );
  }

  static List<(String, List<TimelineEvent>)> _groupByDay(List<TimelineEvent> events) {
    final buckets = <String, List<TimelineEvent>>{};
    for (final event in events) {
      buckets.putIfAbsent(event.date, () => []).add(event);
    }
    return [for (final entry in buckets.entries) (entry.key, entry.value)];
  }

  static String _formatDay(String date) {
    final parts = date.split('-').map(int.parse).toList();
    return DateFormat("d 'de' MMMM 'de' y", 'pt_BR')
        .format(DateTime(parts[0], parts[1], parts[2]));
  }
}

class _TimelineTile extends StatelessWidget {
  final TimelineEvent event;
  final ValueChanged<String> onOpenGame;

  const _TimelineTile({required this.event, required this.onOpenGame});

  static const _labels = {
    TimelineEvent.gameStarted: 'Iniciou',
    TimelineEvent.gameCompleted: 'Zerou',
    TimelineEvent.gameAdded: 'Adicionou à biblioteca',
    TimelineEvent.session: 'Jogou',
    TimelineEvent.challengeCompleted: 'Completou a missão',
  };

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2A),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _headline(),
          if (event.type == TimelineEvent.session) ...[
            const SizedBox(height: 4),
            Text(
              '${_formatDateTime(event.at)} · ${formatMinutes(event.durationMinutes)}',
              style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12),
            ),
            const SizedBox(height: 2),
            Text(
              [
                event.location,
                event.progress == null ? null : '${event.progress}%',
              ].whereType<String>().join(' · '),
              style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12),
            ),
            for (final entry in [
              ('Resumo da história', event.notes),
              ('Decisões importantes', event.keyDecisions),
              ('Dicas e lembretes', event.tips),
            ])
              if (entry.$2 != null && entry.$2!.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(entry.$1,
                    style: const TextStyle(
                        color: Color(0xFF6C63FF), fontSize: 10, fontWeight: FontWeight.w600)),
                Text(entry.$2!,
                    style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 12)),
              ],
          ],
        ],
      ),
    );
  }

  Widget _headline() {
    final label = _labels[event.type] ?? event.type;
    final bold = TextSpan(
      text: '$label ',
      style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white),
    );

    if (event.type == TimelineEvent.challengeCompleted) {
      return Text.rich(
        TextSpan(children: [
          bold,
          TextSpan(
            text: '${event.challengeTitle} · ${event.gamesCount} '
                '${event.gamesCount == 1 ? 'jogo' : 'jogos'}',
            style: const TextStyle(color: Colors.white),
          ),
        ]),
        style: const TextStyle(fontSize: 13),
      );
    }

    final title = TextSpan(
      text: event.gameTitle ?? '',
      style: const TextStyle(color: Color(0xFF6C63FF)),
    );
    if (event.gameId == null) {
      return Text.rich(TextSpan(children: [bold, title]),
          style: const TextStyle(fontSize: 13));
    }
    return InkWell(
      onTap: () => onOpenGame(event.gameId!),
      child: Text.rich(TextSpan(children: [bold, title]),
          style: const TextStyle(fontSize: 13)),
    );
  }

  static String _formatDateTime(DateTime at) =>
      DateFormat("d 'de' MMM 'de' y · HH:mm", 'pt_BR').format(at.toLocal());
}
