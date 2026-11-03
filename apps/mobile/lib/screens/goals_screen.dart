import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/game_list.dart';
import '../models/goal.dart';
import '../providers/goals_provider.dart';
import '../providers/lists_provider.dart';
import '../widgets/section.dart';

const _months = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/// Metas de jogos zerados ou horas jogadas — paridade com o `GoalsCard` da web.
///
/// Permite criar (tipo, período, ano/mês e alvo), ajustar o alvo e excluir.
class GoalsScreen extends ConsumerWidget {
  const GoalsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final goalsAsync = ref.watch(goalsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Metas'),
        actions: [
          IconButton(
            tooltip: 'Atualizar',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.read(goalsProvider.notifier).refresh(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openForm(context, ref),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Meta'),
      ),
      body: goalsAsync.when(
        data: (goals) => goals.isEmpty
            ? const MessageState(
                icon: Icons.flag_outlined,
                message: 'Defina metas anuais ou mensais, zerar uma lista, jogar horas '
                    'seguidas ou um texto livre para acompanhar seu ritmo.',
              )
            : RefreshIndicator(
                onRefresh: () => ref.read(goalsProvider.notifier).refresh(),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
                  itemCount: goals.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, index) => _GoalTile(
                    goal: goals[index],
                    onEditTarget: () => _editTarget(context, ref, goals[index]),
                    onDelete: () => _delete(context, ref, goals[index]),
                    onToggleDone: () => ref.read(goalsProvider.notifier).setDone(goals[index].id, !goals[index].done),
                  ),
                ),
              ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => MessageState(
          icon: Icons.cloud_off_rounded,
          message: 'Não foi possível carregar as metas',
          actionLabel: 'Tentar novamente',
          onAction: () => ref.read(goalsProvider.notifier).refresh(),
        ),
      ),
    );
  }

  Future<void> _openForm(BuildContext context, WidgetRef ref) async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1E2A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _GoalForm(),
    );
    if (created == true) await ref.read(goalsProvider.notifier).refresh();
  }

  Future<void> _editTarget(
    BuildContext context,
    WidgetRef ref,
    GoalProgress goal,
  ) async {
    final controller = TextEditingController(text: '${goal.target}');
    final value = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Ajustar alvo'),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(labelText: 'Novo alvo'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          TextButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Salvar'),
          ),
        ],
      ),
    );
    if (value == null) return;
    final target = int.tryParse(value);
    if (target == null || target < 1) return;
    try {
      await ref.read(goalsProvider.notifier).updateTarget(goal.id, target);
    } catch (_) {
      if (context.mounted) _snack(context, 'Não foi possível ajustar o alvo.');
    }
  }

  Future<void> _delete(BuildContext context, WidgetRef ref, GoalProgress goal) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Excluir meta'),
        content: Text('Excluir "${goalLabel(goal)}"?'),
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
      await ref.read(goalsProvider.notifier).delete(goal.id);
    } catch (_) {
      if (context.mounted) _snack(context, 'Não foi possível excluir a meta.');
    }
  }

  static void _snack(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}

/// Rótulo "Zerar 10 jogos · 2026", "Jogar 20 h · março de 2026" ou o texto da meta.
String goalLabel(GoalProgress goal) {
  if (!goal.hasPeriod) {
    final title = goal.title;
    return switch (goal.kind) {
      'COMPLETE_LIST' => title ?? 'Zerar a lista ${goal.listName ?? 'removida'}',
      'SESSION_HOURS' => title ?? 'Jogar ${goal.target} h seguidas',
      _ => title ?? 'Meta',
    };
  }
  final what = goal.kind == 'COMPLETED_GAMES'
      ? 'Zerar ${goal.target} ${goal.target == 1 ? 'jogo' : 'jogos'}'
      : 'Jogar ${goal.target} h';
  final when = goal.period == 'YEAR'
      ? '${goal.year}'
      : '${_months[(goal.month ?? 1) - 1]} de ${goal.year}';
  return '$what · $when';
}

class _GoalTile extends StatelessWidget {
  final GoalProgress goal;
  final VoidCallback onEditTarget;
  final VoidCallback onDelete;
  final VoidCallback onToggleDone;

  const _GoalTile({
    required this.goal,
    required this.onEditTarget,
    required this.onDelete,
    required this.onToggleDone,
  });

  @override
  Widget build(BuildContext context) {
    final status = goal.achieved
        ? 'meta atingida'
        : goal.onTrack
            ? 'no ritmo'
            : goal.elapsedPercent >= 100
                ? 'período encerrado'
                : 'abaixo do ritmo';
    final progressText = switch (goal.kind) {
      'PLAYED_HOURS' => '${formatHours(goal.current)} de ${goal.target} h',
      'SESSION_HOURS' => 'melhor sessão: ${formatHours(goal.current)} de ${goal.target} h',
      'CUSTOM' => goal.done ? 'concluída' : 'em aberto',
      _ => '${_trim(goal.current)} de ${goal.target}',
    };
    final due = goal.dueDate == null ? '' : ' · até ${goal.dueDate!.split('-').reversed.join('/')}';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2A),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(goalLabel(goal),
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              ),
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert_rounded, color: Color(0xFF6B6B7E), size: 20),
                onSelected: (value) => switch (value) {
                  'target' => onEditTarget(),
                  'done' => onToggleDone(),
                  _ => onDelete(),
                },
                itemBuilder: (_) => [
                  if (goal.kind == 'CUSTOM')
                    PopupMenuItem(value: 'done', child: Text(goal.done ? 'Reabrir' : 'Marcar como concluída'))
                  else if (goal.kind != 'COMPLETE_LIST')
                    const PopupMenuItem(value: 'target', child: Text('Ajustar alvo')),
                  PopupMenuItem(
                    value: 'delete',
                    child: Text('Excluir', style: TextStyle(color: Color(0xFFE53E3E))),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: (goal.percent / 100).clamp(0, 1),
              minHeight: 10,
              backgroundColor: const Color(0xFF2A2A3A),
              valueColor: AlwaysStoppedAnimation(
                goal.achieved
                    ? const Color(0xFF48BB78)
                    : goal.onTrack
                        ? const Color(0xFF6C63FF)
                        : const Color(0xFFED8936),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '$progressText${goal.kind == 'CUSTOM' ? '' : ' (${_trim(goal.percent)}%)'} · $status$due',
            style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12),
          ),
        ],
      ),
    );
  }

  static String _trim(double value) {
    final rounded = (value * 10).round() / 10;
    return rounded == rounded.roundToDouble()
        ? rounded.toStringAsFixed(0)
        : rounded.toStringAsFixed(1).replaceAll('.', ',');
  }
}

class _GoalForm extends ConsumerStatefulWidget {
  const _GoalForm();

  @override
  ConsumerState<_GoalForm> createState() => _GoalFormState();
}

class _GoalFormState extends ConsumerState<_GoalForm> {
  String _kind = 'COMPLETED_GAMES';
  String _period = 'YEAR';
  late int _year = DateTime.now().year;
  late int _month = DateTime.now().month;
  late final _yearController = TextEditingController(text: '$_year');
  final _targetController = TextEditingController();
  final _titleController = TextEditingController();
  String? _listId;
  DateTime? _dueDate;
  bool _saving = false;
  String? _message;

  bool get _byPeriod => _kind == 'COMPLETED_GAMES' || _kind == 'PLAYED_HOURS';

  @override
  void dispose() {
    _yearController.dispose();
    _targetController.dispose();
    _titleController.dispose();
    super.dispose();
  }

  static String _iso(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _dueDate ?? now,
      firstDate: DateTime(now.year - 1),
      lastDate: DateTime(now.year + 10),
    );
    if (picked != null) setState(() => _dueDate = picked);
  }

  Future<void> _save() async {
    final target = int.tryParse(_targetController.text.trim());
    final title = _titleController.text.trim();
    if ((_byPeriod || _kind == 'SESSION_HOURS') && (target == null || target < 1)) {
      setState(() => _message = 'Informe um alvo válido.');
      return;
    }
    if (_kind == 'COMPLETE_LIST' && _listId == null) {
      setState(() => _message = 'Escolha a lista.');
      return;
    }
    if (_kind == 'CUSTOM' && title.isEmpty) {
      setState(() => _message = 'Informe o texto da meta.');
      return;
    }
    setState(() {
      _saving = true;
      _message = null;
    });
    try {
      await ref.read(goalsProvider.notifier).create({
        'kind': _kind,
        if (_byPeriod) ...{
          'period': _period,
          'year': _year,
          if (_period == 'MONTH') 'month': _month,
          'target': target,
        } else ...{
          if (title.isNotEmpty) 'title': title,
          if (_kind == 'COMPLETE_LIST') 'listId': _listId,
          if (_kind == 'SESSION_HOURS') 'target': target,
          if (_dueDate != null) 'dueDate': _iso(_dueDate!),
        },
      });
      if (mounted) Navigator.pop(context, true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = false;
          _message = _byPeriod ? 'Você já tem uma meta deste tipo para esse período.' : 'Não foi possível criar a meta.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final lists = ref.watch(listsProvider).valueOrNull ?? const <GameListSummary>[];
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Nova meta', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _kind,
              decoration: const InputDecoration(labelText: 'Tipo'),
              items: [for (final entry in goalKindLabels.entries) DropdownMenuItem(value: entry.key, child: Text(entry.value))],
              onChanged: (value) {
                if (value != null) setState(() => _kind = value);
              },
            ),
            const SizedBox(height: 12),
            if (_byPeriod) ...[
              DropdownButtonFormField<String>(
                initialValue: _period,
                decoration: const InputDecoration(labelText: 'Período'),
                items: const [
                  DropdownMenuItem(value: 'YEAR', child: Text('Ano')),
                  DropdownMenuItem(value: 'MONTH', child: Text('Mês')),
                ],
                onChanged: (value) {
                  if (value != null) setState(() => _period = value);
                },
              ),
              const SizedBox(height: 12),
              TextField(
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Ano'),
                controller: _yearController,
                onChanged: (value) => _year = int.tryParse(value) ?? _year,
              ),
              if (_period == 'MONTH') ...[
                const SizedBox(height: 12),
                DropdownButtonFormField<int>(
                  initialValue: _month,
                  decoration: const InputDecoration(labelText: 'Mês'),
                  items: [
                    for (var i = 0; i < _months.length; i++) DropdownMenuItem(value: i + 1, child: Text(_months[i])),
                  ],
                  onChanged: (value) {
                    if (value != null) setState(() => _month = value);
                  },
                ),
              ],
            ],
            if (_kind == 'COMPLETE_LIST')
              DropdownButtonFormField<String>(
                initialValue: _listId,
                decoration: const InputDecoration(labelText: 'Lista'),
                items: [for (final list in lists) DropdownMenuItem(value: list.id, child: Text('${list.name} (${list.gameCount})'))],
                onChanged: (value) => setState(() => _listId = value),
              ),
            if (_byPeriod || _kind == 'SESSION_HOURS') ...[
              const SizedBox(height: 12),
              TextField(
                controller: _targetController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(labelText: _kind == 'COMPLETED_GAMES' ? 'Alvo (jogos)' : 'Alvo (horas)'),
              ),
            ],
            if (!_byPeriod) ...[
              const SizedBox(height: 12),
              TextField(
                controller: _titleController,
                maxLength: 200,
                decoration: InputDecoration(
                  labelText: _kind == 'CUSTOM' ? 'Texto da meta' : 'Descrição (opcional)',
                  counterText: '',
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _dueDate == null ? 'Sem data limite' : 'Até ${_iso(_dueDate!).split('-').reversed.join('/')}',
                      style: const TextStyle(color: Color(0xFF8888A0), fontSize: 13),
                    ),
                  ),
                  TextButton(onPressed: _pickDate, child: const Text('Data limite')),
                  if (_dueDate != null) TextButton(onPressed: () => setState(() => _dueDate = null), child: const Text('Limpar')),
                ],
              ),
            ],
            if (_message != null) ...[
              const SizedBox(height: 12),
              Text(_message!, style: const TextStyle(color: Color(0xFFE53E3E), fontSize: 13)),
            ],
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _saving ? null : () => Navigator.pop(context),
                    child: const Text('Cancelar'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: _saving ? null : _save,
                    child: _saving
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Criar meta'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
