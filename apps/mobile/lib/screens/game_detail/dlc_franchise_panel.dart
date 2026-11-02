import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/game_extras_api.dart';
import '../../core/platforms_api.dart';
import '../../models/game.dart';
import '../../models/game_extras.dart';
import '../../providers/game_extras_provider.dart';
import '../../providers/games_provider.dart';
import '../../widgets/game_cover.dart';
import '../../widgets/section.dart';
import '../game_editor_screen.dart';

const _card = Color(0xFF1E1E2A);
const _muted = Color(0xFF8888A0);
const _danger = Color(0xFFE53E3E);

/// DLC (entidade própria, com progresso independente do jogo base) e os outros
/// jogos da franquia no IGDB, com atalho para cadastrar os que faltam.
class DlcFranchisePanel extends ConsumerWidget {
  final Game game;

  const DlcFranchisePanel({super.key, required this.game});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _DlcSection(gameId: game.id),
        const SizedBox(height: 24),
        _FranchiseSection(game: game),
      ],
    );
  }
}

class _DlcSection extends ConsumerWidget {
  final String gameId;

  const _DlcSection({required this.gameId});

  void _toast(BuildContext context, String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _run(BuildContext context, WidgetRef ref, Future<void> Function() action, String fallback) async {
    try {
      await action();
      ref.invalidate(dlcsProvider(gameId));
    } catch (error) {
      if (context.mounted) _toast(context, PlatformsApi.errorMessage(error, fallback));
    }
  }

  Future<void> _openForm(BuildContext context, WidgetRef ref, {Dlc? editing}) async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _DlcSheet(gameId: gameId, editing: editing),
    );
    if (saved == true) ref.invalidate(dlcsProvider(gameId));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dlcs = ref.watch(dlcsProvider(gameId));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(
          'DLC',
          trailing: TextButton.icon(
            onPressed: () => _openForm(context, ref),
            icon: const Icon(Icons.add_rounded, size: 18),
            label: const Text('Adicionar'),
          ),
        ),
        dlcs.when(
          loading: () => const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator())),
          error: (_, _) => const Text('Não foi possível carregar as DLCs.', style: TextStyle(color: _muted)),
          data: (items) => items.isEmpty
              ? Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF2A2A3A))),
                  child: const Text('Nenhuma DLC cadastrada para este jogo.',
                      textAlign: TextAlign.center, style: TextStyle(color: _muted, fontSize: 12)),
                )
              : Column(
                  children: [
                    for (final dlc in items)
                      Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.fromLTRB(12, 12, 4, 8),
                        decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(14)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                GameCover(coverUrl: dlc.coverUrl, width: 44, height: 58, borderRadius: BorderRadius.circular(8)),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(dlc.name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                                      const SizedBox(height: 4),
                                      Text(
                                        [
                                          dlcStatusLabels[dlc.status] ?? dlc.status,
                                          if (dlc.playedHours > 0) '${formatHours(dlc.playedHours)} jogadas',
                                          if (dlc.estimatedHours != null) '${formatHours(dlc.estimatedHours)} estimadas',
                                        ].join(' · '),
                                        style: const TextStyle(color: _muted, fontSize: 12),
                                      ),
                                    ],
                                  ),
                                ),
                                PopupMenuButton<String>(
                                  tooltip: 'Mais ações de ${dlc.name}',
                                  onSelected: (value) async {
                                    if (value == 'edit') {
                                      await _openForm(context, ref, editing: dlc);
                                    } else {
                                      final confirmed = await showDialog<bool>(
                                        context: context,
                                        builder: (context) => AlertDialog(
                                          title: const Text('Excluir DLC'),
                                          content: Text('Excluir "${dlc.name}"? Esta ação não pode ser desfeita.'),
                                          actions: [
                                            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
                                            TextButton(
                                              onPressed: () => Navigator.pop(context, true),
                                              child: const Text('Excluir', style: TextStyle(color: _danger)),
                                            ),
                                          ],
                                        ),
                                      );
                                      if (confirmed == true && context.mounted) {
                                        await _run(context, ref, () => GameExtrasApi.removeDlc(gameId, dlc.id),
                                            'Não foi possível excluir a DLC.');
                                      }
                                    }
                                  },
                                  itemBuilder: (_) => const [
                                    PopupMenuItem(value: 'edit', child: Text('Editar')),
                                    PopupMenuItem(value: 'delete', child: Text('Excluir', style: TextStyle(color: _danger))),
                                  ],
                                ),
                              ],
                            ),
                            Row(
                              children: [
                                const Text('Possuo', style: TextStyle(fontSize: 12)),
                                const SizedBox(width: 6),
                                Switch(
                                  value: dlc.owned,
                                  onChanged: (value) => _run(context, ref,
                                      () => GameExtrasApi.updateDlc(gameId, dlc.id, {'owned': value}), 'Não foi possível salvar.'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

class _DlcSheet extends StatefulWidget {
  final String gameId;
  final Dlc? editing;

  const _DlcSheet({required this.gameId, this.editing});

  @override
  State<_DlcSheet> createState() => _DlcSheetState();
}

class _DlcSheetState extends State<_DlcSheet> {
  late final TextEditingController _name = TextEditingController(text: widget.editing?.name ?? '');
  late final TextEditingController _played = TextEditingController(
      text: (widget.editing?.playedHours ?? 0) == 0 ? '' : widget.editing!.playedHours.toString().replaceAll('.', ','));
  late final TextEditingController _estimated = TextEditingController(
      text: widget.editing?.estimatedHours?.toString().replaceAll('.', ',') ?? '');
  late String _status = widget.editing?.status ?? 'NOT_STARTED';
  late bool _owned = widget.editing?.owned ?? false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _played.dispose();
    _estimated.dispose();
    super.dispose();
  }

  double? _number(TextEditingController controller) => double.tryParse(controller.text.trim().replaceAll(',', '.'));

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isEmpty) {
      setState(() => _error = 'Informe o nome da DLC.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final body = <String, dynamic>{
        'name': name,
        'status': _status,
        'owned': _owned,
        'estimatedHours': _number(_estimated),
        if (_number(_played) != null) 'playedHours': _number(_played),
      };
      if (widget.editing == null) {
        await GameExtrasApi.createDlc(widget.gameId, body);
      } else {
        await GameExtrasApi.updateDlc(widget.gameId, widget.editing!.id, body);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = PlatformsApi.errorMessage(error, 'Não foi possível salvar a DLC.');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(widget.editing == null ? 'Adicionar DLC' : 'Editar DLC',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 14),
              TextField(controller: _name, maxLength: 200, decoration: const InputDecoration(labelText: 'Nome', counterText: '')),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _status,
                decoration: const InputDecoration(labelText: 'Progresso'),
                items: [
                  for (final entry in dlcStatusLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value)),
                ],
                onChanged: (value) => setState(() => _status = value ?? 'NOT_STARTED'),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _played,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Horas jogadas'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: _estimated,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Horas estimadas'),
                    ),
                  ),
                ],
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Possuo esta DLC'),
                value: _owned,
                onChanged: (value) => setState(() => _owned = value),
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
                  Expanded(child: FilledButton(onPressed: _saving ? null : _save, child: const Text('Salvar'))),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FranchiseSection extends ConsumerWidget {
  final Game game;

  const _FranchiseSection({required this.game});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final franchiseId = game.franchiseId;
    if (franchiseId == null) {
      return const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionTitle('Franquia'),
          Text('Este jogo não tem franquia. Defina uma na edição do jogo.', style: TextStyle(color: _muted, fontSize: 12)),
        ],
      );
    }
    final async = ref.watch(franchiseGamesProvider(franchiseId));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionTitle(async.valueOrNull == null ? 'Franquia' : 'Franquia · ${async.valueOrNull!.franchiseName}'),
        async.when(
          loading: () => const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator())),
          error: (_, _) => const Text(
            'Não foi possível carregar a franquia. Confira se as credenciais do IGDB estão configuradas no servidor.',
            style: TextStyle(color: _muted, fontSize: 12),
          ),
          data: (data) {
            if (data.games.isEmpty) {
              return const Text(
                'Sem outros jogos da franquia. A franquia precisa estar vinculada ao IGDB (cadastre o jogo pela busca de metadata).',
                style: TextStyle(color: _muted, fontSize: 12),
              );
            }
            return Column(
              children: [
                for (final item in data.games)
                  Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(12)),
                    child: Row(
                      children: [
                        GameCover(coverUrl: item.coverUrl, width: 40, height: 54, borderRadius: BorderRadius.circular(6)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(item.title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                              if (item.releaseYear != null)
                                Text('${item.releaseYear}', style: const TextStyle(color: _muted, fontSize: 11)),
                            ],
                          ),
                        ),
                        if (item.inLibrary)
                          const Padding(
                            padding: EdgeInsets.only(right: 6),
                            child: Text('Na biblioteca', style: TextStyle(color: Color(0xFF5FD18D), fontSize: 11)),
                          )
                        else
                          OutlinedButton(
                            onPressed: () async {
                              await Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => GameEditorScreen(initialTitle: item.title)),
                              );
                              ref.invalidate(franchiseGamesProvider(franchiseId));
                              await ref.read(gamesProvider.notifier).reload();
                            },
                            child: const Text('Adicionar'),
                          ),
                      ],
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}
