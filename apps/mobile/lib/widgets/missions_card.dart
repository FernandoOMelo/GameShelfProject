import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/game_list.dart';
import '../models/mission.dart';
import '../providers/lists_provider.dart';
import '../providers/missions_provider.dart';

const _card = Color(0xFF1E1E2A);
const _muted = Color(0xFF8888A0);

String _iso(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

String _detail(Mission mission) {
  final percent = mission.percent.toStringAsFixed(0);
  return switch (mission.kind) {
    'LIST' => '${mission.current.round()} / ${mission.target} zerados ($percent%) · ${mission.listName ?? 'lista removida'}',
    'GAMES_COUNT' => '${mission.current.round()} / ${mission.target} jogos zerados ($percent%)',
    'HOURS' => '${mission.current.toStringAsFixed(1).replaceAll('.', ',')} de ${mission.target} h ($percent%)',
    _ => mission.done ? 'Concluída' : 'Em aberto',
  };
}

/// Missões: várias ativas, uma delas principal (ADR-040). A principal ganha
/// destaque; as demais aparecem em lista, e o gerenciamento fica no menu.
class MissionsCard extends ConsumerWidget {
  const MissionsCard({super.key});

  void _toast(BuildContext context, String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _run(BuildContext context, Future<void> Function() action, String failure) async {
    try {
      await action();
    } catch (_) {
      if (context.mounted) _toast(context, failure);
    }
  }

  Future<void> _create(BuildContext context, WidgetRef ref) async {
    final body = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: _card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => const _MissionSheet(),
    );
    if (body != null && context.mounted) {
      await _run(context, () => ref.read(missionsProvider.notifier).create(body), 'Não foi possível salvar a missão.');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(missionsProvider);
    final missions = async.valueOrNull ?? const <Mission>[];
    final primary = missions.where((mission) => mission.isPrimary).firstOrNull;
    final others = missions.where((mission) => !mission.isPrimary).toList();
    final notifier = ref.read(missionsProvider.notifier);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(child: Text('Missões', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
              TextButton(onPressed: () => _create(context, ref), child: const Text('Nova missão')),
            ],
          ),
          if (async.isLoading && !async.hasValue)
            const Text('Carregando…', style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13))
          else if (missions.isEmpty)
            const Text(
              'Defina objetivos de médio prazo: zerar uma lista, uma quantidade de jogos, horas jogadas ou um texto livre.',
              style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13),
            ),
          if (primary != null) _MissionRow(mission: primary, primary: true, onAction: (value) => _onAction(context, notifier, primary, value)),
          for (final mission in others)
            _MissionRow(mission: mission, primary: false, onAction: (value) => _onAction(context, notifier, mission, value)),
        ],
      ),
    );
  }

  Future<void> _onAction(BuildContext context, MissionsNotifier notifier, Mission mission, String value) async {
    switch (value) {
      case 'primary':
        await _run(context, () => notifier.patch(mission.id, {'isPrimary': true}), 'Não foi possível salvar.');
      case 'done':
        await _run(context, () => notifier.patch(mission.id, {'done': !mission.done}), 'Não foi possível salvar.');
      case 'delete':
        final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Excluir missão'),
            content: Text('Excluir "${mission.title}"?'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Excluir', style: TextStyle(color: Color(0xFFE53E3E))),
              ),
            ],
          ),
        );
        if (confirmed == true && context.mounted) {
          await _run(context, () => notifier.delete(mission.id), 'Não foi possível excluir a missão.');
        }
    }
  }
}

class _MissionRow extends StatelessWidget {
  final Mission mission;
  final bool primary;
  final void Function(String value) onAction;

  const _MissionRow({required this.mission, required this.primary, required this.onAction});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (primary) const Text('MISSÃO PRINCIPAL', style: TextStyle(color: Color(0xFF9E97FF), fontSize: 10, letterSpacing: 1.2)),
          Row(
            children: [
              Expanded(
                child: Text(mission.title, style: TextStyle(fontWeight: FontWeight.w600, fontSize: primary ? 15 : 14)),
              ),
              PopupMenuButton<String>(
                tooltip: 'Mais ações de ${mission.title}',
                icon: const Icon(Icons.more_vert_rounded, color: Color(0xFF6B6B7E), size: 20),
                onSelected: onAction,
                itemBuilder: (_) => [
                  if (!mission.isPrimary) const PopupMenuItem(value: 'primary', child: Text('Tornar principal')),
                  if (mission.kind == 'CUSTOM')
                    PopupMenuItem(value: 'done', child: Text(mission.done ? 'Reabrir' : 'Marcar como concluída')),
                  const PopupMenuItem(value: 'delete', child: Text('Excluir', style: TextStyle(color: Color(0xFFE53E3E)))),
                ],
              ),
            ],
          ),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (mission.percent / 100).clamp(0.0, 1.0),
              minHeight: primary ? 8 : 6,
              backgroundColor: const Color(0xFF2A2A3A),
              valueColor: AlwaysStoppedAnimation(mission.achieved ? const Color(0xFF48BB78) : const Color(0xFF6C63FF)),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            '${_detail(mission)}${mission.dueDate == null ? '' : ' · até ${mission.dueDate!.split('-').reversed.join('/')}'}',
            style: const TextStyle(color: _muted, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _MissionSheet extends ConsumerStatefulWidget {
  const _MissionSheet();

  @override
  ConsumerState<_MissionSheet> createState() => _MissionSheetState();
}

class _MissionSheetState extends ConsumerState<_MissionSheet> {
  final _title = TextEditingController();
  final _target = TextEditingController();
  String _kind = 'LIST';
  String? _listId;
  DateTime? _dueDate;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _target.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _dueDate ?? now,
      firstDate: now,
      lastDate: DateTime(now.year + 10),
    );
    if (picked != null) setState(() => _dueDate = picked);
  }

  void _save() {
    final title = _title.text.trim();
    final target = int.tryParse(_target.text.trim());
    if (title.isEmpty) return setState(() => _error = 'Informe o objetivo da missão.');
    if (_kind == 'LIST' && _listId == null) return setState(() => _error = 'Escolha a lista.');
    if ((_kind == 'GAMES_COUNT' || _kind == 'HOURS') && (target == null || target < 1)) {
      return setState(() => _error = 'Informe um alvo válido.');
    }
    Navigator.pop(context, {
      'title': title,
      'kind': _kind,
      if (_kind == 'LIST') 'listId': _listId,
      if (_kind == 'GAMES_COUNT' || _kind == 'HOURS') 'target': target,
      if (_dueDate != null) 'dueDate': _iso(_dueDate!),
    });
  }

  @override
  Widget build(BuildContext context) {
    final lists = ref.watch(listsProvider).valueOrNull ?? const <GameListSummary>[];
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Nova missão', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 14),
              DropdownButtonFormField<String>(
                initialValue: _kind,
                decoration: const InputDecoration(labelText: 'Tipo'),
                items: [for (final entry in missionKindLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))],
                onChanged: (value) => setState(() => _kind = value ?? _kind),
              ),
              const SizedBox(height: 12),
              TextField(controller: _title, maxLength: 200, decoration: const InputDecoration(labelText: 'Objetivo', counterText: '')),
              if (_kind == 'LIST') ...[
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _listId,
                  decoration: const InputDecoration(labelText: 'Lista acompanhada'),
                  items: [for (final list in lists) DropdownMenuItem(value: list.id, child: Text('${list.name} (${list.gameCount})'))],
                  onChanged: (value) => setState(() => _listId = value),
                ),
              ],
              if (_kind == 'GAMES_COUNT' || _kind == 'HOURS') ...[
                const SizedBox(height: 12),
                TextField(
                  controller: _target,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(labelText: _kind == 'HOURS' ? 'Alvo (horas)' : 'Alvo (jogos)'),
                ),
              ],
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _dueDate == null ? 'Sem prazo' : 'Até ${_iso(_dueDate!).split('-').reversed.join('/')}',
                      style: const TextStyle(color: _muted, fontSize: 13),
                    ),
                  ),
                  TextButton(onPressed: _pickDate, child: const Text('Prazo')),
                  if (_dueDate != null) TextButton(onPressed: () => setState(() => _dueDate = null), child: const Text('Limpar')),
                ],
              ),
              if (_error != null) Text(_error!, style: const TextStyle(color: Color(0xFFF08A7E), fontSize: 13)),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: OutlinedButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar'))),
                  const SizedBox(width: 12),
                  Expanded(child: FilledButton(onPressed: _save, child: const Text('Salvar'))),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
