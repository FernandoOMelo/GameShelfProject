import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../models/activity.dart';
import '../models/game.dart';
import '../models/stats.dart';
import '../providers/games_provider.dart';
import '../providers/stats_provider.dart';
import '../widgets/game_cover.dart';
import '../widgets/section.dart';
import '../widgets/status.dart';
import 'game_detail_screen.dart';

/// Estatísticas da coleção — paridade com o `StatsView` da web.
///
/// Todos os números chegam calculados da API; a tela só organiza e apresenta:
/// totais, replay do ano, mapa de atividade, linha do tempo anual, notas,
/// dificuldades, tabelas por gênero/plataforma/tipo e rankings.
class StatsScreen extends ConsumerWidget {
  const StatsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(statsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Estatísticas'),
        actions: [
          IconButton(
            tooltip: 'Atualizar',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(statsProvider),
          ),
        ],
      ),
      body: statsAsync.when(
        data: (stats) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(statsProvider),
          child: _StatsContent(stats: stats),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => MessageState(
          icon: Icons.cloud_off_rounded,
          message: 'Não foi possível carregar as estatísticas',
          actionLabel: 'Tentar novamente',
          onAction: () => ref.invalidate(statsProvider),
        ),
      ),
    );
  }
}

class _StatsContent extends StatelessWidget {
  final StatsResponse stats;

  const _StatsContent({required this.stats});

  @override
  Widget build(BuildContext context) {
    final totals = stats.totals;
    final ratedEntries =
        stats.ratingDistribution.where((entry) => entry.count > 0).toList();
    final difficultyEntries =
        stats.difficultyDistribution.where((entry) => entry.count > 0).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        const Text(
          'SUA JORNADA',
          style: TextStyle(
            color: Color(0xFF6C63FF),
            fontSize: 11,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.4,
          ),
        ),
        const SizedBox(height: 4),
        const Text('Estatísticas',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        const Text(
          'Números dos jogos zerados. As horas de cada jogo contam no ano em que '
          'ele foi zerado.',
          style: TextStyle(color: Color(0xFF8888A0), fontSize: 13, height: 1.4),
        ),
        const SizedBox(height: 18),
        _KpiGrid(cards: [
          _KpiCard(label: 'Jogos zerados', value: '${totals.completedCount}', accent: true),
          _KpiCard(label: 'Horas em jogos zerados', value: formatHours(totals.completedHours)),
          _KpiCard(
            label: 'Média por jogo zerado',
            value: formatHours(totals.averageCompletedHours),
          ),
          _KpiCard(
            label: 'Tempo de jornada',
            value: totals.journeyStart == null
                ? '—'
                : '${totals.journeyDays} dias (${(totals.journeyDays / 365.25).toStringAsFixed(1).replaceAll('.', ',')} anos)',
          ),
        ]),
        const SizedBox(height: 12),
        _KpiGrid(cards: [
          _KpiCard(
            label: 'Taxa de conclusão',
            value: '${_br(totals.completionRate)}%',
          ),
          _KpiCard(
            label: 'Média por jogo jogado',
            value: formatHours(totals.averageHoursPerGame),
          ),
          _KpiCard(
            label: 'Jogo mais longo',
            value: totals.longestGame?.title ?? '—',
            detail: totals.longestGame == null ? null : formatHours(totals.longestGame!.hours),
          ),
          _KpiCard(
            label: 'Jogo mais curto',
            value: totals.shortestGame?.title ?? '—',
            detail: totals.shortestGame == null ? null : formatHours(totals.shortestGame!.hours),
          ),
        ]),
        const SizedBox(height: 8),
        const Text(
          'A taxa de conclusão ignora jogos desejados, que ainda não estão na '
          'biblioteca. A média por jogo jogado considera todo jogo com horas '
          'registradas, zerado ou não.',
          style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 11, height: 1.4),
        ),
        const SizedBox(height: 20),
        const _ReplayPanel(),
        const SizedBox(height: 16),
        const _ActivityHeatmap(),
        const SizedBox(height: 16),
        _YearTimeline(entries: stats.byYear, onOpenGame: (id) => _openGame(context, id)),
        const SizedBox(height: 16),
        _Panel(
          title: 'Pontuação',
          child: _BarList(
            emptyMessage: 'Nenhum jogo zerado com nota registrada.',
            entries: [
              for (final entry in ratedEntries)
                _BarEntry(
                  label: entry.label == '11' ? '11 · Jogo da vida' : entry.label,
                  value: entry.count,
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _Panel(
          title: 'Nível de dificuldade',
          child: _BarList(
            emptyMessage: 'Nenhum jogo zerado com dificuldade informada.',
            entries: [
              for (final entry in difficultyEntries)
                _BarEntry(
                  label: difficultyLabels[entry.label] ?? entry.label,
                  value: entry.count,
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _GroupTable(title: 'Por gênero', groups: stats.byGenre),
        const SizedBox(height: 16),
        _GroupTable(title: 'Por plataforma', groups: stats.byPlatform),
        const SizedBox(height: 16),
        _GroupTable(title: 'Por tipo', groups: stats.byType),
        const SizedBox(height: 16),
        _GroupTable(title: 'Top 10 desenvolvedoras', groups: stats.byDeveloper),
        const SizedBox(height: 16),
        _Panel(
          title: 'Por ano de lançamento',
          child: _BarList(
            emptyMessage: 'Nenhum jogo com ano de lançamento informado.',
            entries: [
              for (final entry in stats.byReleaseYear)
                _BarEntry(label: entry.label, value: entry.count),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _FavoritesPanel(
          favorites: stats.favorites,
          onOpenGame: (id) => _openGame(context, id),
        ),
        const SizedBox(height: 16),
        _RankPanel(title: 'Top 5 gêneros favoritos', groups: stats.topGenres),
        const SizedBox(height: 16),
        _RankPanel(title: 'Top 10 tipos favoritos', groups: stats.topTypes),
        const SizedBox(height: 20),
      ],
    );
  }

  /// Formata um número no padrão pt-BR (vírgula decimal, sem casas desnecessárias).
  static String _br(double value) =>
      value.toStringAsFixed(1).replaceAll('.', ',').replaceAll(',0', '');

  static void _openGame(BuildContext context, String gameId) {
    final container = ProviderScope.containerOf(context);
    final games = container.read(gamesProvider).valueOrNull ?? const <Game>[];
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

/// Cartão de destaque com rótulo, valor e detalhe opcional.
class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final String? detail;
  final bool accent;

  const _KpiCard({
    required this.label,
    required this.value,
    this.detail,
    this.accent = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2A),
        borderRadius: BorderRadius.circular(14),
        border: accent
            ? Border.all(color: const Color(0xFF6C63FF).withValues(alpha: 0.4))
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            value,
            style: TextStyle(
              color: accent ? const Color(0xFF6C63FF) : Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (detail != null)
            Text(detail!, style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
        ],
      ),
    );
  }
}

class _KpiGrid extends StatelessWidget {
  final List<Widget> cards;

  const _KpiGrid({required this.cards});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const spacing = 12.0;
        final width = (constraints.maxWidth - spacing) / 2;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [for (final card in cards) SizedBox(width: width, child: card)],
        );
      },
    );
  }
}

class _Panel extends StatelessWidget {
  final String title;
  final Widget child;

  const _Panel({required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2A),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _BarEntry {
  final String label;
  final int value;

  const _BarEntry({required this.label, required this.value});
}

class _BarList extends StatelessWidget {
  final List<_BarEntry> entries;
  final String emptyMessage;

  const _BarList({required this.entries, required this.emptyMessage});

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return Text(emptyMessage,
          style: const TextStyle(color: Color(0xFF6B6B7E), fontSize: 13));
    }
    final max = entries.fold<int>(1, (top, entry) => entry.value > top ? entry.value : top);
    return Column(
      children: [
        for (final entry in entries)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                SizedBox(
                  width: 110,
                  child: Text(entry.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 12)),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: entry.value / max,
                      minHeight: 8,
                      backgroundColor: const Color(0xFF2A2A3A),
                      valueColor: const AlwaysStoppedAnimation(Color(0xFF6C63FF)),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  width: 32,
                  child: Text('${entry.value}',
                      textAlign: TextAlign.right,
                      style: const TextStyle(color: Colors.white, fontSize: 12)),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _GroupTable extends StatelessWidget {
  final String title;
  final List<StatsGroup> groups;

  const _GroupTable({required this.title, required this.groups});

  @override
  Widget build(BuildContext context) {
    final visible = groups.where((group) => group.completedCount > 0).toList();
    return _Panel(
      title: title,
      child: visible.isEmpty
          ? const Text('Sem dados ainda.',
              style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13))
          : Column(
              children: [
                const _TableHeader(),
                for (final group in visible)
                  _TableRow(
                    name: group.name,
                    count: '${group.completedCount}',
                    hours: formatHours(group.hours),
                    rating: group.averageRating == null
                        ? '—'
                        : group.averageRating!.toStringAsFixed(1).replaceAll('.', ','),
                  ),
              ],
            ),
    );
  }
}

class _TableHeader extends StatelessWidget {
  const _TableHeader();

  @override
  Widget build(BuildContext context) {
    const style = TextStyle(
      color: Color(0xFF6B6B7E),
      fontSize: 10,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.4,
    );
    return const Padding(
      padding: EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Expanded(flex: 4, child: Text('NOME', style: style)),
          Expanded(flex: 2, child: Text('ZERADOS', textAlign: TextAlign.right, style: style)),
          Expanded(flex: 2, child: Text('TEMPO', textAlign: TextAlign.right, style: style)),
          Expanded(flex: 2, child: Text('NOTA MÉDIA', textAlign: TextAlign.right, style: style)),
        ],
      ),
    );
  }
}

class _TableRow extends StatelessWidget {
  final String name;
  final String count;
  final String hours;
  final String rating;

  const _TableRow({
    required this.name,
    required this.count,
    required this.hours,
    required this.rating,
  });

  @override
  Widget build(BuildContext context) {
    const valueStyle = TextStyle(color: Color(0xFFB8B8C8), fontSize: 12);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Expanded(
            flex: 4,
            child: Text(name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white, fontSize: 12)),
          ),
          Expanded(flex: 2, child: Text(count, textAlign: TextAlign.right, style: valueStyle)),
          Expanded(flex: 2, child: Text(hours, textAlign: TextAlign.right, style: valueStyle)),
          Expanded(flex: 2, child: Text(rating, textAlign: TextAlign.right, style: valueStyle)),
        ],
      ),
    );
  }
}

class _RankPanel extends StatelessWidget {
  final String title;
  final List<StatsGroup> groups;

  const _RankPanel({required this.title, required this.groups});

  @override
  Widget build(BuildContext context) {
    return _Panel(
      title: title,
      child: groups.isEmpty
          ? const Text('Sem notas suficientes.',
              style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13))
          : Column(
              children: [
                for (final group in groups)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(group.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 13)),
                        ),
                        Text(
                          group.averageRating?.toStringAsFixed(1).replaceAll('.', ',') ?? '—',
                          style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}

class _FavoritesPanel extends StatelessWidget {
  final List<StatsGameRef> favorites;
  final ValueChanged<String> onOpenGame;

  const _FavoritesPanel({required this.favorites, required this.onOpenGame});

  @override
  Widget build(BuildContext context) {
    return _Panel(
      title: 'Top 10 jogos favoritos',
      child: favorites.isEmpty
          ? const Text('Marque jogos como favoritos na edição do jogo.',
              style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13))
          : Column(
              children: [
                for (var i = 0; i < favorites.length; i++)
                  InkWell(
                    onTap: () => onOpenGame(favorites[i].id),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 22,
                            child: Text('${i + 1}',
                                style: const TextStyle(color: Color(0xFF6C63FF), fontWeight: FontWeight.w700)),
                          ),
                          Expanded(
                            child: Text(favorites[i].title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: Colors.white, fontSize: 13)),
                          ),
                          if (favorites[i].rating != null)
                            Text('${favorites[i].rating}',
                                style: const TextStyle(color: Color(0xFF8888A0), fontSize: 13)),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}

class _YearTimeline extends StatelessWidget {
  final List<StatsYearBucket> entries;
  final ValueChanged<String> onOpenGame;

  const _YearTimeline({required this.entries, required this.onOpenGame});

  @override
  Widget build(BuildContext context) {
    final ordered = [...entries]..sort((a, b) => b.year.compareTo(a.year));
    return _Panel(
      title: 'Linha do tempo anual',
      child: ordered.isEmpty
          ? const Text('Nenhum jogo zerado com data de conclusão.',
              style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13))
          : Column(
              children: [
                for (final entry in ordered)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            SizedBox(
                              width: 48,
                              child: Text('${entry.year}',
                                  style: const TextStyle(
                                      color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
                            ),
                            Expanded(
                              child: Text(
                                '${entry.completedCount} ${entry.completedCount == 1 ? 'zerado' : 'zerados'}',
                                style: const TextStyle(color: Color(0xFF8888A0), fontSize: 13),
                              ),
                            ),
                            Text(formatHours(entry.hours),
                                style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 13)),
                          ],
                        ),
                        if (entry.gameOfYear != null) ...[
                          const SizedBox(height: 6),
                          InkWell(
                            onTap: () => onOpenGame(entry.gameOfYear!.id),
                            borderRadius: BorderRadius.circular(10),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 4),
                              child: Row(
                                children: [
                                  GameCover(coverUrl: entry.gameOfYear!.coverUrl, width: 32, height: 42),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        const Text('Jogo do ano',
                                            style: TextStyle(
                                                color: Color(0xFF6C63FF),
                                                fontSize: 10,
                                                fontWeight: FontWeight.w700)),
                                        Text(entry.gameOfYear!.title,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(fontSize: 13)),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}

class _ReplayPanel extends ConsumerStatefulWidget {
  const _ReplayPanel();

  @override
  ConsumerState<_ReplayPanel> createState() => _ReplayPanelState();
}

class _ReplayPanelState extends ConsumerState<_ReplayPanel> {
  static const _months = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];

  late int _year = DateTime.now().year;

  @override
  Widget build(BuildContext context) {
    final replayAsync = ref.watch(replayProvider(_year));

    return _Panel(
      title: 'Replay do ano',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _YearSelector(
            year: _year,
            onPrevious: () => setState(() => _year--),
            onNext: _year >= DateTime.now().year ? null : () => setState(() => _year++),
          ),
          const SizedBox(height: 12),
          replayAsync.when(
            data: (replay) {
              final empty = replay.sessionCount == 0 && replay.completedCount == 0;
              if (empty) {
                return Text('Nada registrado em $_year.',
                    style: const TextStyle(color: Color(0xFF6B6B7E), fontSize: 13));
              }
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SummaryList(entries: [
                    ('Horas jogadas', formatHours(replay.totalMinutes / 60)),
                    ('Sessões', '${replay.sessionCount}'),
                    ('Dias jogados', '${replay.activeDays}'),
                    ('Jogos zerados', '${replay.completedCount}'),
                  ]),
                  const SizedBox(height: 12),
                  if (replay.mostPlayedGame != null)
                    _Highlight(
                      label: 'Jogo mais jogado',
                      title: replay.mostPlayedGame!.title,
                      detail: formatHours(replay.mostPlayedGame!.minutes / 60),
                      onTap: () => _StatsContent._openGame(context, replay.mostPlayedGame!.id),
                    ),
                  if (replay.topGenre != null)
                    _Highlight(
                      label: 'Gênero mais jogado',
                      title: replay.topGenre!.name,
                      detail: formatHours(replay.topGenre!.minutes / 60),
                    ),
                  if (replay.busiestMonth != null)
                    _Highlight(
                      label: 'Mês mais ativo',
                      title: _months[replay.busiestMonth!.month - 1],
                      detail: formatHours(replay.busiestMonth!.minutes / 60),
                    ),
                  if (replay.longestSession != null)
                    _Highlight(
                      label: 'Maior sessão',
                      title: replay.longestSession!.title,
                      detail:
                          '${formatHours(replay.longestSession!.minutes / 60)} em ${_formatDate(replay.longestSession!.date)}',
                      onTap: () => _StatsContent._openGame(context, replay.longestSession!.gameId),
                    ),
                  if (replay.gameOfYear != null)
                    _Highlight(
                      label: 'Jogo do ano',
                      title: replay.gameOfYear!.title,
                      onTap: () => _StatsContent._openGame(context, replay.gameOfYear!.id),
                    ),
                ],
              );
            },
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, _) => const Text('Não foi possível carregar o replay.',
                style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13)),
          ),
        ],
      ),
    );
  }

  static String _formatDate(String date) {
    final parts = date.split('-').map(int.parse).toList();
    return DateFormat("d 'de' MMM 'de' y", 'pt_BR')
        .format(DateTime(parts[0], parts[1], parts[2]));
  }
}

class _ActivityHeatmap extends ConsumerStatefulWidget {
  const _ActivityHeatmap();

  @override
  ConsumerState<_ActivityHeatmap> createState() => _ActivityHeatmapState();
}

class _ActivityHeatmapState extends ConsumerState<_ActivityHeatmap> {
  static const _monthShort = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  static const _levelColors = [
    Color(0xFF232334),
    Color(0xFF322C5C),
    Color(0xFF47408E),
    Color(0xFF5950C6),
    Color(0xFF6C63FF),
  ];

  late int _year = DateTime.now().year;

  @override
  Widget build(BuildContext context) {
    final activityAsync = ref.watch(activityProvider(_year));

    return _Panel(
      title: 'Atividade',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _YearSelector(
            year: _year,
            onPrevious: () => setState(() => _year--),
            onNext: _year >= DateTime.now().year ? null : () => setState(() => _year++),
          ),
          const SizedBox(height: 12),
          activityAsync.when(
            data: (activity) => _HeatmapBody(
              activity: activity,
              year: _year,
              monthShort: _monthShort,
              levelColors: _levelColors,
            ),
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, _) => const Text('Não foi possível carregar a atividade.',
                style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

class _HeatmapBody extends StatelessWidget {
  final ActivityResponse activity;
  final int year;
  final List<String> monthShort;
  final List<Color> levelColors;

  const _HeatmapBody({
    required this.activity,
    required this.year,
    required this.monthShort,
    required this.levelColors,
  });

  @override
  Widget build(BuildContext context) {
    final minutesByDate = {
      for (final day in activity.days) day.date: day.minutes,
    };
    final jan1 = DateTime.utc(year, 1, 1);
    final totalDays = DateTime.utc(year + 1, 1, 1).difference(jan1).inDays;
    final leading = jan1.weekday % 7; // domingo = 0
    final weeks = ((leading + totalDays) / 7).ceil();
    const cell = 12.0;
    const gap = 2.0;

    int level(int minutes) {
      if (minutes <= 0 || activity.maxDayMinutes <= 0) return 0;
      final raw = (minutes / activity.maxDayMinutes * 4).ceil();
      return raw.clamp(0, 4);
    }

    // Rótulo do mês ancorado na coluna (semana) em que ele começa.
    final monthColumn = <int, String>{};
    for (var month = 0; month < 12; month++) {
      final days = DateTime.utc(year, month + 1, 1).difference(jan1).inDays;
      final column = (leading + days) ~/ 7;
      monthColumn.putIfAbsent(column, () => monthShort[month]);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  for (var week = 0; week < weeks; week++)
                    SizedBox(
                      width: cell + gap,
                      child: monthColumn[week] != null
                          ? Text(monthColumn[week]!,
                              style: const TextStyle(color: Color(0xFF6B6B7E), fontSize: 9))
                          : null,
                    ),
                ],
              ),
              const SizedBox(height: 2),
              Row(
                children: [
                  for (var week = 0; week < weeks; week++)
                    Padding(
                      padding: const EdgeInsets.only(right: gap),
                      child: Column(
                        children: [
                          for (var weekday = 0; weekday < 7; weekday++)
                            Builder(builder: (_) {
                              final index = week * 7 + weekday - leading;
                              final inRange = index >= 0 && index < totalDays;
                              final date = inRange
                                  ? jan1.add(Duration(days: index)).toIso8601String().substring(0, 10)
                                  : null;
                              final minutes = date == null ? 0 : (minutesByDate[date] ?? 0);
                              return Padding(
                                padding: const EdgeInsets.only(bottom: gap),
                                child: Container(
                                  width: cell,
                                  height: cell,
                                  decoration: BoxDecoration(
                                    color: inRange
                                        ? levelColors[level(minutes)]
                                        : Colors.transparent,
                                    borderRadius: BorderRadius.circular(2),
                                  ),
                                ),
                              );
                            }),
                        ],
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _SummaryList(entries: [
          ('Dias jogados', '${activity.activeDays}'),
          ('Horas no ano', formatHours(activity.totalMinutes / 60)),
          ('Sequência atual', '${activity.currentStreak} ${activity.currentStreak == 1 ? 'dia' : 'dias'}'),
          ('Maior sequência', '${activity.longestStreak} ${activity.longestStreak == 1 ? 'dia' : 'dias'}'),
        ]),
        const SizedBox(height: 8),
        const Text(
          'Conta apenas sessões registradas; horas retroativas não têm data e ficam de fora.',
          style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 11, height: 1.4),
        ),
      ],
    );
  }
}

class _SummaryList extends StatelessWidget {
  final List<(String, String)> entries;

  const _SummaryList({required this.entries});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const spacing = 10.0;
        final width = (constraints.maxWidth - spacing) / 2;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            for (final entry in entries)
              SizedBox(
                width: width,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(entry.$2,
                        style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
                    Text(entry.$1,
                        style: const TextStyle(color: Color(0xFF8888A0), fontSize: 11)),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}

class _Highlight extends StatelessWidget {
  final String label;
  final String title;
  final String? detail;
  final VoidCallback? onTap;

  const _Highlight({required this.label, required this.title, this.detail, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label,
                      style: const TextStyle(
                          color: Color(0xFF6B6B7E), fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.4)),
                  const SizedBox(height: 2),
                  Text(title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: Colors.white, fontSize: 13)),
                ],
              ),
            ),
            if (detail != null)
              Padding(
                padding: const EdgeInsets.only(left: 8, top: 12),
                child: Text(detail!, style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
              ),
          ],
        ),
      ),
    );
  }
}

class _YearSelector extends StatelessWidget {
  final int year;
  final VoidCallback onPrevious;
  final VoidCallback? onNext;

  const _YearSelector({required this.year, required this.onPrevious, this.onNext});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        IconButton(
          onPressed: onPrevious,
          tooltip: 'Ano anterior',
          visualDensity: VisualDensity.compact,
          icon: const Icon(Icons.chevron_left_rounded, size: 20),
        ),
        Text('$year', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        IconButton(
          onPressed: onNext,
          tooltip: 'Próximo ano',
          visualDensity: VisualDensity.compact,
          icon: const Icon(Icons.chevron_right_rounded, size: 20),
        ),
      ],
    );
  }
}
