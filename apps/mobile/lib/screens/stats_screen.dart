import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../models/activity.dart';
import '../models/catalog.dart';
import '../models/game.dart';
import '../models/platform_summary.dart';
import '../models/stats.dart';
import '../providers/catalog_provider.dart';
import '../providers/games_provider.dart';
import '../providers/platforms_provider.dart';
import '../providers/stats_provider.dart';
import '../widgets/achievements_chart.dart';
import '../widgets/game_cover.dart';
import '../widgets/platform_logo.dart';
import '../widgets/section.dart';
import '../widgets/status.dart';
import 'game_detail_screen.dart';
import 'platforms_screen.dart' show PlatformCard;

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
        skipLoadingOnReload: true,
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

class _StatsContent extends ConsumerWidget {
  final StatsResponse stats;

  const _StatsContent({required this.stats});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final totals = stats.totals;
    final library = stats.library;
    final period = ref.watch(statsYearProvider);
    final years = stats.byYear.map((entry) => entry.year).toList();
    final summaries = ref.watch(platformSummariesProvider).valueOrNull ?? const <PlatformSummary>[];
    final catalog = ref.watch(platformsProvider).valueOrNull ?? const <CatalogItem>[];
    final ratedEntries = stats.ratingDistribution.where((entry) => entry.count > 0).toList();
    final difficultyEntries = stats.difficultyDistribution.where((entry) => entry.count > 0).toList();
    final byGenre = stats.byGenre.where((group) => group.completedCount > 0).toList();
    final byType = stats.byType.where((group) => group.completedCount > 0).toList();
    final byDeveloper = stats.byDeveloper.where((group) => group.completedCount > 0).toList();
    final journey = totals.journeyStart == null ? null : '${totals.journeyDays} dias';
    final journeyHint = totals.journeyStart == null
        ? null
        : '${(totals.journeyDays / 365.25).toStringAsFixed(1).replaceAll('.', ',')} anos desde o primeiro registro';
    final timeBars = library?.externalPlaytimeByPlatform.where((entry) => entry.hours > 0).toList() ?? const [];

    // Seções sem dado vão para a faixa do fim, cada uma com o que as preenche.
    final empty = <(String, String)>[];
    bool has(bool condition, String title, String hint) {
      if (!condition) empty.add((title, hint));
      return condition;
    }

    final hasRating = has(ratedEntries.isNotEmpty, 'Pontuação', 'Dê nota aos jogos zerados.');
    final hasDifficulty =
        has(difficultyEntries.isNotEmpty, 'Nível de dificuldade', 'Informe a dificuldade ao zerar um jogo.');
    final hasGenre = has(byGenre.isNotEmpty, 'Por gênero', 'Zere um jogo com gênero definido.');
    final hasType = has(byType.isNotEmpty, 'Por tipo', 'Informe o tipo do jogo na edição.');
    final hasDeveloper = has(byDeveloper.isNotEmpty, 'Top 10 desenvolvedoras', 'Zere um jogo com desenvolvedora.');
    final hasRelease =
        has(stats.byReleaseYear.isNotEmpty, 'Por ano de lançamento', 'Informe o ano de lançamento dos jogos.');
    final hasFavorites =
        has(stats.favorites.isNotEmpty, 'Top 10 jogos favoritos', 'Marque jogos como favoritos na edição do jogo.');
    final hasTopGenres = has(stats.topGenres.isNotEmpty, 'Top 5 gêneros favoritos', 'Precisa de notas nos jogos zerados.');
    final hasTopTypes = has(stats.topTypes.isNotEmpty, 'Top 10 tipos favoritos', 'Precisa de notas nos jogos zerados.');

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
        const Text('Estatísticas', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
        const SizedBox(height: 6),
        Text(
          period == null
              ? 'Números dos jogos zerados. As horas de cada jogo contam no ano em que ele foi zerado.'
              : 'Jogos zerados em $period. A biblioteca, as jornadas e as plataformas abaixo continuam mostrando tudo.',
          style: const TextStyle(color: Color(0xFF8888A0), fontSize: 13, height: 1.4),
        ),
        if (years.isNotEmpty) ...[
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                ChoiceChip(
                  label: const Text('Tudo'),
                  selected: period == null,
                  onSelected: (_) => ref.read(statsYearProvider.notifier).state = null,
                ),
                for (final year in years) ...[
                  const SizedBox(width: 8),
                  ChoiceChip(
                    label: Text('$year'),
                    selected: period == year,
                    onSelected: (_) => ref.read(statsYearProvider.notifier).state = year,
                  ),
                ],
              ],
            ),
          ),
        ],
        const SizedBox(height: 18),
        _MetricGrid(metrics: [
          _Metric(
            hero: true,
            accent: true,
            label: 'Jogos zerados',
            value: '${totals.completedCount}',
            hint: totals.completedCount == 0 ? 'Zere um jogo para ver' : null,
          ),
          _Metric(hero: true, label: 'Horas em jogos zerados', value: formatHours(totals.completedHours)),
          _Metric(
            hero: true,
            label: 'Média por jogo zerado',
            value: totals.averageCompletedHours == null ? null : formatHours(totals.averageCompletedHours),
            emptyHint: 'Zere um jogo com horas',
          ),
          if (library != null)
            _Metric(
              hero: true,
              accent: true,
              label: 'Total consolidado',
              value: formatHours(library.consolidatedPlayedHours),
              info: 'O total consolidado soma as horas registradas aqui com ${formatHours(library.externalCountedHours)} '
                  'de plataformas marcadas como fonte do total, descontando o que já foi lançado como horas '
                  'retroativas. As demais horas informadas por plataformas ficam de fora para não contar a '
                  'mesma atividade duas vezes.',
            ),
        ]),
        const _SectionHeading('Biblioteca'),
        _MetricGrid(metrics: [
          if (library != null) _Metric(label: 'Jogos cadastrados', value: '${library.gameCount}'),
          if (library != null) _Metric(label: 'Associações de plataforma', value: '${library.platformLinkCount}'),
          _Metric(
            label: 'Taxa de conclusão',
            value: '${_br(totals.completionRate)}%',
            info: 'Ignora jogos desejados, que ainda não estão na biblioteca.',
          ),
          _Metric(label: 'Tempo de jornada', value: journey, hint: journeyHint, emptyHint: 'Sem registros ainda'),
        ]),
        if (library != null) ...[
          const _SectionHeading('Jornadas'),
          _MetricGrid(metrics: [
            _Metric(label: 'Jornadas iniciadas', value: '${library.playthroughsStarted}'),
            _Metric(label: 'Jornadas concluídas', value: '${library.playthroughsCompleted}'),
            _Metric(label: 'Replays iniciados', value: '${library.replaysStarted}'),
            _Metric(label: 'Jogos com jornada zerada', value: '${library.gamesWithCompletedPlaythrough}'),
          ]),
        ],
        const _SectionHeading('Tempo'),
        _MetricGrid(metrics: [
          if (library != null) _Metric(label: 'Horas registradas aqui', value: formatHours(library.localPlayedHours)),
          if (library != null)
            _Metric(
              label: 'Horas informadas por plataformas',
              value: formatHours(library.externalPlaytimeHours),
              info: 'Medida separada do histórico de sessões: as duas não são somadas.',
            ),
          _Metric(
            label: 'Média por jogo jogado',
            value: totals.averageHoursPerGame == null ? null : formatHours(totals.averageHoursPerGame),
            info: 'Considera todo jogo com horas registradas, zerado ou não.',
            emptyHint: 'Sem horas registradas',
          ),
          _Metric(
            label: 'Jogo mais longo',
            value: totals.longestGame?.title,
            hint: totals.longestGame == null ? null : formatHours(totals.longestGame!.hours),
            emptyHint: 'Zere um jogo com horas',
            small: true,
          ),
          _Metric(
            label: 'Jogo mais curto',
            value: totals.shortestGame?.title,
            hint: totals.shortestGame == null ? null : formatHours(totals.shortestGame!.hours),
            emptyHint: 'Zere um jogo com horas',
            small: true,
          ),
        ]),
        if (timeBars.isNotEmpty) ...[
          const SizedBox(height: 16),
          _Panel(
            title: 'Tempo informado por plataforma',
            child: _PlatformTimeBars(entries: timeBars, catalog: catalog),
          ),
        ],
        if (summaries.any((item) => item.gameCount > 0)) ...[
          const SizedBox(height: 16),
          _Panel(
            title: 'Plataformas',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Toda a biblioteca, não só os jogos zerados.',
                    style: TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
                const SizedBox(height: 12),
                for (final summary in summaries.where((item) => item.gameCount > 0))
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: PlatformCard(summary: summary, readOnly: true),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        _ReplayPanel(suggestedYear: years.isEmpty ? null : years.first),
        const SizedBox(height: 16),
        const AchievementsChart(),
        const _ActivityHeatmap(),
        const SizedBox(height: 16),
        _YearTimeline(entries: stats.byYear, onOpenGame: (id) => _openGame(context, id)),
        if (hasRating) ...[
          const SizedBox(height: 16),
          _Panel(
            title: 'Pontuação',
            child: _BarList(
              emptyMessage: 'Nenhum jogo zerado com nota registrada.',
              entries: [
                for (final entry in ratedEntries)
                  _BarEntry(label: entry.label == '11' ? '11 · Jogo da vida' : entry.label, value: entry.count),
              ],
            ),
          ),
        ],
        if (hasDifficulty) ...[
          const SizedBox(height: 16),
          _Panel(
            title: 'Nível de dificuldade',
            child: _BarList(
              emptyMessage: 'Nenhum jogo zerado com dificuldade informada.',
              entries: [
                for (final entry in difficultyEntries)
                  _BarEntry(label: difficultyLabels[entry.label] ?? entry.label, value: entry.count),
              ],
            ),
          ),
        ],
        if (hasGenre) ...[const SizedBox(height: 16), _RankBars(title: 'Por gênero', groups: byGenre)],
        if (hasType) ...[const SizedBox(height: 16), _RankBars(title: 'Por tipo', groups: byType)],
        if (hasDeveloper) ...[const SizedBox(height: 16), _RankBars(title: 'Top 10 desenvolvedoras', groups: byDeveloper)],
        if (hasRelease) ...[
          const SizedBox(height: 16),
          _Panel(
            title: 'Por ano de lançamento',
            child: _ColumnChart(entries: [for (final entry in stats.byReleaseYear) (entry.label, entry.count)]),
          ),
        ],
        if (hasFavorites) ...[
          const SizedBox(height: 16),
          _Panel(
            title: 'Top 10 jogos favoritos',
            child: _FavoriteShelf(favorites: stats.favorites, onOpenGame: (id) => _openGame(context, id)),
          ),
        ],
        if (hasTopGenres) ...[const SizedBox(height: 16), _RankPanel(title: 'Top 5 gêneros favoritos', groups: stats.topGenres)],
        if (hasTopTypes) ...[const SizedBox(height: 16), _RankPanel(title: 'Top 10 tipos favoritos', groups: stats.topTypes)],
        if (hasTopGenres || hasTopTypes) ...[
          const SizedBox(height: 8),
          const Text(
            'Rankings de gênero e tipo usam a média das notas dos jogos zerados.',
            style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 11),
          ),
        ],
        if (empty.isNotEmpty) ...[
          const SizedBox(height: 16),
          _Panel(
            title: 'Ainda sem dados',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final item in empty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.$1, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        Text(item.$2, style: const TextStyle(color: Color(0xFF737771), fontSize: 12)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 20),
      ],
    );
  }

  /// Formata um número no padrão pt-BR (vírgula decimal, sem casas desnecessárias).
  static String _br(double value) => value.toStringAsFixed(1).replaceAll('.', ',').replaceAll(',0', '');

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

class _SectionHeading extends StatelessWidget {
  final String title;

  const _SectionHeading(this.title);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 24, bottom: 10),
        child: Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
      );
}

/// Número com rótulo. Valor ausente vira um traço discreto com a dica do que o
/// preenche; `info` mostra a explicação ao tocar no ⓘ.
class _Metric extends StatelessWidget {
  final String label;
  final String? value;
  final String? hint;
  final String? info;
  final String? emptyHint;
  final bool hero;
  final bool accent;
  final bool small;

  const _Metric({
    required this.label,
    required this.value,
    this.hint,
    this.info,
    this.emptyHint,
    this.hero = false,
    this.accent = false,
    this.small = false,
  });

  @override
  Widget build(BuildContext context) {
    final valueStyle = TextStyle(
      color: accent ? const Color(0xFF7FB0FF) : Colors.white,
      fontSize: hero ? 26 : (small ? 14 : 20),
      fontWeight: FontWeight.w700,
      height: 1.2,
    );
    return Container(
      padding: EdgeInsets.all(hero ? 16 : 14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2A),
        borderRadius: BorderRadius.circular(14),
        border: accent ? Border.all(color: const Color(0xFF6C63FF).withValues(alpha: 0.4)) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Flexible(child: Text(label, style: const TextStyle(color: Color(0xFF8B949E), fontSize: 11.5))),
              if (info != null)
                Tooltip(
                  message: info!,
                  triggerMode: TooltipTriggerMode.tap,
                  showDuration: const Duration(seconds: 6),
                  child: const Padding(
                    padding: EdgeInsets.only(left: 6),
                    child: Icon(Icons.info_outline_rounded, size: 14, color: Color(0xFF6E7681)),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          if (value == null) ...[
            const Text('—', style: TextStyle(color: Color(0xFF4A515B), fontSize: 20)),
            if (emptyHint != null) Text(emptyHint!, style: const TextStyle(color: Color(0xFF737771), fontSize: 11)),
          ] else ...[
            Text(value!, style: valueStyle),
            if (hint != null) Text(hint!, style: const TextStyle(color: Color(0xFF737771), fontSize: 11)),
          ],
        ],
      ),
    );
  }
}

/// Grade de duas colunas de largura igual; o cartão sozinho na última linha
/// ocupa a mesma largura dos outros.
class _MetricGrid extends StatelessWidget {
  final List<Widget> metrics;

  const _MetricGrid({required this.metrics});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const spacing = 12.0;
        final width = (constraints.maxWidth - spacing) / 2;
        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [for (final metric in metrics) SizedBox(width: width, child: metric)],
        );
      },
    );
  }
}

/// Barras do tempo informado por plataforma, na cor e com o logo de cada uma.
class _PlatformTimeBars extends StatelessWidget {
  final List<ExternalPlaytimeByPlatform> entries;
  final List<CatalogItem> catalog;

  const _PlatformTimeBars({required this.entries, required this.catalog});

  @override
  Widget build(BuildContext context) {
    final max = entries.fold<double>(0, (top, entry) => entry.hours > top ? entry.hours : top);
    return Column(
      children: [
        const Align(
          alignment: Alignment.centerLeft,
          child: Text('Medida separada do histórico de sessões: as duas não são somadas.',
              style: TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
        ),
        const SizedBox(height: 12),
        for (final entry in entries)
          Builder(builder: (context) {
            final platform = catalog.where((item) => item.id == entry.key || item.name == entry.name).firstOrNull;
            final color = hexColor(platform?.color) ?? const Color(0xFF6C63FF);
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  PlatformLogo(iconKey: platform?.iconKey, color: platform?.color, size: 24),
                  const SizedBox(width: 10),
                  SizedBox(
                    width: 84,
                    child: Text(entry.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5)),
                  ),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: max == 0 ? 0 : entry.hours / max,
                        minHeight: 8,
                        backgroundColor: const Color(0xFF2A2A3A),
                        valueColor: AlwaysStoppedAnimation(color),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(formatHours(entry.hours), style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
                ],
              ),
            );
          }),
      ],
    );
  }
}

/// Barras ordenadas com participação percentual; as cinco maiores, e o resto
/// sob "Ver mais". Horas e nota média aparecem ao tocar.
class _RankBars extends StatefulWidget {
  final String title;
  final List<StatsGroup> groups;

  const _RankBars({required this.title, required this.groups});

  @override
  State<_RankBars> createState() => _RankBarsState();
}

class _RankBarsState extends State<_RankBars> {
  static const _visible = 5;
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final groups = widget.groups;
    final total = groups.fold<int>(0, (sum, group) => sum + group.completedCount);
    final max = groups.fold<int>(1, (top, group) => group.completedCount > top ? group.completedCount : top);
    final shown = _expanded ? groups : groups.take(_visible).toList();
    return _Panel(
      title: widget.title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final group in shown)
            Tooltip(
              triggerMode: TooltipTriggerMode.tap,
              message: '${formatHours(group.hours)}'
                  '${group.averageRating == null ? '' : ' · nota média ${group.averageRating!.toStringAsFixed(1).replaceAll('.', ',')}'}',
              child: Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: [
                    SizedBox(
                      width: 96,
                      child: Text(group.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5)),
                    ),
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: group.completedCount / max,
                          minHeight: 8,
                          backgroundColor: const Color(0xFF2A2A3A),
                          valueColor: const AlwaysStoppedAnimation(Color(0xFF6C63FF)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      '${group.completedCount} · ${total > 0 ? (group.completedCount / total * 100).round() : 0}%',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ],
                ),
              ),
            ),
          if (groups.length > _visible)
            TextButton(
              onPressed: () => setState(() => _expanded = !_expanded),
              child: Text(_expanded ? 'Ver menos' : 'Ver mais (${groups.length - _visible})'),
            ),
        ],
      ),
    );
  }
}

/// Colunas por ano de lançamento, com rolagem horizontal quando há muitos anos.
class _ColumnChart extends StatelessWidget {
  final List<(String, int)> entries;

  const _ColumnChart({required this.entries});

  @override
  Widget build(BuildContext context) {
    final max = entries.fold<int>(1, (top, entry) => entry.$2 > top ? entry.$2 : top);
    return SizedBox(
      height: 150,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (final entry in entries)
            SizedBox(
              width: 44,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text('${entry.$2}', style: const TextStyle(fontSize: 11, color: Color(0xFFC9CED6))),
                  const SizedBox(height: 4),
                  Container(
                    width: 24,
                    height: ((entry.$2 / max) * 90).clamp(5.0, 90.0),
                    decoration: const BoxDecoration(
                      color: Color(0xFF6C63FF),
                      borderRadius: BorderRadius.vertical(top: Radius.circular(4)),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(entry.$1, style: const TextStyle(fontSize: 10.5, color: Color(0xFF8B949E))),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Prateleira horizontal de capas dos jogos favoritos, com a nota.
class _FavoriteShelf extends StatelessWidget {
  final List<StatsGameRef> favorites;
  final ValueChanged<String> onOpenGame;

  const _FavoriteShelf({required this.favorites, required this.onOpenGame});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 190,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: favorites.length,
        separatorBuilder: (_, _) => const SizedBox(width: 12),
        itemBuilder: (context, index) {
          final game = favorites[index];
          return InkWell(
            onTap: () => onOpenGame(game.id),
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 100,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Stack(
                    children: [
                      GameCover(coverUrl: game.coverUrl, width: 100, height: 134),
                      if (game.rating != null)
                        Positioned(
                          top: 6,
                          right: 6,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                            decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(999)),
                            child: Text('${game.rating}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(game.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)),
                ],
              ),
            ),
          );
        },
      ),
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
  /// Último ano com jogos zerados, oferecido quando o ano atual está vazio.
  final int? suggestedYear;

  const _ReplayPanel({this.suggestedYear});

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
              final empty = replay.sessionCount == 0 && replay.completedCount == 0 && replay.activeDays == 0;
              if (empty) {
                final suggested = widget.suggestedYear;
                return Row(
                  children: [
                    Expanded(
                      child: Text('Nada registrado em $_year.',
                          style: const TextStyle(color: Color(0xFF6B6B7E), fontSize: 13)),
                    ),
                    if (suggested != null && suggested != _year)
                      TextButton(onPressed: () => setState(() => _year = suggested), child: Text('Ver $suggested')),
                  ],
                );
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
    final achievementsByDate = {
      for (final day in activity.achievementDays) day.date: day.count,
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
                              final achievements = date == null ? 0 : (achievementsByDate[date] ?? 0);
                              return Padding(
                                padding: const EdgeInsets.only(bottom: gap),
                                child: Container(
                                  width: cell,
                                  height: cell,
                                  decoration: BoxDecoration(
                                    color: !inRange
                                        ? Colors.transparent
                                        : (minutes == 0 && achievements > 0
                                            ? const Color(0xFF3B2F5E)
                                            : levelColors[level(minutes)]),
                                    borderRadius: BorderRadius.circular(2),
                                    border: achievements > 0
                                        ? Border.all(color: const Color(0xFFA78BFA), width: 1.5)
                                        : null,
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
          if (achievementsByDate.isNotEmpty) ('Dias com conquistas', '${achievementsByDate.length}'),
        ]),
        const SizedBox(height: 8),
        Text(
          'Conta apenas sessões registradas; horas retroativas não têm data e ficam de fora.'
          '${achievementsByDate.isNotEmpty ? ' Os dias com borda roxa têm conquistas desbloqueadas (Achievist), que não contam como horas.' : ''}',
          style: const TextStyle(color: Color(0xFF6B6B7E), fontSize: 11, height: 1.4),
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
