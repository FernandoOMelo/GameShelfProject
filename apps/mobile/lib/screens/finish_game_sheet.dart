import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../core/games_api.dart';
import '../core/lifecycle_api.dart';
import '../models/game.dart';
import '../models/lifecycle.dart';
import '../providers/dashboard_provider.dart';
import '../providers/games_provider.dart';
import '../providers/queue_provider.dart';
import '../widgets/status.dart';

const _muted = Color(0xFF8888A0);
const _accent = Color(0xFF6C63FF);

/// Estados em que "Zerar" faz sentido: jogo desejado ou já zerado ficam de fora.
bool canFinish(Game game) => game.status != 'DESIRED' && game.status != 'COMPLETED';

/// Zera o jogo: grava primeiro (status, data, jornada e sessão aberta) e só depois
/// pergunta nota, dificuldade e extras, tudo pulável. Fechar o assistente nunca
/// perde a conclusão; o snackbar oferece Desfazer (ADR-042).
Future<void> finishGame(BuildContext context, WidgetRef ref, Game game) async {
  final messenger = ScaffoldMessenger.of(context);
  final navigator = Navigator.of(context, rootNavigator: true);
  FinishResult result;
  try {
    result = await LifecycleApi.finish(game.id);
  } catch (_) {
    messenger.showSnackBar(const SnackBar(content: Text('Não foi possível zerar o jogo agora.')));
    return;
  }
  ref.invalidate(gamesProvider);
  ref.invalidate(dashboardProvider);
  ref.invalidate(queueProvider);
  if (!navigator.mounted) return;
  final finished = await showModalBottomSheet<FinishResult>(
    context: navigator.context,
    isScrollControlled: true,
    backgroundColor: const Color(0xFF1E1E2A),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (_) => FinishGameSheet(
      result: result,
      onChangeDate: (date) async {
        // Mudar a data refaz a conclusão: desfaz e grava de novo com o dia escolhido.
        await LifecycleApi.undoFinish(game.id, result.undo);
        result = await LifecycleApi.finish(game.id, completedAt: DateFormat('yyyy-MM-dd').format(date));
        return result;
      },
      onSaveExtras: (values) async => GamesApi.update(game.id, values),
    ),
  );
  ref.invalidate(gamesProvider);
  ref.invalidate(dashboardProvider);
  messenger.showSnackBar(SnackBar(
    content: Text('${game.title} zerado.'),
    duration: const Duration(seconds: 8),
    action: SnackBarAction(
      label: 'Desfazer',
      onPressed: () async {
        try {
          await LifecycleApi.undoFinish(game.id, (finished ?? result).undo);
          ref.invalidate(gamesProvider);
          ref.invalidate(dashboardProvider);
          ref.invalidate(queueProvider);
        } catch (_) {
          messenger.showSnackBar(const SnackBar(content: Text('Não foi possível desfazer.')));
        }
      },
    ),
  ));
}

/// Assistente em etapas: nota, dificuldade, extras e resumo.
class FinishGameSheet extends StatefulWidget {
  final FinishResult result;
  final Future<FinishResult> Function(DateTime date) onChangeDate;
  final Future<Object?> Function(Map<String, dynamic> values) onSaveExtras;

  const FinishGameSheet({super.key, required this.result, required this.onChangeDate, required this.onSaveExtras});

  @override
  State<FinishGameSheet> createState() => _FinishGameSheetState();
}

class _FinishGameSheetState extends State<FinishGameSheet> {
  static const _steps = ['Nota', 'Dificuldade', 'Extras', 'Resumo'];
  late FinishResult _result = widget.result;
  final _condition = TextEditingController();
  int _step = 0;
  int? _rating;
  String? _difficulty;
  late bool _favorite = _result.game.favorite;
  bool _gameOfYear = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _condition.dispose();
    super.dispose();
  }

  DateTime get _completedOn => DateTime.parse(_result.game.completedAt ?? DateFormat('yyyy-MM-dd').format(DateTime.now()));

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _completedOn,
      firstDate: DateTime(2000),
      lastDate: DateTime.now(),
    );
    if (picked == null) return;
    setState(() { _busy = true; _error = null; });
    try {
      final updated = await widget.onChangeDate(picked);
      if (mounted) setState(() => _result = updated);
    } catch (_) {
      if (mounted) setState(() => _error = 'Não foi possível mudar a data (ela não pode ser anterior ao início).');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _next() async {
    if (_step < _steps.length - 1) {
      setState(() => _step += 1);
      return;
    }
    // Última etapa: grava o que foi preenchido (só o que mudou) e fecha.
    final values = <String, dynamic>{
      'rating': ?_rating,
      'difficulty': ?_difficulty,
      if (_condition.text.trim().isNotEmpty) 'completionCondition': _condition.text.trim(),
      if (_favorite != _result.game.favorite) 'favorite': _favorite,
      if (_gameOfYear) 'gameOfYear': true,
    };
    if (values.isEmpty) {
      Navigator.pop(context, _result);
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      await widget.onSaveExtras(values);
      if (mounted) Navigator.pop(context, _result);
    } catch (_) {
      if (mounted) setState(() { _busy = false; _error = 'Não foi possível salvar. A conclusão já está gravada.'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final last = _step == _steps.length - 1;
    return Padding(
      padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 24),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${_result.game.title} zerado!', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Row(children: [
              Text('Em ${DateFormat('dd/MM/yyyy').format(_completedOn)}', style: const TextStyle(color: _muted)),
              TextButton(onPressed: _busy ? null : _pickDate, child: const Text('Alterar data')),
            ]),
            LinearProgressIndicator(value: (_step + 1) / _steps.length, color: _accent),
            const SizedBox(height: 4),
            Text('${_step + 1} de ${_steps.length} · ${_steps[_step]}', style: const TextStyle(color: _muted, fontSize: 12)),
            const SizedBox(height: 16),
            if (_step == 0) _ratingStep(),
            if (_step == 1) _difficultyStep(),
            if (_step == 2) _extrasStep(),
            if (_step == 3) _summaryStep(),
            if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, style: const TextStyle(color: Color(0xFFE53E3E)))),
            const SizedBox(height: 20),
            Row(children: [
              if (!last) TextButton(onPressed: _busy ? null : () => setState(() => _step += 1), child: const Text('Pular')),
              const Spacer(),
              ElevatedButton(onPressed: _busy ? null : _next, child: Text(last ? 'Concluir' : 'Próximo')),
            ]),
          ],
        ),
      ),
    );
  }

  Widget _ratingStep() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Que nota você dá?', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 12),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (var value = 1; value <= 11; value++)
            ChoiceChip(
              key: ValueKey('rating-$value'),
              label: Text('$value'),
              selected: _rating == value,
              onSelected: (selected) => setState(() => _rating = selected ? value : null),
            ),
        ]),
      ]);

  Widget _difficultyStep() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Qual foi a dificuldade?', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 12),
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final entry in difficultyLabels.entries)
            ChoiceChip(
              key: ValueKey('difficulty-${entry.key}'),
              label: Text(entry.value),
              selected: _difficulty == entry.key,
              onSelected: (selected) => setState(() => _difficulty = selected ? entry.key : null),
            ),
        ]),
      ]);

  Widget _extrasStep() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        TextField(
          controller: _condition,
          decoration: const InputDecoration(labelText: 'Condição de zeramento (opcional)', helperText: 'Ex.: veja os créditos.'),
        ),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Favorito'), value: _favorite, onChanged: (v) => setState(() => _favorite = v)),
        SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Jogo do ano'), value: _gameOfYear, onChanged: (v) => setState(() => _gameOfYear = v)),
      ]);

  Widget _summaryStep() => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _line('Zerado em', DateFormat('dd/MM/yyyy').format(_completedOn)),
        _line('Nota', _rating?.toString() ?? '—'),
        _line('Dificuldade', _difficulty == null ? '—' : difficultyLabels[_difficulty]!),
        _line('Favorito', _favorite ? 'Sim' : 'Não'),
        const SizedBox(height: 8),
        const Text('A conclusão já está salva. Use "Desfazer" no aviso se foi engano.', style: TextStyle(color: _muted, fontSize: 12)),
      ]);

  Widget _line(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [Expanded(child: Text(label, style: const TextStyle(color: _muted))), Text(value)]),
      );
}
