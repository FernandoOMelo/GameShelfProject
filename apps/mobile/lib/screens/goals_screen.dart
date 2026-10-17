import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/goal.dart';
import '../providers/goals_provider.dart';
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
                message: 'Defina metas anuais ou mensais de jogos zerados ou horas '
                    'jogadas para acompanhar seu ritmo.',
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

/// Rótulo "Zerar 10 jogos · 2026" ou "Jogar 20 h · março de 2026".
String goalLabel(GoalProgress goal) {
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

  const _GoalTile({
    required this.goal,
    required this.onEditTarget,
    required this.onDelete,
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
    final progressText = goal.kind == 'COMPLETED_GAMES'
        ? '${_trim(goal.current)} de ${goal.target}'
        : '${formatHours(goal.current)} de ${goal.target} h';

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
                onSelected: (value) => value == 'target' ? onEditTarget() : onDelete(),
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'target', child: Text('Ajustar alvo')),
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
            '$progressText (${_trim(goal.percent)}%) · $status',
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
  bool _saving = false;
  String? _message;

  @override
  void dispose() {
    _yearController.dispose();
    _targetController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final target = int.tryParse(_targetController.text.trim());
    if (target == null || target < 1) {
      setState(() => _message = 'Informe um alvo válido.');
      return;
    }
    setState(() {
      _saving = true;
      _message = null;
    });
    try {
      await ref.read(goalsProvider.notifier).create(
            kind: _kind,
            period: _period,
            year: _year,
            month: _period == 'MONTH' ? _month : null,
            target: target,
          );
      if (mounted) Navigator.pop(context, true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = false;
          _message = 'Você já tem uma meta deste tipo para esse período.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
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
            const Text('Nova meta',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _kind,
              decoration: const InputDecoration(labelText: 'Tipo'),
              items: const [
                DropdownMenuItem(value: 'COMPLETED_GAMES', child: Text('Jogos zerados')),
                DropdownMenuItem(value: 'PLAYED_HOURS', child: Text('Horas jogadas')),
              ],
              onChanged: (value) {
                if (value != null) setState(() => _kind = value);
              },
            ),
            const SizedBox(height: 12),
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
                  for (var i = 0; i < _months.length; i++)
                    DropdownMenuItem(value: i + 1, child: Text(_months[i])),
                ],
                onChanged: (value) {
                  if (value != null) setState(() => _month = value);
                },
              ),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: _targetController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(
                labelText: _kind == 'COMPLETED_GAMES' ? 'Alvo (jogos)' : 'Alvo (horas)',
              ),
            ),
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
