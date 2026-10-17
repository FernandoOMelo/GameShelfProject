import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../models/session.dart';
import '../providers/games_provider.dart';

/// Registra ou edita uma sessão com horários e os quatro campos do diário.
///
/// Devolve `true` quando a sessão é gravada.
class SessionEditorSheet extends ConsumerStatefulWidget {
  final String gameId;
  final Session? session;

  const SessionEditorSheet({super.key, required this.gameId, this.session});

  @override
  ConsumerState<SessionEditorSheet> createState() => _SessionEditorSheetState();
}

class _SessionEditorSheetState extends ConsumerState<SessionEditorSheet> {
  late DateTime _startedAt;
  DateTime? _endedAt;
  late int _progress;
  final _location = TextEditingController();
  final _notes = TextEditingController();
  final _keyDecisions = TextEditingController();
  final _tips = TextEditingController();
  bool _saving = false;
  String _feedback = '';

  @override
  void initState() {
    super.initState();
    final session = widget.session;
    final now = DateTime.now();
    _startedAt = session?.startedAt.toLocal() ?? now.subtract(const Duration(hours: 1));
    _endedAt = session?.endedAt?.toLocal();
    _progress = session?.progress ?? 0;
    _location.text = session?.location ?? '';
    _notes.text = session?.notes ?? '';
    _keyDecisions.text = session?.keyDecisions ?? '';
    _tips.text = session?.tips ?? '';
  }

  @override
  void dispose() {
    for (final controller in [_location, _notes, _keyDecisions, _tips]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _pick({required bool started}) async {
    final initial = started ? _startedAt : (_endedAt ?? DateTime.now());
    final date = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1970),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (time == null) return;
    final value = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    setState(() {
      if (started) {
        _startedAt = value;
      } else {
        _endedAt = value;
      }
    });
  }

  Future<void> _save() async {
    if (_endedAt != null && _endedAt!.isBefore(_startedAt)) {
      setState(() => _feedback = 'O término não pode ser anterior ao início.');
      return;
    }
    setState(() {
      _saving = true;
      _feedback = '';
    });
    final session = Session(
      id: widget.session?.id ?? '',
      gameId: widget.gameId,
      startedAt: _startedAt.toUtc(),
      endedAt: _endedAt?.toUtc(),
      progress: _progress,
      location: _blank(_location.text),
      notes: _blank(_notes.text),
      keyDecisions: _blank(_keyDecisions.text),
      tips: _blank(_tips.text),
    );
    try {
      await ref.read(sessionsForGameProvider(widget.gameId).notifier).save(
            session: session,
            sessionId: widget.session?.id,
          );
      if (mounted) Navigator.pop(context, true);
    } catch (cause) {
      setState(() {
        _saving = false;
        _feedback = 'Não foi possível salvar a sessão.';
      });
    }
  }

  static String? _blank(String value) => value.trim().isEmpty ? null : value.trim();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.session == null ? 'Registrar sessão' : 'Editar sessão',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            if (_feedback.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(_feedback, style: const TextStyle(color: Color(0xFFE53E3E), fontSize: 13)),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(child: _dateTile('Início', _startedAt, () => _pick(started: true))),
                const SizedBox(width: 12),
                Expanded(
                  child: _dateTile(
                    'Término',
                    _endedAt,
                    () => _pick(started: false),
                    onClear: _endedAt == null ? null : () => setState(() => _endedAt = null),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text('Progresso: $_progress%', style: const TextStyle(fontWeight: FontWeight.w500)),
            Slider(
              value: _progress.toDouble(),
              min: 0,
              max: 100,
              divisions: 100,
              activeColor: const Color(0xFF6C63FF),
              onChanged: (value) => setState(() => _progress = value.round()),
            ),
            TextField(
              controller: _location,
              maxLength: 200,
              decoration: const InputDecoration(labelText: 'Onde parei (opcional)'),
            ),
            TextField(
              controller: _notes,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Resumo da história (opcional)', alignLabelWithHint: true),
            ),
            TextField(
              controller: _keyDecisions,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Decisões importantes (opcional)', alignLabelWithHint: true),
            ),
            TextField(
              controller: _tips,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Dicas e lembretes (opcional)', alignLabelWithHint: true),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Salvar'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _dateTile(String label, DateTime? value, VoidCallback onTap, {VoidCallback? onClear}) {
    final formatter = DateFormat("d 'de' MMM 'de' y · HH:mm", 'pt_BR');
    return InkWell(
      onTap: onTap,
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          suffixIcon: onClear == null
              ? const Icon(Icons.schedule_rounded, size: 18)
              : IconButton(icon: const Icon(Icons.clear, size: 18), onPressed: onClear),
        ),
        child: Text(value == null ? 'Em andamento' : formatter.format(value)),
      ),
    );
  }
}
