import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../models/catalog.dart';
import '../models/game.dart';
import '../models/timeline.dart';
import '../providers/catalog_provider.dart';
import '../providers/games_provider.dart';
import '../providers/timeline_provider.dart';
import '../widgets/achievements_chart.dart';
import '../widgets/game_cover.dart';
import '../widgets/platform_logo.dart';
import '../widgets/section.dart';
import 'game_detail_screen.dart';

/// Feed de atividade no estilo do Trophies Hunter — paridade com a `TimelineView`
/// da web: um cartão por acontecimento, com capa, frase, data relativa e os
/// ícones das conquistas. A sessão registrada à mão é a fonte do tempo; as
/// conquistas do Achievist que caem nela só a enriquecem, e as sem sessão
/// aparecem sozinhas, como informação.
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

class _TimelineList extends ConsumerWidget {
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
  Widget build(BuildContext context, WidgetRef ref) {
    final platforms = ref.watch(platformsProvider).valueOrNull ?? const <CatalogItem>[];
    final games = ref.watch(gamesProvider).valueOrNull ?? const <Game>[];

    return ListView(
      controller: controller,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        const AchievementsChart(),
        for (final event in state.events)
          FeedCard(
            event: event,
            platform: _platformOf(event, platforms, games),
            onOpenGame: onOpenGame,
          ),
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

  /// Plataforma do evento; sem ela, a principal do jogo.
  static CatalogItem? _platformOf(TimelineEvent event, List<CatalogItem> platforms, List<Game> games) {
    var id = event.platformId;
    if (id == null && event.gameId != null) {
      id = games.where((game) => game.id == event.gameId).firstOrNull?.platformId;
    }
    return platforms.where((item) => item.id == id).firstOrNull;
  }
}

/// "Hoje", "Ontem", "há N dias" até uma semana; depois a data por extenso.
String relativeDay(String date, {DateTime? now}) {
  final parts = date.split('-').map(int.parse).toList();
  final target = DateTime(parts[0], parts[1], parts[2]);
  final reference = now ?? DateTime.now();
  final today = DateTime(reference.year, reference.month, reference.day);
  final days = today.difference(target).inDays;
  if (days <= 0) return 'Hoje';
  if (days == 1) return 'Ontem';
  if (days < 7) return 'há $days dias';
  return DateFormat("d 'de' MMMM 'de' y", 'pt_BR').format(target);
}

/// Cartão do feed: capa, "Você" + data relativa, a frase do acontecimento e,
/// quando há, os ícones das conquistas (toque para ver nome e descrição).
class FeedCard extends StatelessWidget {
  final TimelineEvent event;
  final CatalogItem? platform;
  final ValueChanged<String> onOpenGame;

  const FeedCard({super.key, required this.event, required this.platform, required this.onOpenGame});

  static const _muted = Color(0xFF8888A0);
  static const _strong = TextStyle(color: Colors.white, fontWeight: FontWeight.w700);

  @override
  Widget build(BuildContext context) {
    final isChallenge = event.type == TimelineEvent.challengeCompleted;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFF1E1E2A), borderRadius: BorderRadius.circular(14)),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isChallenge)
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(color: const Color(0xFF2A2A3A), borderRadius: BorderRadius.circular(8)),
              child: const Icon(Icons.star_rounded, color: _muted),
            )
          else
            GameCover(coverUrl: event.coverUrl, width: 52, height: 52, borderRadius: BorderRadius.circular(8)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text('Você', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                    const Spacer(),
                    Text(relativeDay(event.date), style: const TextStyle(color: _muted, fontSize: 12)),
                  ],
                ),
                const SizedBox(height: 4),
                _sentence(context),
                if (event.type == TimelineEvent.session) ..._sessionDetails(),
                if (event.achievements.isNotEmpty) _AchievementRow(event: event),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _sentence(BuildContext context) {
    const base = TextStyle(color: Color(0xFFAAB2BD), fontSize: 13.5, height: 1.5);
    final game = _game();
    InlineSpan name() => TextSpan(children: [
          if (platform != null)
            WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: Padding(
                padding: const EdgeInsets.only(right: 5),
                child: PlatformGlyph(iconKey: platform!.iconKey, size: 15, color: hexColor(platform!.color) ?? _muted),
              ),
            ),
          game,
        ]);

    final spans = switch (event.type) {
      TimelineEvent.session => <InlineSpan>[
          const TextSpan(text: 'Jogou durante '),
          TextSpan(text: formatMinutes(event.durationMinutes), style: _strong),
          if (event.unlockedCount > 0) ...[
            const TextSpan(text: ' e desbloqueou '),
            TextSpan(text: '${event.unlockedCount}', style: _strong),
            TextSpan(text: event.unlockedCount == 1 ? ' conquista' : ' conquistas'),
          ],
          const TextSpan(text: ' em '),
          name(),
        ],
      TimelineEvent.achievementsUnlocked => <InlineSpan>[
          const TextSpan(text: 'Desbloqueou '),
          TextSpan(text: '${event.unlockedCount}', style: _strong),
          TextSpan(text: event.unlockedCount == 1 ? ' conquista' : ' conquistas'),
          const TextSpan(text: ' em '),
          name(),
        ],
      TimelineEvent.gameStarted => <InlineSpan>[const TextSpan(text: 'Iniciou '), name()],
      TimelineEvent.gameCompleted => <InlineSpan>[const TextSpan(text: 'Zerou '), name()],
      TimelineEvent.gameAdded => <InlineSpan>[const TextSpan(text: 'Adicionou '), name(), const TextSpan(text: ' à biblioteca')],
      TimelineEvent.externalPlaytimeImported => <InlineSpan>[
          const TextSpan(text: 'Importou '),
          TextSpan(text: formatMinutes(event.importedMinutes), style: _strong),
          TextSpan(text: ' de tempo da plataforma ${event.platformName ?? ''} em '),
          name(),
        ],
      TimelineEvent.challengeCompleted => <InlineSpan>[
          const TextSpan(text: 'Completou a missão ', style: _strong),
          TextSpan(
              text: '${event.challengeTitle} · ${event.gamesCount} '
                  '${event.gamesCount == 1 ? 'jogo' : 'jogos'}'),
        ],
      _ => <InlineSpan>[TextSpan(text: event.type)],
    };
    return Text.rich(TextSpan(style: base, children: spans));
  }

  /// Nome do jogo, tocável para abrir os detalhes.
  InlineSpan _game() {
    final title = event.gameTitle ?? '';
    final style = _strong.copyWith(decoration: TextDecoration.underline, decorationColor: _muted);
    return WidgetSpan(
      alignment: PlaceholderAlignment.baseline,
      baseline: TextBaseline.alphabetic,
      child: event.gameId == null
          ? Text(title, style: _strong.copyWith(fontSize: 13.5))
          : GestureDetector(
              onTap: () => onOpenGame(event.gameId!),
              child: Text(title, style: style.copyWith(fontSize: 13.5)),
            ),
    );
  }

  List<Widget> _sessionDetails() {
    final line = [event.location, event.progress == null ? null : '${event.progress}%'].whereType<String>().join(' · ');
    return [
      if (line.isNotEmpty)
        Padding(padding: const EdgeInsets.only(top: 4), child: Text(line, style: const TextStyle(color: _muted, fontSize: 12))),
      for (final entry in [
        ('Resumo da história', event.notes),
        ('Decisões importantes', event.keyDecisions),
        ('Dicas e lembretes', event.tips),
      ])
        if (entry.$2 != null && entry.$2!.isNotEmpty) ...[
          const SizedBox(height: 6),
          Text(entry.$1, style: const TextStyle(color: Color(0xFF6C63FF), fontSize: 10, fontWeight: FontWeight.w600)),
          Text(entry.$2!, style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 12)),
        ],
    ];
  }
}

class _AchievementRow extends StatelessWidget {
  final TimelineEvent event;

  const _AchievementRow({required this.event});

  static const _maxVisible = 12;

  @override
  Widget build(BuildContext context) {
    final visible = event.achievements.take(_maxVisible).toList();
    final hidden = event.unlockedCount - visible.length;
    return Container(
      margin: const EdgeInsets.only(top: 10),
      padding: const EdgeInsets.only(top: 10),
      decoration: const BoxDecoration(border: Border(top: BorderSide(color: Color(0xFF2A2A3A)))),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final achievement in visible)
            Tooltip(
              message: achievement.name ?? 'Conquista secreta',
              child: InkWell(
                borderRadius: BorderRadius.circular(6),
                onTap: () => _showDetails(context, achievement),
                child: achievement.iconUrl == null
                    ? Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(color: const Color(0xFF2A2A3A), borderRadius: BorderRadius.circular(6)),
                        child: const Icon(Icons.star_rounded, size: 18, color: Color(0xFF8B949E)),
                      )
                    : GameCover(coverUrl: achievement.iconUrl, width: 38, height: 38, borderRadius: BorderRadius.circular(6)),
              ),
            ),
          if (hidden > 0)
            Container(
              height: 38,
              constraints: const BoxConstraints(minWidth: 38),
              padding: const EdgeInsets.symmetric(horizontal: 8),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: const Color(0xFF2A2A3A), borderRadius: BorderRadius.circular(6)),
              child: Text('+$hidden', style: const TextStyle(color: Color(0xFF9AA3AD), fontSize: 12)),
            ),
        ],
      ),
    );
  }

  /// O equivalente do tooltip da web: nome, descrição e quando foi desbloqueada.
  void _showDetails(BuildContext context, TimelineAchievement achievement) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF1E1E2A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(achievement.name ?? 'Conquista secreta', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              if (achievement.description != null) ...[
                const SizedBox(height: 6),
                Text(achievement.description!, style: const TextStyle(color: Color(0xFF9AA3AD), fontSize: 13)),
              ],
              const SizedBox(height: 10),
              Text(
                'Desbloqueada em ${DateFormat("d 'de' MMM 'de' y · HH:mm", 'pt_BR').format(achievement.unlockedAt.toLocal())}',
                style: const TextStyle(color: Color(0xFF5FD18D), fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
