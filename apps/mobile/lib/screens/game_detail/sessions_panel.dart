import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../../models/session.dart';
import '../../widgets/section.dart';

const _card = Color(0xFF1E1E2A);
const _muted = Color(0xFF8888A0);

/// Aba Sessões: totais, lançamento de horas sem sessão (em horas e minutos,
/// para não ter que calcular), o diário e o histórico de sessões.
class SessionsPanel extends StatefulWidget {
  final List<Session> sessions;
  final double retroactiveHours;

  /// Grava o novo total de horas lançadas sem sessão.
  final Future<void> Function(double totalHours) onSetRetroactive;
  final void Function(Session session) onEdit;
  final void Function(Session session) onDelete;

  const SessionsPanel({
    super.key,
    required this.sessions,
    required this.retroactiveHours,
    required this.onSetRetroactive,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  State<SessionsPanel> createState() => _SessionsPanelState();
}

class _SessionsPanelState extends State<SessionsPanel> {
  final _hours = TextEditingController();
  final _minutes = TextEditingController();
  String? _feedback;
  bool _busy = false;

  @override
  void dispose() {
    _hours.dispose();
    _minutes.dispose();
    super.dispose();
  }

  /// Horas decimais a partir dos campos; `null` quando inválidos (com aviso).
  double? _entered() {
    final hours = int.tryParse(_hours.text.trim().isEmpty ? '0' : _hours.text.trim());
    final minutes = int.tryParse(_minutes.text.trim().isEmpty ? '0' : _minutes.text.trim());
    if (hours == null || minutes == null || hours < 0 || minutes < 0 || minutes > 59) {
      setState(() => _feedback = 'Informe horas inteiras e minutos de 0 a 59.');
      return null;
    }
    return hours + minutes / 60;
  }

  Future<void> _apply({required bool replace}) async {
    final amount = _entered();
    if (amount == null) return;
    if (!replace && amount <= 0) {
      setState(() => _feedback = 'Informe um tempo maior que zero.');
      return;
    }
    setState(() {
      _busy = true;
      _feedback = null;
    });
    try {
      final total = replace ? amount : widget.retroactiveHours + amount;
      await widget.onSetRetroactive((total * 100).round() / 100);
      _hours.clear();
      _minutes.clear();
      if (mounted) setState(() => _feedback = replace ? 'Total corrigido.' : 'Horas lançadas.');
    } catch (_) {
      if (mounted) setState(() => _feedback = 'Não foi possível salvar as horas.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _clear() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Zerar horas retroativas'),
        content: const Text('Remover todas as horas lançadas sem sessão deste jogo? Esta ação não pode ser desfeita.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Zerar', style: TextStyle(color: Color(0xFFE53E3E))),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _busy = true);
    try {
      await widget.onSetRetroactive(0);
      if (mounted) setState(() => _feedback = 'Horas lançadas removidas.');
    } catch (_) {
      if (mounted) setState(() => _feedback = 'Não foi possível salvar as horas.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  List<(String, String)> _latestJournal() {
    const labels = ['Onde parei', 'Resumo da história', 'Decisões importantes', 'Dicas e lembretes'];
    String? field(Session session, int index) => switch (index) {
          0 => session.location,
          1 => session.notes,
          2 => session.keyDecisions,
          _ => session.tips,
        };
    final result = <(String, String)>[];
    for (var i = 0; i < labels.length; i++) {
      for (final session in widget.sessions) {
        final value = field(session, i);
        if (value != null && value.isNotEmpty) {
          result.add((labels[i], value));
          break;
        }
      }
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final sessionMinutes = widget.sessions.fold<int>(0, (total, session) => total + (session.durationMinutes ?? 0));
    final retroMinutes = (widget.retroactiveHours * 60).round();
    final journal = _latestJournal();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: _Stat(label: 'Total registrado', value: formatMinutes(sessionMinutes + retroMinutes))),
            const SizedBox(width: 8),
            Expanded(child: _Stat(label: 'Sem sessão', value: formatMinutes(retroMinutes))),
            const SizedBox(width: 8),
            Expanded(child: _Stat(label: 'Sessões', value: '${widget.sessions.length}')),
          ],
        ),
        const SizedBox(height: 18),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(14)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Lançar horas retroativas', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _hours,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Horas', suffixText: 'h'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: _minutes,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Minutos', suffixText: 'min'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      onPressed: _busy ? null : () => _apply(replace: false),
                      child: const Text('Lançar horas'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _busy ? null : () => _apply(replace: true),
                      child: const Text('Corrigir total'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text('Lançar soma ao total; corrigir substitui o total lançado pelo tempo informado.',
                  style: TextStyle(color: Color(0xFF737771), fontSize: 11)),
              if (_feedback != null) ...[
                const SizedBox(height: 8),
                Text(_feedback!, style: const TextStyle(color: Color(0xFF9FC0FF), fontSize: 12)),
              ],
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: _busy || widget.retroactiveHours == 0 ? null : _clear,
                  child: const Text('Zerar horas lançadas', style: TextStyle(color: Color(0xFFD69B8D), fontSize: 12)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        if (journal.isNotEmpty) ...[
          const SectionTitle('Diário'),
          for (final entry in journal)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(entry.$1,
                      style: const TextStyle(color: Color(0xFF6C63FF), fontSize: 10, fontWeight: FontWeight.w700)),
                  Text(entry.$2, style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 13)),
                ],
              ),
            ),
          const SizedBox(height: 12),
        ],
        const SectionTitle('Histórico'),
        if (widget.sessions.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(22),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF2A2A3A)),
            ),
            child: const Text('Nenhuma sessão registrada.', textAlign: TextAlign.center, style: TextStyle(color: _muted, fontSize: 13)),
          )
        else
          for (final session in widget.sessions)
            SessionTile(session: session, onEdit: () => widget.onEdit(session), onDelete: () => widget.onDelete(session)),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  final String label;
  final String value;

  const _Stat({required this.label, required this.value});

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
          Text(value, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class SessionTile extends StatelessWidget {
  final Session session;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const SessionTile({super.key, required this.session, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final details = [session.location, session.progress == null ? null : '${session.progress}%']
        .where((part) => part != null)
        .join(' · ');

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.fromLTRB(12, 12, 4, 12),
      decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  DateFormat("d 'de' MMM 'de' y · HH:mm", 'pt_BR').format(session.startedAt.toLocal()),
                  style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ),
              Text(
                session.isActive ? 'Em andamento' : formatMinutes(session.durationMinutes),
                style: TextStyle(
                  color: session.isActive ? const Color(0xFF48BB78) : _muted,
                  fontSize: 12,
                ),
              ),
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert_rounded, size: 18, color: Color(0xFF6B6B7E)),
                onSelected: (value) => value == 'edit' ? onEdit() : onDelete(),
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'edit', child: Text('Editar')),
                  PopupMenuItem(value: 'delete', child: Text('Excluir')),
                ],
              ),
            ],
          ),
          if (details.isNotEmpty) ...[
            const SizedBox(height: 5),
            Text(details, style: const TextStyle(color: _muted, fontSize: 12)),
          ],
          for (final entry in [
            ('Resumo da história', session.notes),
            ('Decisões importantes', session.keyDecisions),
            ('Dicas e lembretes', session.tips),
          ])
            if (entry.$2 != null && entry.$2!.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(entry.$1, style: const TextStyle(color: Color(0xFF6C63FF), fontSize: 10, fontWeight: FontWeight.w600)),
              Text(entry.$2!, style: const TextStyle(color: Color(0xFF6B6B7E), fontSize: 12)),
            ],
        ],
      ),
    );
  }
}
