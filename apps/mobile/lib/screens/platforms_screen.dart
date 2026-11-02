import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/platforms_api.dart';
import '../models/catalog.dart';
import '../models/platform_summary.dart';
import '../providers/catalog_provider.dart';
import '../providers/platforms_provider.dart';
import '../widgets/game_cover.dart';
import '../widgets/platform_logo.dart';
import '../widgets/section.dart';

const _muted = Color(0xFF8888A0);
const _card = Color(0xFF1E1E2A);

/// Plataformas: o catálogo e a visão por plataforma, como a área "Contas" do
/// Trophies Hunter. Cada cartão mostra logo e cor oficiais, os números da
/// biblioteca e o estado da sincronização com o Achievist; o cadastro (catálogo
/// ou personalizada, editar, excluir) vive aqui, não em Configurações.
class PlatformsScreen extends ConsumerStatefulWidget {
  const PlatformsScreen({super.key});

  @override
  ConsumerState<PlatformsScreen> createState() => _PlatformsScreenState();
}

class _PlatformsScreenState extends ConsumerState<PlatformsScreen> {
  bool _syncing = false;

  Future<void> _refresh() async {
    ref.invalidate(platformSummariesProvider);
    ref.invalidate(platformsProvider);
    ref.invalidate(syncStateProvider);
    await ref.read(platformSummariesProvider.future);
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _sync() async {
    setState(() => _syncing = true);
    try {
      final started = await PlatformsApi.startSync();
      if (!started) _toast('Já existe uma sincronização em andamento.');
      await _refresh();
    } catch (error) {
      _toast(PlatformsApi.errorMessage(error, 'Não foi possível sincronizar.'));
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  Future<void> _openForm(
    List<CatalogItem> platforms, {
    CatalogItem? editing,
  }) async {
    final changed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) =>
          _PlatformFormSheet(platforms: platforms, editing: editing),
    );
    if (changed == true) await _refresh();
  }

  Future<void> _delete(CatalogItem platform) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Excluir plataforma'),
        content: Text(
          'Excluir "${platform.name}" do catálogo? A exclusão é recusada se houver jogos '
          'vinculados ou outras plataformas dentro dela.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text(
              'Excluir',
              style: TextStyle(color: Color(0xFFE53E3E)),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await PlatformsApi.remove(platform.id);
      await _refresh();
    } catch (error) {
      _toast(
        PlatformsApi.errorMessage(
          error,
          'Não foi possível excluir a plataforma.',
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final summaries = ref.watch(platformSummariesProvider);
    final sync = ref.watch(syncStateProvider).valueOrNull;
    final platforms =
        summaries.valueOrNull?.map((item) => item.platform).toList() ??
        const <CatalogItem>[];
    final syncEnabled = sync != null && !sync.disabled;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Plataformas'),
        actions: [
          if (syncEnabled)
            _syncing || sync.running
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : IconButton(
                    tooltip: 'Sincronizar Achievist',
                    icon: const Icon(Icons.sync_rounded),
                    onPressed: _sync,
                  ),
          IconButton(
            tooltip: 'Adicionar plataforma',
            icon: const Icon(Icons.add_rounded),
            onPressed: summaries.hasValue ? () => _openForm(platforms) : null,
          ),
        ],
      ),
      body: summaries.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => MessageState(
          icon: Icons.cloud_off_rounded,
          message: 'Não foi possível carregar as plataformas.',
          actionLabel: 'Tentar de novo',
          onAction: _refresh,
        ),
        data: (items) {
          if (items.isEmpty) {
            return MessageState(
              icon: Icons.devices_other_rounded,
              message:
                  'Nenhuma plataforma ainda. Adicione uma para agrupar seus jogos.',
              actionLabel: 'Adicionar plataforma',
              onAction: () => _openForm(platforms),
            );
          }
          final sorted = [...items]
            ..sort((a, b) {
              final byGames = b.gameCount.compareTo(a.gameCount);
              return byGames != 0
                  ? byGames
                  : a.platform.name.toLowerCase().compareTo(
                      b.platform.name.toLowerCase(),
                    );
            });
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              itemCount: sorted.length,
              separatorBuilder: (_, _) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final summary = sorted[index];
                final group = platforms
                    .where((item) => item.id == summary.platform.parentId)
                    .firstOrNull;
                return PlatformCard(
                  summary: summary,
                  groupName: group?.name,
                  sync: sync,
                  syncBusy: _syncing,
                  onSync: syncEnabled ? _sync : null,
                  onEdit: () => _openForm(platforms, editing: summary.platform),
                  onDelete: () => _delete(summary.platform),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

/// Cartão de uma plataforma: logo na cor da marca, contadores, progresso e
/// rodapé com o estado de sincronização. Linhas sem dado somem, em vez de
/// mostrar zero.
class PlatformCard extends StatelessWidget {
  final PlatformSummary summary;
  final String? groupName;
  final SyncState? sync;
  final bool syncBusy;
  final VoidCallback? onSync;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;

  /// Sem o rodapé de sincronização e o menu: usado nas Estatísticas, só leitura.
  final bool readOnly;

  const PlatformCard({
    super.key,
    required this.summary,
    this.groupName,
    this.sync,
    this.syncBusy = false,
    this.onSync,
    this.onEdit,
    this.onDelete,
    this.readOnly = false,
  });

  @override
  Widget build(BuildContext context) {
    final platform = summary.platform;
    final brand = hexColor(platform.color) ?? const Color(0xFF6C63FF);
    final minutes = summary.shownMinutes;
    final completionPct = summary.gameCount > 0
        ? summary.completedCount / summary.gameCount
        : null;
    final achievementPct = summary.achievementsTotal > 0
        ? summary.achievementsUnlocked / summary.achievementsTotal
        : null;

    return Container(
      decoration: BoxDecoration(
        color: _card,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                PlatformLogo(iconKey: platform.iconKey, color: platform.color),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        platform.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (groupName != null)
                        Text(
                          'em $groupName',
                          style: const TextStyle(color: _muted, fontSize: 11),
                        ),
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 12,
                        runSpacing: 4,
                        children: [
                          _Stat(
                            icon: Icons.person_outline_rounded,
                            value: '${summary.gameCount}',
                            label: 'Jogos',
                          ),
                          if (minutes > 0)
                            _Stat(
                              icon: Icons.schedule_rounded,
                              value: formatMinutes(minutes),
                              label: 'Tempo de jogo',
                            ),
                          if (summary.achievementsTotal > 0)
                            _Stat(
                              icon: Icons.emoji_events_outlined,
                              value: '${summary.achievementsUnlocked}',
                              label: 'Conquistas desbloqueadas',
                            ),
                          _Stat(
                            icon: Icons.workspace_premium_outlined,
                            value: '${summary.dominatedCount}',
                            label: 'Dominados',
                          ),
                          _Stat(
                            icon: Icons.check_rounded,
                            value: '${summary.completedCount}',
                            label: 'Zerados',
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (summary.recentGameCovers.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (final cover in summary.recentGameCovers.take(2))
                        Padding(
                          padding: const EdgeInsets.only(left: 4),
                          child: GameCover(
                            coverUrl: cover,
                            width: 30,
                            height: 40,
                            borderRadius: BorderRadius.circular(5),
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (completionPct != null || achievementPct != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
              child: Column(
                children: [
                  if (completionPct != null)
                    _ProgressLine(
                      label: 'Zerados ${(completionPct * 100).round()}%',
                      value: completionPct,
                      color: brand,
                    ),
                  if (achievementPct != null) ...[
                    const SizedBox(height: 8),
                    _ProgressLine(
                      label:
                          'Conquistas ${summary.achievementsUnlocked} de ${summary.achievementsTotal}',
                      value: achievementPct,
                      color: brand,
                    ),
                  ],
                ],
              ),
            ),
          if (!readOnly) const Divider(height: 1),
          if (!readOnly)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 6, 6, 6),
              child: Row(
                children: [
                  SyncChip(
                    sync: summary.hasExternal ? sync : null,
                    hasExternal: summary.hasExternal,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _footerText(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: _muted, fontSize: 11),
                    ),
                  ),
                  if (summary.hasExternal && onSync != null)
                    IconButton(
                      tooltip: 'Sincronizar ${platform.name}',
                      icon: const Icon(Icons.sync_rounded, size: 20),
                      onPressed: syncBusy || (sync?.running ?? false)
                          ? null
                          : onSync,
                    ),
                  PopupMenuButton<String>(
                    tooltip: 'Mais ações de ${platform.name}',
                    onSelected: (value) =>
                        value == 'edit' ? onEdit?.call() : onDelete?.call(),
                    itemBuilder: (_) => const [
                      PopupMenuItem(value: 'edit', child: Text('Editar')),
                      PopupMenuItem(
                        value: 'delete',
                        child: Text(
                          'Excluir',
                          style: TextStyle(color: Color(0xFFE53E3E)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  String _footerText() {
    if (!summary.hasExternal) return 'Dados registrados manualmente';
    if (sync == null) return 'Sem estado de sincronização';
    if (sync!.failed) return 'Última sincronização falhou';
    final at = sync!.lastAt;
    return at == null
        ? 'Sem sync nesta execução'
        : 'Sync ${formatRelative(at)}';
  }
}

class _Stat extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;

  const _Stat({required this.icon, required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: label,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: _muted),
          const SizedBox(width: 4),
          Text(value, style: const TextStyle(color: _muted, fontSize: 12)),
        ],
      ),
    );
  }
}

class _ProgressLine extends StatelessWidget {
  final String label;
  final double value;
  final Color color;

  const _ProgressLine({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            color: Color(0xFF6B6B7E),
            fontSize: 10,
            letterSpacing: 0.4,
          ),
        ),
        const SizedBox(height: 4),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: value.clamp(0.0, 1.0),
            minHeight: 6,
            backgroundColor: const Color(0xFF2A2A3A),
            valueColor: AlwaysStoppedAnimation(color),
          ),
        ),
      ],
    );
  }
}

/// Estado da sincronização de uma plataforma: Pronto, Sincronizando, Falhou,
/// ou Manual quando não há dado do Achievist.
class SyncChip extends StatelessWidget {
  final SyncState? sync;
  final bool hasExternal;

  const SyncChip({super.key, required this.sync, required this.hasExternal});

  @override
  Widget build(BuildContext context) {
    final (label, fg, bg) = !hasExternal
        ? ('Manual', const Color(0xFF8B949E), const Color(0xFF171B22))
        : sync?.running == true
        ? ('Sincronizando…', const Color(0xFF7FB0FF), const Color(0xFF14263F))
        : sync?.failed == true
        ? ('Falhou', const Color(0xFFF08A7E), const Color(0xFF3A1A18))
        : ('Pronto', const Color(0xFF5FD18D), const Color(0xFF12301F));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}

/// Opções de ícone para plataformas personalizadas.
const platformIconOptions = <(String, String)>[
  ('playstation', 'PlayStation'),
  ('xbox', 'Xbox'),
  ('nintendo', 'Nintendo'),
  ('steam', 'Steam'),
  ('epic', 'Epic Games'),
  ('gog', 'GOG'),
  ('rockstar', 'Rockstar'),
  ('google-play', 'Google Play'),
  ('ea', 'EA'),
  ('ubisoft', 'Ubisoft'),
  ('battlenet', 'Battle.net'),
  ('pc', 'PC'),
  ('retro', 'Retro'),
  ('mobile', 'Mobile'),
];

/// Cadastro e edição: escolhe do catálogo (logo e cor oficiais) ou personaliza.
class _PlatformFormSheet extends ConsumerStatefulWidget {
  final List<CatalogItem> platforms;
  final CatalogItem? editing;

  const _PlatformFormSheet({required this.platforms, this.editing});

  @override
  ConsumerState<_PlatformFormSheet> createState() => _PlatformFormSheetState();
}

class _PlatformFormSheetState extends ConsumerState<_PlatformFormSheet> {
  late final TextEditingController _name = TextEditingController(
    text: widget.editing?.name ?? '',
  );
  late final TextEditingController _color = TextEditingController(
    text: widget.editing?.color ?? '',
  );
  late String? _parentId = widget.editing?.parentId;
  late String? _iconKey = widget.editing?.iconKey;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _color.dispose();
    super.dispose();
  }

  bool get _isGroupOfOthers =>
      widget.editing != null &&
      widget.platforms.any((item) => item.parentId == widget.editing!.id);

  void _pick(PlatformCatalogEntry entry) {
    setState(() {
      _name.text = entry.name;
      _iconKey = entry.iconKey;
      _color.text = entry.color;
    });
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Informe o nome da plataforma.');
      return;
    }
    final color = _color.text.trim().toUpperCase();
    if (color.isNotEmpty && hexColor(color) == null) {
      setState(() => _error = 'Use uma cor no formato #RRGGBB.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final editing = widget.editing;
      if (editing == null) {
        await PlatformsApi.create(
          name: name,
          parentId: _parentId,
          iconKey: _iconKey,
          color: color.isEmpty ? null : color,
        );
      } else {
        // Só envia o que mudou, para não regravar a identidade visual sem querer.
        final changes = <String, dynamic>{
          if (name != editing.name) 'name': name,
          if (_parentId != editing.parentId) 'parentId': _parentId,
          if (_iconKey != null && _iconKey != editing.iconKey)
            'iconKey': _iconKey,
          if (color.isNotEmpty && color != editing.color) 'color': color,
        };
        if (changes.isNotEmpty) await PlatformsApi.update(editing.id, changes);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = PlatformsApi.errorMessage(
            error,
            'Não foi possível salvar a plataforma.',
          );
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final editing = widget.editing;
    final catalog =
        ref.watch(platformCatalogProvider).valueOrNull ??
        const <PlatformCatalogEntry>[];
    final available = catalog
        .where(
          (entry) => !widget.platforms.any(
            (item) => item.name.toLowerCase() == entry.name.toLowerCase(),
          ),
        )
        .toList();
    final groups = widget.platforms
        .where((item) => item.parentId == null && item.id != editing?.id)
        .toList();
    final previewColor = _color.text.trim().isEmpty
        ? editing?.color
        : _color.text.trim();

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          20 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                editing == null
                    ? 'Adicionar plataforma'
                    : 'Editar ${editing.name}',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (editing == null && available.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text(
                  'Escolha do catálogo para já trazer o logo e a cor oficiais, ou personalize abaixo.',
                  style: TextStyle(color: _muted, fontSize: 12),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final entry in available)
                      ActionChip(
                        avatar: PlatformLogo(
                          iconKey: entry.iconKey,
                          color: entry.color,
                          size: 22,
                        ),
                        label: Text(entry.name),
                        onPressed: () => _pick(entry),
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  PlatformLogo(
                    iconKey: _iconKey,
                    color: previewColor,
                    size: 52,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: _name,
                      maxLength: 200,
                      decoration: const InputDecoration(
                        labelText: 'Nome',
                        counterText: '',
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                initialValue: _parentId,
                decoration: InputDecoration(
                  labelText: 'Grupo',
                  helperText: _isGroupOfOthers
                      ? 'Já é grupo de outras plataformas.'
                      : null,
                ),
                items: [
                  const DropdownMenuItem<String?>(
                    value: null,
                    child: Text('Nenhum (é um grupo)'),
                  ),
                  for (final group in groups)
                    DropdownMenuItem<String?>(
                      value: group.id,
                      child: Text(group.name),
                    ),
                ],
                onChanged: _isGroupOfOthers
                    ? null
                    : (value) => setState(() => _parentId = value),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String?>(
                initialValue: _iconKey,
                decoration: const InputDecoration(labelText: 'Ícone'),
                items: [
                  DropdownMenuItem<String?>(
                    value: null,
                    child: Text(
                      editing == null ? 'Automático (pelo nome)' : 'Manter',
                    ),
                  ),
                  for (final option in platformIconOptions)
                    DropdownMenuItem<String?>(
                      value: option.$1,
                      child: Text(option.$2),
                    ),
                ],
                onChanged: (value) => setState(() => _iconKey = value),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _color,
                maxLength: 7,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(
                  labelText: 'Cor da marca (#RRGGBB)',
                  helperText: 'Vazio usa a cor do catálogo.',
                  counterText: '',
                ),
                onChanged: (_) => setState(() {}),
              ),
              if (catalog.isNotEmpty) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final color
                        in catalog.map((entry) => entry.color).toSet())
                      GestureDetector(
                        onTap: () => setState(() => _color.text = color),
                        child: Container(
                          width: 26,
                          height: 26,
                          decoration: BoxDecoration(
                            color: hexColor(color),
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white24),
                          ),
                        ),
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 8),
              const Text(
                'Uma plataforma sem grupo é um grupo em si. Colocar Steam dentro de PC faz as horas e os '
                'jogos zerados das duas aparecerem juntos nas estatísticas, sem apagar nada.',
                style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 11),
              ),
              if (_error != null) ...[
                const SizedBox(height: 10),
                Text(
                  _error!,
                  style: const TextStyle(
                    color: Color(0xFFF08A7E),
                    fontSize: 13,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _saving
                          ? null
                          : () => Navigator.pop(context, false),
                      child: const Text('Cancelar'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: _saving ? null : _save,
                      child: Text(editing == null ? 'Adicionar' : 'Salvar'),
                    ),
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
