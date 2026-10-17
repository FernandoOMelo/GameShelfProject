import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/planning_api.dart';
import '../models/challenge.dart';
import '../models/dashboard.dart';
import '../models/game.dart';
import '../models/game_list.dart';
import '../models/queue_item.dart';
import '../models/suggestion.dart';
import '../providers/active_session_provider.dart';
import '../providers/challenge_provider.dart';
import '../providers/dashboard_provider.dart';
import '../providers/lists_provider.dart';
import '../providers/queue_provider.dart';
import '../providers/suggestions_provider.dart';
import '../widgets/game_cover.dart';
import '../widgets/section.dart';
import 'end_session_sheet.dart';
import 'game_detail_screen.dart';
import 'goals_screen.dart';

/// Painel — paridade com o `DashboardView` da web.
///
/// Período selecionável (7 dias, mês, ano, personalizado ou todo o período),
/// KPIs do período com comparação com o período anterior, jogos em andamento,
/// sugestão do próximo jogo, metas, previsão do backlog e prévia da fila.
class ProgressScreen extends ConsumerStatefulWidget {
  const ProgressScreen({super.key});

  @override
  ConsumerState<ProgressScreen> createState() => _ProgressScreenState();
}

class _ProgressScreenState extends ConsumerState<ProgressScreen> {
  String _period = 'month';
  late String _customFrom = _monthStart();
  late String _customTo = _localDate(DateTime.now());

  ({String? from, String? to}) get _bounds {
    final now = DateTime.now();
    switch (_period) {
      case 'all':
        return (from: null, to: null);
      case 'custom':
        return (from: _customFrom, to: _customTo);
      case '7d':
        return (
          from: _localDate(now.subtract(const Duration(days: 6))),
          to: _localDate(now),
        );
      case 'year':
        return (from: '${now.year}-01-01', to: _localDate(now));
      default:
        return (from: _monthStart(), to: _localDate(now));
    }
  }

  @override
  Widget build(BuildContext context) {
    final bounds = _bounds;
    final previousBounds = _previousBounds(bounds.from, bounds.to);
    final dashboardAsync = ref.watch(dashboardRangeProvider(bounds));
    final previousStats = previousBounds == null
        ? null
        : ref.watch(dashboardRangeProvider(previousBounds)).valueOrNull?.periodStats;
    final queue = ref.watch(queueProvider).valueOrNull ?? const <QueueItem>[];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Painel'),
        actions: [
          IconButton(
            tooltip: 'Atualizar',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.invalidate(dashboardRangeProvider(bounds)),
          ),
        ],
      ),
      body: dashboardAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => MessageState(
          icon: Icons.cloud_off_rounded,
          message: 'Não foi possível carregar o painel',
          actionLabel: 'Tentar novamente',
          onAction: () => ref.invalidate(dashboardRangeProvider(bounds)),
        ),
        data: (dashboard) => RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(dashboardRangeProvider(bounds));
            ref.invalidate(queueProvider);
          },
          child: _DashboardBody(
            dashboard: dashboard,
            previousStats: previousStats,
            queue: queue,
            period: _period,
            customFrom: _customFrom,
            customTo: _customTo,
            onPeriodChange: (value) => setState(() => _period = value),
            onPickCustomRange: _pickCustomRange,
          ),
        ),
      ),
    );
  }

  Future<void> _pickCustomRange() async {
    final now = DateTime.now();
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2000),
      lastDate: now,
      initialDateRange: DateTimeRange(
        start: DateTime.parse(_customFrom),
        end: DateTime.parse(_customTo),
      ),
    );
    if (picked == null) return;
    setState(() {
      _period = 'custom';
      _customFrom = _localDate(picked.start);
      _customTo = _localDate(picked.end);
    });
  }

  static ({String? from, String? to})? _previousBounds(String? from, String? to) {
    if (from == null || to == null) return null;
    final start = DateTime.tryParse(from);
    final end = DateTime.tryParse(to);
    if (start == null || end == null || end.isBefore(start)) return null;
    final days = end.difference(start).inDays + 1;
    final previousEnd = start.subtract(const Duration(days: 1));
    final previousStart = previousEnd.subtract(Duration(days: days - 1));
    return (from: _localDate(previousStart), to: _localDate(previousEnd));
  }

  static String _monthStart() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-01';
  }

  static String _localDate(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';
}

class _DashboardBody extends ConsumerWidget {
  final Dashboard dashboard;
  final DashboardPeriodStats? previousStats;
  final List<QueueItem> queue;
  final String period;
  final String customFrom;
  final String customTo;
  final ValueChanged<String> onPeriodChange;
  final VoidCallback onPickCustomRange;

  const _DashboardBody({
    required this.dashboard,
    required this.previousStats,
    required this.queue,
    required this.period,
    required this.customFrom,
    required this.customTo,
    required this.onPeriodChange,
    required this.onPickCustomRange,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final periodStats = dashboard.periodStats ??
        const DashboardPeriodStats(playedHours: 0, sessions: 0, gamesPlayed: 0, gamesCompleted: 0);
    final playing = dashboard.playingGames.isNotEmpty
        ? dashboard.playingGames
        : [
            if (dashboard.currentGame != null) dashboard.currentGame!,
          ];

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        _PeriodSelector(
          period: period,
          customFrom: customFrom,
          customTo: customTo,
          onChanged: onPeriodChange,
          onPickCustomRange: onPickCustomRange,
        ),
        const SizedBox(height: 16),
        _KpiGrid(cards: [
          _KpiCard(
            label: 'Horas jogadas no período',
            value: formatHours(periodStats.playedHours),
            delta: _delta(periodStats.playedHours, previousStats?.playedHours),
            accent: true,
          ),
          _KpiCard(
            label: 'Sessões no período',
            value: '${periodStats.sessions}',
            delta: _delta(periodStats.sessions.toDouble(), previousStats?.sessions.toDouble()),
          ),
          _KpiCard(
            label: 'Jogos jogados no período',
            value: '${periodStats.gamesPlayed}',
            delta: _delta(periodStats.gamesPlayed.toDouble(), previousStats?.gamesPlayed.toDouble()),
          ),
          _KpiCard(
            label: 'Jogos zerados no período',
            value: '${periodStats.gamesCompleted}',
            delta: _delta(periodStats.gamesCompleted.toDouble(), previousStats?.gamesCompleted.toDouble()),
          ),
        ]),
        const SizedBox(height: 12),
        _KpiGrid(cards: [
          _KpiCard(label: 'Tempo jogado · todo período', value: formatHours(dashboard.totalPlayedHours)),
          _KpiCard(label: 'Horas restantes no backlog', value: formatHours(dashboard.backlogRemainingHours)),
          _KpiCard(label: 'Horas disponíveis por semana', value: formatHours(dashboard.weeklyHours)),
          _KpiCard(label: 'Em andamento', value: '${dashboard.playingCount}'),
        ]),
        const SizedBox(height: 20),
        const SectionTitle('Jogando agora'),
        if (playing.isEmpty)
          const Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: Text('Nenhum jogo marcado como em andamento.',
                style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13)),
          )
        else
          for (final entry in playing) _PlayingNowCard(entry: entry),
        const SizedBox(height: 20),
        const _NextGameCard(),
        const SizedBox(height: 20),
        const _GoalsEntry(),
        const SizedBox(height: 20),
        const _ChallengeCard(),
        const SizedBox(height: 20),
        _ForecastPanel(dashboard: dashboard),
        const SizedBox(height: 20),
        _QueuePreview(queue: queue, dashboard: dashboard),
        const SizedBox(height: 20),
        _WeeklyGoalCard(initialMinutes: (dashboard.weeklyHours * 60).round()),
        const SizedBox(height: 20),
        _CompletedByYear(dashboard: dashboard),
      ],
    );
  }

  static String? _delta(double current, double? previous) {
    if (previous == null || previous <= 0) return null;
    final percent = (((current - previous) / previous) * 100).round();
    if (percent == 0) return 'igual ao período anterior';
    return '${percent > 0 ? '▲' : '▼'} ${percent.abs()}% vs. período anterior';
  }
}

class _PeriodSelector extends StatelessWidget {
  final String period;
  final String customFrom;
  final String customTo;
  final ValueChanged<String> onChanged;
  final VoidCallback onPickCustomRange;

  const _PeriodSelector({
    required this.period,
    required this.customFrom,
    required this.customTo,
    required this.onChanged,
    required this.onPickCustomRange,
  });

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        _chip('7d', 'Últimos 7 dias'),
        _chip('month', 'Mês atual'),
        _chip('year', 'Ano atual'),
        _chip('all', 'Todo o período'),
        ChoiceChip(
          label: Text(period == 'custom' ? '$customFrom → $customTo' : 'Personalizado'),
          selected: period == 'custom',
          onSelected: (_) => onPickCustomRange(),
        ),
      ],
    );
  }

  Widget _chip(String value, String label) {
    return ChoiceChip(
      label: Text(label),
      selected: period == value,
      onSelected: (_) => onChanged(value),
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final String? delta;
  final bool accent;

  const _KpiCard({
    required this.label,
    required this.value,
    this.delta,
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
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
          if (delta != null) ...[
            const SizedBox(height: 4),
            Text(delta!,
                style: const TextStyle(color: Color(0xFF48BB78), fontSize: 11)),
          ],
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

class _PlayingNowCard extends ConsumerWidget {
  final PlayingGame entry;

  const _PlayingNowCard({required this.entry});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final game = entry.game;
    final percent = entry.progress ??
        (entry.estimatedHours != null && entry.estimatedHours! > 0
            ? ((entry.playedHours / entry.estimatedHours!) * 100).round().clamp(0, 100)
            : null);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => GameDetailScreen(game: game)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GameCover(coverUrl: game.coverUrl, width: 56, height: 72),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(game.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                    const SizedBox(height: 4),
                    Text(
                      '${entry.playedHours.toStringAsFixed(1)} h jogadas'
                      '${entry.progress == null ? '' : ' · ${entry.progress}%'}',
                      style: const TextStyle(color: Color(0xFF8888A0), fontSize: 13),
                    ),
                    if (percent != null) ...[
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: percent / 100,
                          minHeight: 6,
                          backgroundColor: const Color(0xFF2A2A3A),
                          valueColor: const AlwaysStoppedAnimation(Color(0xFF6C63FF)),
                        ),
                      ),
                    ],
                    if (entry.remainingHours != null) ...[
                      const SizedBox(height: 6),
                      Text('~${entry.remainingHours!.toStringAsFixed(0)} h restantes',
                          style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (entry.activeSession != null)
                IconButton.filled(
                  onPressed: () => showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: const Color(0xFF1E1E2A),
                    shape: const RoundedRectangleBorder(
                      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                    ),
                    builder: (_) => const EndSessionSheet(),
                  ),
                  icon: const Icon(Icons.stop_rounded),
                  style: IconButton.styleFrom(backgroundColor: const Color(0xFFE53E3E)),
                )
              else
                _StartButton(game: game),
            ],
          ),
        ),
      ),
    );
  }
}

class _StartButton extends ConsumerWidget {
  final Game game;

  const _StartButton({required this.game});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(activeSessionProvider);
    return IconButton.filled(
      onPressed: state.hasActive || state.loading
          ? null
          : () => ref.read(activeSessionProvider.notifier).start(game),
      icon: const Icon(Icons.play_arrow_rounded),
      style: IconButton.styleFrom(backgroundColor: const Color(0xFF6C63FF)),
    );
  }
}

/// Sugestão do próximo jogo, carregada sob demanda como na web.
class _NextGameCard extends ConsumerStatefulWidget {
  const _NextGameCard();

  @override
  ConsumerState<_NextGameCard> createState() => _NextGameCardState();
}

class _NextGameCardState extends ConsumerState<_NextGameCard> {
  List<Suggestion>? _suggestions;
  int _index = 0;
  bool _loading = false;
  bool _failed = false;

  Future<void> _choose() async {
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final list = await ref.refresh(suggestionsProvider.future);
      if (!mounted) return;
      setState(() {
        _suggestions = list;
        _index = 0;
      });
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final current = (_suggestions != null && _suggestions!.isNotEmpty)
        ? _suggestions![_index]
        : null;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2A),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('Próximo jogo',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
              TextButton(
                onPressed: _loading ? null : _choose,
                child: Text(_suggestions == null ? 'Me ajuda a escolher' : 'Sugerir de novo'),
              ),
            ],
          ),
          if (_failed)
            const Text('Não foi possível buscar uma sugestão.',
                style: TextStyle(color: Color(0xFFE53E3E), fontSize: 13)),
          if (current != null) ...[
            InkWell(
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => GameDetailScreen(game: current.game)),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Text(current.game.title,
                    style: const TextStyle(
                        color: Color(0xFF6C63FF), fontSize: 16, fontWeight: FontWeight.w700)),
              ),
            ),
            for (final reason in current.reasons)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('• ', style: TextStyle(color: Color(0xFF6B6B7E))),
                    Expanded(
                      child: Text(reason,
                          style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 12)),
                    ),
                  ],
                ),
              ),
            if (_suggestions!.length > 1)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: TextButton(
                  onPressed: _index >= _suggestions!.length - 1
                      ? null
                      : () => setState(() => _index++),
                  child: Text('Outra opção (${_index + 1}/${_suggestions!.length})'),
                ),
              ),
          ] else if (_suggestions != null && !_failed)
            const Text('Nenhum jogo disponível: adicione jogos possuídos ao backlog.',
                style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13)),
        ],
      ),
    );
  }
}

class _GoalsEntry extends StatelessWidget {
  const _GoalsEntry();

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF1E1E2A),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const GoalsScreen()),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const Icon(Icons.flag_rounded, color: Color(0xFF6C63FF)),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Metas', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                    SizedBox(height: 2),
                    Text('Acompanhe metas de jogos zerados e horas jogadas',
                        style: TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: Color(0xFF6B6B7E)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Missão principal (`/challenge`): uma lista acompanhada como objetivo.
class _ChallengeCard extends ConsumerStatefulWidget {
  const _ChallengeCard();

  @override
  ConsumerState<_ChallengeCard> createState() => _ChallengeCardState();
}

class _ChallengeCardState extends ConsumerState<_ChallengeCard> {
  bool _busy = false;

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _edit(MainChallenge? challenge) async {
    final List<GameListSummary> lists;
    try {
      lists = await ref.read(listsProvider.future);
    } catch (_) {
      _snack('Não foi possível carregar as listas.');
      return;
    }
    if (!mounted) return;
    if (lists.isEmpty) {
      _snack('Crie uma lista na aba Mais para acompanhá-la como missão.');
      return;
    }

    final titleController = TextEditingController(text: challenge?.title ?? '');
    var listId = challenge?.listId ?? lists.first.id;
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(challenge == null ? 'Definir missão' : 'Editar missão'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleController,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Objetivo'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: listId,
                decoration: const InputDecoration(labelText: 'Lista acompanhada'),
                items: [
                  for (final list in lists)
                    DropdownMenuItem(
                      value: list.id,
                      child: Text('${list.name} (${list.gameCount})'),
                    ),
                ],
                onChanged: (value) {
                  if (value != null) setDialogState(() => listId = value);
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancelar'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Salvar'),
            ),
          ],
        ),
      ),
    );
    final title = titleController.text.trim();
    titleController.dispose();
    if (saved != true) return;

    if (title.isEmpty) {
      _snack('Informe o objetivo da missão.');
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(challengeProvider.notifier).save(title: title, listId: listId);
    } catch (_) {
      _snack('Não foi possível salvar a missão.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _clear() async {
    setState(() => _busy = true);
    try {
      await ref.read(challengeProvider.notifier).clear();
    } catch (_) {
      _snack('Não foi possível remover a missão.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(challengeProvider);
    final challenge = async.valueOrNull;
    final loading = async.isLoading && !async.hasValue;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2A),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('Missão principal',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              ),
              if (challenge != null)
                IconButton(
                  tooltip: 'Remover missão',
                  onPressed: _busy ? null : _clear,
                  icon: const Icon(Icons.delete_outline_rounded),
                ),
              TextButton(
                onPressed: _busy ? null : () => _edit(challenge),
                child: Text(challenge == null ? 'Definir missão' : 'Editar missão'),
              ),
            ],
          ),
          const SizedBox(height: 6),
          if (loading)
            const Text('Carregando…',
                style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13))
          else if (challenge == null)
            const Text('Defina um objetivo de longo prazo acompanhando uma lista.',
                style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13))
          else ...[
            Text(challenge.title,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: (challenge.percent / 100).clamp(0, 1),
                minHeight: 8,
                backgroundColor: const Color(0xFF2A2A3A),
                valueColor: const AlwaysStoppedAnimation(Color(0xFF6C63FF)),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              '${challenge.completedGames} / ${challenge.totalGames} zerados '
              '(${challenge.percent.toStringAsFixed(0)}%) · ${challenge.listName}',
              style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}

/// Meta semanal (`/planning/settings`), usada na previsão do backlog.
class _WeeklyGoalCard extends ConsumerStatefulWidget {
  final int initialMinutes;

  const _WeeklyGoalCard({required this.initialMinutes});

  @override
  ConsumerState<_WeeklyGoalCard> createState() => _WeeklyGoalCardState();
}

class _WeeklyGoalCardState extends ConsumerState<_WeeklyGoalCard> {
  late final TextEditingController _controller =
      TextEditingController(text: '${widget.initialMinutes}');
  bool _saving = false;
  String? _feedback;

  @override
  void didUpdateWidget(_WeeklyGoalCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_saving && oldWidget.initialMinutes != widget.initialMinutes) {
      _controller.text = '${widget.initialMinutes}';
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final minutes = int.tryParse(_controller.text.trim());
    if (minutes == null || minutes < 0 || minutes > 10080) {
      setState(() => _feedback = 'Informe entre 0 e 10080 minutos por semana.');
      return;
    }
    setState(() {
      _saving = true;
      _feedback = null;
    });
    try {
      await PlanningApi.setWeeklyMinutes(minutes);
      ref.invalidate(dashboardRangeProvider);
      if (mounted) setState(() => _feedback = 'Meta semanal salva.');
    } catch (_) {
      if (mounted) setState(() => _feedback = 'Não foi possível salvar a meta semanal.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

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
          const Text('Meta semanal',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          const Text('Quanto tempo você tem por semana para jogar.',
              style: TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Minutos por semana',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              FilledButton(
                onPressed: _saving ? null : _save,
                child: const Text('Salvar'),
              ),
            ],
          ),
          if (_feedback != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_feedback!,
                  style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
            ),
        ],
      ),
    );
  }
}

class _ForecastPanel extends StatelessWidget {
  final Dashboard dashboard;

  const _ForecastPanel({required this.dashboard});

  @override
  Widget build(BuildContext context) {
    final forecast = dashboard.backlogForecast;
    if (forecast == null) return const SizedBox.shrink();
    final months = forecast.estimatedMonths;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2A),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Previsão do backlog',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          if (months == null)
            const Text('Defina a meta semanal para ver quando o backlog acaba.',
                style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13))
          else
            Text(
              'No seu ritmo, as ${formatHours(dashboard.backlogRemainingHours)} restantes '
              'levam cerca de ${months.toStringAsFixed(0)} '
              '${months == 1 ? 'mês' : 'meses'} '
              '(${forecast.estimatedWeeks?.toStringAsFixed(0) ?? '—'} semanas).',
              style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 13, height: 1.4),
            ),
          if (forecast.gamesWithoutEstimate > 0)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                '${forecast.gamesWithoutEstimate} '
                '${forecast.gamesWithoutEstimate == 1 ? 'jogo sem estimativa não entra' : 'jogos sem estimativa não entram'} na conta.',
                style: const TextStyle(color: Color(0xFF6B6B7E), fontSize: 11),
              ),
            ),
          const SizedBox(height: 12),
          const SectionTitle('Parados há mais tempo'),
          if (forecast.stalledGames.isEmpty)
            const Text('Nenhum jogo em andamento ou pausado parado há 30 dias ou mais.',
                style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13))
          else
            for (final stalled in forecast.stalledGames)
              InkWell(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => GameDetailScreen(game: stalled.game)),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(stalled.game.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 13)),
                      ),
                      Text(
                        '${stalled.daysStalled} dias'
                        '${stalled.remainingHours == null ? '' : ' · faltam ${formatHours(stalled.remainingHours)}'}',
                        style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }
}

class _QueuePreview extends StatelessWidget {
  final List<QueueItem> queue;
  final Dashboard dashboard;

  const _QueuePreview({required this.queue, required this.dashboard});

  @override
  Widget build(BuildContext context) {
    final preview = queue.take(3).toList();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2A),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Próximos da fila',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          if (preview.isEmpty)
            const Text('Sua fila está vazia.',
                style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13))
          else
            for (var i = 0; i < preview.length; i++)
              InkWell(
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => GameDetailScreen(game: preview[i].game)),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Text('${i + 1}. ${preview[i].game.title}',
                      style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 13)),
                ),
              ),
          const SizedBox(height: 8),
          Text(
            '${formatHours(dashboard.queueRemainingHours)} estimadas na fila'
            '${dashboard.estimatedQueueWeeks == null ? '' : ' · cerca de ${dashboard.estimatedQueueWeeks!.toStringAsFixed(0)} semanas'}',
            style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _CompletedByYear extends StatelessWidget {
  final Dashboard dashboard;

  const _CompletedByYear({required this.dashboard});

  @override
  Widget build(BuildContext context) {
    final byYear = [...dashboard.completionByYear]
      ..sort((a, b) => a.year.compareTo(b.year));
    final recent = byYear.length > 10 ? byYear.sublist(byYear.length - 10) : byYear;
    if (recent.isEmpty) return const SizedBox.shrink();
    final maxCount = recent.fold<int>(1, (top, entry) => entry.gameCount > top ? entry.gameCount : top);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2A),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Zerados por ano',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          SizedBox(
            height: 120,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                for (final entry in recent)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          Text('${entry.gameCount}',
                              style: const TextStyle(color: Color(0xFF8888A0), fontSize: 10)),
                          const SizedBox(height: 4),
                          Container(
                            height: (entry.gameCount / maxCount) * 70 + 4,
                            decoration: BoxDecoration(
                              color: const Color(0xFF6C63FF),
                              borderRadius: BorderRadius.circular(4),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text('${entry.year}',
                              style: const TextStyle(color: Color(0xFF6B6B7E), fontSize: 10)),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
