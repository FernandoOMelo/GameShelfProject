import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/game_extras_api.dart';
import '../../core/platforms_api.dart';
import '../../models/catalog.dart';
import '../../models/game_extras.dart';
import '../../providers/catalog_provider.dart';
import '../../providers/game_extras_provider.dart';
import '../../widgets/platform_logo.dart';
import '../../widgets/section.dart';

const _card = Color(0xFF1E1E2A);
const _muted = Color(0xFF8888A0);
const _danger = Color(0xFFE53E3E);

/// "2024-01-10" -> "10/01/2024".
String formatCalendarDate(String value) {
  final parts = value.split('-');
  return parts.length == 3 ? '${parts[2]}/${parts[1]}/${parts[0]}' : value;
}

String _isoDate(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

/// Plataformas associadas e jornadas do jogo, como o cartão "Plataformas e
/// jornadas" da web. Tempo local e tempo informado pela plataforma ficam
/// separados e nunca são somados. As datas de início e de zerado sugeridas pelas
/// conquistas do Achievist só são gravadas com o toque do usuário.
class GameJourneyPanel extends ConsumerWidget {
  final String gameId;
  final String gameStatus;
  final String? gameStartedAt;
  final String? gameCompletedAt;

  /// Grava uma data no jogo (`startedAt` ou `completedAt`).
  final Future<void> Function(String field, String value) onApplyDate;

  /// Avisa que o jogo mudou (por exemplo, horas retroativas lançadas).
  final VoidCallback onGameChanged;

  const GameJourneyPanel({
    super.key,
    required this.gameId,
    required this.gameStatus,
    required this.gameStartedAt,
    required this.gameCompletedAt,
    required this.onApplyDate,
    required this.onGameChanged,
  });

  void _toast(BuildContext context, String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  void _reload(WidgetRef ref) {
    ref.invalidate(gamePlatformsProvider(gameId));
    ref.invalidate(playthroughsProvider(gameId));
    ref.invalidate(playthroughMetricsProvider(gameId));
  }

  Future<void> _run(BuildContext context, WidgetRef ref, Future<void> Function() action, String fallback) async {
    try {
      await action();
      _reload(ref);
    } catch (error) {
      if (context.mounted) _toast(context, PlatformsApi.errorMessage(error, fallback));
    }
  }

  Future<bool> _confirm(BuildContext context, String title, String message, String action) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(action, style: const TextStyle(color: _danger)),
          ),
        ],
      ),
    );
    return result == true;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final links = ref.watch(gamePlatformsProvider(gameId));
    final playthroughs = ref.watch(playthroughsProvider(gameId));
    final metrics = ref.watch(playthroughMetricsProvider(gameId)).valueOrNull ?? const PlaythroughMetrics();
    final catalog = ref.watch(platformsProvider).valueOrNull ?? const <CatalogItem>[];
    CatalogItem? platformOf(String? id) => catalog.where((item) => item.id == id).firstOrNull;

    final linkList = links.valueOrNull ?? const <GamePlatform>[];
    final nextLabel = (playthroughs.valueOrNull?.isEmpty ?? true) ? 'Iniciar jornada' : 'Iniciar replay';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SuggestedDates(
          links: linkList,
          status: gameStatus,
          startedAt: gameStartedAt,
          completedAt: gameCompletedAt,
          onApply: (field, value) async {
            await onApplyDate(field, value);
            _reload(ref);
          },
        ),
        SectionTitle(
          'Plataformas',
          trailing: TextButton.icon(
            onPressed: catalog.isEmpty
                ? null
                : () async {
                    final added = await showModalBottomSheet<bool>(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: _card,
                      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
                      builder: (_) => _AddPlatformSheet(gameId: gameId, catalog: catalog),
                    );
                    if (added == true) _reload(ref);
                  },
            icon: const Icon(Icons.add_rounded, size: 18),
            label: const Text('Adicionar'),
          ),
        ),
        links.when(
          loading: () => const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator())),
          error: (_, _) => const Text('Não foi possível carregar as plataformas.', style: TextStyle(color: _muted)),
          data: (items) => items.isEmpty
              ? const _EmptyBox('Nenhuma plataforma associada.')
              : Column(
                  children: [
                    for (final link in items)
                      _PlatformLinkCard(
                        link: link,
                        platform: platformOf(link.platformId),
                        onToggleOwned: () => _run(
                            context, ref, () => GameExtrasApi.updatePlatform(gameId, link.id, {'owned': !link.owned}),
                            'Não foi possível salvar.'),
                        onToggleCounts: () => _run(
                            context,
                            ref,
                            () => GameExtrasApi.updatePlatform(gameId, link.id, {'countsTowardTotal': !link.countsTowardTotal}),
                            'Não foi possível salvar.'),
                        onMakePrimary: () => _run(context, ref,
                            () => GameExtrasApi.updatePlatform(gameId, link.id, {'isPrimary': true}), 'Não foi possível salvar.'),
                        onImport: () => _run(context, ref, () async {
                          await GameExtrasApi.importPlaytime(gameId, link.id);
                          onGameChanged();
                        }, 'Não foi possível lançar as horas.'),
                        onRemove: () async {
                          final name = platformOf(link.platformId)?.name ?? 'esta plataforma';
                          if (await _confirm(context, 'Desassociar plataforma', 'Remover $name deste jogo?', 'Remover') &&
                              context.mounted) {
                            await _run(context, ref, () => GameExtrasApi.removePlatform(gameId, link.id),
                                'Não foi possível desassociar.');
                          }
                        },
                      ),
                  ],
                ),
        ),
        const SizedBox(height: 20),
        SectionTitle(
          'Jornadas',
          trailing: FilledButton(
            onPressed: () async {
              final created = await showModalBottomSheet<bool>(
                context: context,
                isScrollControlled: true,
                backgroundColor: _card,
                shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
                builder: (_) => _PlaythroughSheet(gameId: gameId, catalog: catalog),
              );
              if (created == true) _reload(ref);
            },
            child: Text(nextLabel),
          ),
        ),
        Row(
          children: [
            Expanded(child: _Metric(label: 'Iniciadas', value: '${metrics.started}')),
            const SizedBox(width: 8),
            Expanded(child: _Metric(label: 'Concluídas', value: '${metrics.completed}')),
            const SizedBox(width: 8),
            Expanded(child: _Metric(label: 'Replays', value: '${metrics.replaysStarted}')),
          ],
        ),
        const SizedBox(height: 12),
        playthroughs.when(
          loading: () => const SizedBox.shrink(),
          error: (_, _) => const Text('Não foi possível carregar as jornadas.', style: TextStyle(color: _muted)),
          data: (items) => items.isEmpty
              ? const _EmptyBox('Nenhuma jornada registrada. O histórico de sessões continua valendo mesmo sem jornada.')
              : Column(
                  children: [
                    for (final playthrough in items.reversed)
                      _PlaythroughCard(
                        playthrough: playthrough,
                        platformName: platformOf(playthrough.primaryPlatformId)?.name,
                        onTransition: (status, needsDate) => _run(context, ref, () {
                          final today = _isoDate(DateTime.now());
                          return GameExtrasApi.updatePlaythrough(gameId, playthrough.id, {
                            'status': status,
                            if (needsDate) 'completedAt': playthrough.completedAt ?? today,
                            if (status == 'PLAYING' && playthrough.status == 'PLANNED' && playthrough.startedAt == null)
                              'startedAt': today,
                          });
                        }, 'Não foi possível atualizar a jornada.'),
                        onDelete: () async {
                          if (await _confirm(context, 'Excluir jornada', 'Excluir esta jornada? Esta ação não pode ser desfeita.',
                                  'Excluir') &&
                              context.mounted) {
                            await _run(context, ref, () => GameExtrasApi.removePlaythrough(gameId, playthrough.id),
                                'Não foi possível excluir a jornada.');
                          }
                        },
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

class _EmptyBox extends StatelessWidget {
  final String text;

  const _EmptyBox(this.text);

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF2A2A3A)),
      ),
      child: Text(text, textAlign: TextAlign.center, style: const TextStyle(color: _muted, fontSize: 12)),
    );
  }
}

class _Metric extends StatelessWidget {
  final String label;
  final String value;

  const _Metric({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: _muted, fontSize: 11)),
          const SizedBox(height: 4),
          Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

/// Datas sugeridas pelas conquistas do Achievist; só oferece o que está vazio.
class _SuggestedDates extends StatelessWidget {
  final List<GamePlatform> links;
  final String status;
  final String? startedAt;
  final String? completedAt;
  final Future<void> Function(String field, String value) onApply;

  const _SuggestedDates({
    required this.links,
    required this.status,
    required this.startedAt,
    required this.completedAt,
    required this.onApply,
  });

  @override
  Widget build(BuildContext context) {
    final starts = links.map((link) => link.externalActivityStartedAt).whereType<DateTime>().toList()..sort();
    final ends = links.map((link) => link.externalActivityEndedAt).whereType<DateTime>().toList()..sort();
    final start = starts.firstOrNull == null ? null : _isoDate(starts.first);
    final end = ends.lastOrNull == null ? null : _isoDate(ends.last);
    final days = links.fold<int>(0, (total, link) => total + link.externalActivityDays);
    final canStart = startedAt == null && start != null;
    final canEnd = status == 'COMPLETED' && completedAt == null && end != null;
    if (!canStart && !canEnd) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.only(bottom: 18),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF6C63FF).withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF6C63FF).withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Datas sugeridas pelo Achievist',
              style: TextStyle(color: Color(0xFF9FC0FF), fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 4),
          Text(
            'Suas conquistas neste jogo vão de ${formatCalendarDate(start ?? end!)} a ${formatCalendarDate(end ?? start!)}'
            '${days > 0 ? ', em $days ${days == 1 ? 'dia' : 'dias'}' : ''}. '
            'É uma sugestão: nada é gravado sem o seu toque.',
            style: const TextStyle(color: _muted, fontSize: 12),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (canStart)
                OutlinedButton(
                  onPressed: () => onApply('startedAt', start),
                  child: Text('Usar ${formatCalendarDate(start)} como início'),
                ),
              if (canEnd)
                OutlinedButton(
                  onPressed: () => onApply('completedAt', end),
                  child: Text('Usar ${formatCalendarDate(end)} como data de zerado'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String label;
  final Color? color;

  const _Chip(this.label, {this.color});

  @override
  Widget build(BuildContext context) {
    final tint = color ?? _muted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: tint.withValues(alpha: 0.5)),
      ),
      child: Text(label, style: TextStyle(color: tint, fontSize: 11)),
    );
  }
}

class _PlatformLinkCard extends StatelessWidget {
  final GamePlatform link;
  final CatalogItem? platform;
  final VoidCallback onToggleOwned;
  final VoidCallback onToggleCounts;
  final VoidCallback onMakePrimary;
  final VoidCallback onImport;
  final VoidCallback onRemove;

  const _PlatformLinkCard({
    required this.link,
    required this.platform,
    required this.onToggleOwned,
    required this.onToggleCounts,
    required this.onMakePrimary,
    required this.onImport,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final hasExternal = link.externalPlaytimeMinutes != null;
    final name = platform?.name ?? 'Plataforma removida';
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.fromLTRB(14, 14, 6, 8),
      decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(14)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              PlatformLogo(iconKey: platform?.iconKey, color: platform?.color, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        if (link.isPrimary) const _Chip('Principal', color: Color(0xFF7FB0FF)),
                        _Chip(link.owned ? 'Possuo' : 'Não possuo', color: link.owned ? const Color(0xFF7FD3A0) : null),
                        if (link.edition != null) _Chip(link.edition!),
                        if (link.format != null) _Chip(gamePlatformFormatLabels[link.format] ?? link.format!),
                      ],
                    ),
                  ],
                ),
              ),
              if (hasExternal && (link.externalPlaytimeMinutes ?? 0) > 0)
                Padding(
                  padding: const EdgeInsets.only(right: 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(formatMinutes(link.externalPlaytimeMinutes),
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                      Text('na plataforma${link.externalSource != null ? ' · via ${link.externalSource}' : ''}',
                          style: const TextStyle(color: _muted, fontSize: 10)),
                    ],
                  ),
                ),
              PopupMenuButton<String>(
                tooltip: 'Mais ações de $name',
                onSelected: (value) => switch (value) {
                  'primary' => onMakePrimary(),
                  'import' => onImport(),
                  _ => onRemove(),
                },
                itemBuilder: (_) => [
                  if (!link.isPrimary) const PopupMenuItem(value: 'primary', child: Text('Tornar principal')),
                  if (link.canImportPlaytime)
                    const PopupMenuItem(value: 'import', child: Text('Lançar como horas retroativas')),
                  const PopupMenuItem(value: 'remove', child: Text('Desassociar', style: TextStyle(color: _danger))),
                ],
              ),
            ],
          ),
          const Divider(height: 18),
          Row(
            children: [
              const Text('Possuo', style: TextStyle(fontSize: 12)),
              const SizedBox(width: 6),
              Switch(value: link.owned, onChanged: (_) => onToggleOwned()),
              if (hasExternal) ...[
                const SizedBox(width: 10),
                const Text('Contar no total', style: TextStyle(fontSize: 12)),
                const SizedBox(width: 6),
                Switch(value: link.countsTowardTotal, onChanged: (_) => onToggleCounts()),
              ],
            ],
          ),
          if (link.externalPlaytimeImportedMinutes > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text('${formatMinutes(link.externalPlaytimeImportedMinutes)} já lançadas como retroativas',
                  style: const TextStyle(color: Color(0xFF737771), fontSize: 10)),
            ),
        ],
      ),
    );
  }
}

class _PlaythroughCard extends StatelessWidget {
  final Playthrough playthrough;
  final String? platformName;
  final void Function(String status, bool needsDate) onTransition;
  final VoidCallback onDelete;

  const _PlaythroughCard({
    required this.playthrough,
    required this.platformName,
    required this.onTransition,
    required this.onDelete,
  });

  Color get _statusColor => switch (playthrough.status) {
        'PLAYING' => const Color(0xFF7FB0FF),
        'COMPLETED' => const Color(0xFF5FD18D),
        'ABANDONED' => const Color(0xFFF08A7E),
        _ => _muted,
      };

  @override
  Widget build(BuildContext context) {
    final meta = [
      playthrough.startedAt == null ? 'Início não informado' : 'Início: ${formatCalendarDate(playthrough.startedAt!)}',
      if (playthrough.completedAt != null) 'Encerramento: ${formatCalendarDate(playthrough.completedAt!)}',
      if (platformName != null) 'Plataforma: $platformName',
    ].join(' · ');
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(14)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(playthrough.title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              _Chip(playthroughStatusLabels[playthrough.status] ?? playthrough.status, color: _statusColor),
              if (playthrough.isReplay) const _Chip('Replay'),
            ],
          ),
          const SizedBox(height: 6),
          Text(meta, style: const TextStyle(color: _muted, fontSize: 12)),
          if (playthrough.notes != null && playthrough.notes!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(playthrough.notes!, style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 12)),
          ],
          const SizedBox(height: 8),
          Wrap(
            spacing: 4,
            children: [
              for (final transition in playthroughTransitions[playthrough.status] ?? const [])
                TextButton(onPressed: () => onTransition(transition.$1, transition.$3), child: Text(transition.$2)),
              TextButton(
                onPressed: onDelete,
                child: const Text('Excluir jornada', style: TextStyle(color: _danger)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AddPlatformSheet extends StatefulWidget {
  final String gameId;
  final List<CatalogItem> catalog;

  const _AddPlatformSheet({required this.gameId, required this.catalog});

  @override
  State<_AddPlatformSheet> createState() => _AddPlatformSheetState();
}

class _AddPlatformSheetState extends State<_AddPlatformSheet> {
  final _edition = TextEditingController();
  String? _platformId;
  String? _format;
  bool _owned = true;
  bool _primary = false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _edition.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_platformId == null) {
      setState(() => _error = 'Selecione uma plataforma.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final edition = _edition.text.trim();
      await GameExtrasApi.addPlatform(widget.gameId, {
        'platformId': _platformId,
        'edition': edition.isEmpty ? null : edition,
        'format': _format,
        'owned': _owned,
        'isPrimary': _primary,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = PlatformsApi.errorMessage(error, 'Não foi possível associar a plataforma.');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final sorted = [...widget.catalog]..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Associar plataforma', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                initialValue: _platformId,
                decoration: const InputDecoration(labelText: 'Plataforma'),
                items: [for (final item in sorted) DropdownMenuItem(value: item.id, child: Text(item.name))],
                onChanged: (value) => setState(() => _platformId = value),
              ),
              const SizedBox(height: 12),
              TextField(controller: _edition, maxLength: 120, decoration: const InputDecoration(labelText: 'Edição', counterText: '')),
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                initialValue: _format,
                decoration: const InputDecoration(labelText: 'Formato'),
                items: [
                  const DropdownMenuItem<String?>(value: null, child: Text('Não informado')),
                  for (final entry in gamePlatformFormatLabels.entries)
                    DropdownMenuItem<String?>(value: entry.key, child: Text(entry.value)),
                ],
                onChanged: (value) => setState(() => _format = value),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Possuo nesta plataforma'),
                value: _owned,
                onChanged: (value) => setState(() => _owned = value),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Plataforma principal'),
                value: _primary,
                onChanged: (value) => setState(() => _primary = value),
              ),
              if (_error != null) Text(_error!, style: const TextStyle(color: Color(0xFFF08A7E), fontSize: 13)),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _saving ? null : () => Navigator.pop(context, false),
                      child: const Text('Cancelar'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(onPressed: _saving ? null : _save, child: const Text('Associar')),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Nova jornada. Com data de encerramento ela nasce finalizada, o que permite
/// lançar jornadas antigas (retroativas).
class _PlaythroughSheet extends StatefulWidget {
  final String gameId;
  final List<CatalogItem> catalog;

  const _PlaythroughSheet({required this.gameId, required this.catalog});

  @override
  State<_PlaythroughSheet> createState() => _PlaythroughSheetState();
}

class _PlaythroughSheetState extends State<_PlaythroughSheet> {
  final _label = TextEditingController();
  String? _platformId;
  DateTime? _start = DateTime.now();
  DateTime? _end;
  String _result = 'COMPLETED';
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _label.dispose();
    super.dispose();
  }

  Future<DateTime?> _pick(DateTime? initial) => showDatePicker(
        context: context,
        initialDate: initial ?? DateTime.now(),
        firstDate: DateTime(1980),
        lastDate: DateTime.now().add(const Duration(days: 1)),
      );

  Future<void> _save() async {
    final start = _start == null ? null : _isoDate(_start!);
    final end = _end == null ? null : _isoDate(_end!);
    if (start != null && end != null && end.compareTo(start) < 0) {
      setState(() => _error = 'A data de encerramento não pode ser anterior ao início.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final label = _label.text.trim();
      await GameExtrasApi.createPlaythrough(widget.gameId, {
        'label': label.isEmpty ? null : label,
        // Com encerramento a jornada nasce finalizada; sem início fica planejada.
        'status': end != null ? _result : (start != null ? 'PLAYING' : 'PLANNED'),
        'startedAt': start,
        'primaryPlatformId': _platformId,
        'completedAt': ?end,
      });
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = PlatformsApi.errorMessage(error, 'Não foi possível criar a jornada.');
        });
      }
    }
  }

  Widget _dateField(String label, DateTime? value, ValueChanged<DateTime?> onChanged, {String? hint}) {
    return InkWell(
      onTap: () async {
        final picked = await _pick(value);
        if (picked != null) setState(() => onChanged(picked));
      },
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          helperText: hint,
          suffixIcon: value == null
              ? const Icon(Icons.calendar_today_rounded, size: 18)
              : IconButton(
                  icon: const Icon(Icons.close_rounded, size: 18),
                  tooltip: 'Limpar',
                  onPressed: () => setState(() => onChanged(null)),
                ),
        ),
        child: Text(value == null ? '—' : formatCalendarDate(_isoDate(value))),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sorted = [...widget.catalog]..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Nova jornada', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 14),
              TextField(
                controller: _label,
                maxLength: 120,
                decoration: const InputDecoration(labelText: 'Identificação', hintText: 'Ex.: Replay no PlayStation 5', counterText: ''),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                initialValue: _platformId,
                decoration: const InputDecoration(labelText: 'Plataforma principal'),
                items: [
                  const DropdownMenuItem<String?>(value: null, child: Text('Não informada')),
                  for (final item in sorted) DropdownMenuItem<String?>(value: item.id, child: Text(item.name)),
                ],
                onChanged: (value) => setState(() => _platformId = value),
              ),
              const SizedBox(height: 12),
              _dateField('Início', _start, (value) => _start = value, hint: 'Vazio deixa a jornada só planejada.'),
              const SizedBox(height: 12),
              _dateField('Encerramento', _end, (value) => _end = value, hint: 'Preencha para lançar uma jornada que já terminou.'),
              if (_end != null) ...[
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _result,
                  decoration: const InputDecoration(labelText: 'Resultado'),
                  items: const [
                    DropdownMenuItem(value: 'COMPLETED', child: Text('Concluída')),
                    DropdownMenuItem(value: 'ABANDONED', child: Text('Abandonada')),
                  ],
                  onChanged: (value) => setState(() => _result = value ?? 'COMPLETED'),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(_error!, style: const TextStyle(color: Color(0xFFF08A7E), fontSize: 13)),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _saving ? null : () => Navigator.pop(context, false),
                      child: const Text('Cancelar'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: FilledButton(onPressed: _saving ? null : _save, child: const Text('Criar jornada'))),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
