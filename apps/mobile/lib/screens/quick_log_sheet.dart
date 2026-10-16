import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../core/sessions_api.dart';
import '../models/game.dart';
import '../models/session.dart';
import '../providers/dashboard_provider.dart';
import '../providers/games_provider.dart';

/// Durações oferecidas como atalho, em minutos.
const quickLogDurations = [30, 60, 90, 120, 180];

const _eyebrow = TextStyle(
  color: Color(0xFF6B6B7E),
  fontSize: 11,
  fontWeight: FontWeight.w700,
  letterSpacing: 0.6,
);

/// Monta a sessão retroativa a partir do dia escolhido e de uma duração.
///
/// O término é o horário atual aplicado ao dia escolhido: registrar hoje nunca
/// cria uma sessão no futuro, e registrar ontem preserva o dia pretendido.
Session buildRetroactiveSession({
  required Game game,
  required DateTime day,
  required int minutes,
  required DateTime now,
}) {
  final endedAt = DateTime(day.year, day.month, day.day, now.hour, now.minute);
  return Session(
    id: '',
    gameId: game.id,
    startedAt: endedAt.subtract(Duration(minutes: minutes)),
    endedAt: endedAt,
  );
}

/// Rótulo curto de duração: `30 min`, `1 h`, `1 h 30`.
String formatQuickLogDuration(int minutes) {
  final hours = minutes ~/ 60;
  final rest = minutes % 60;
  if (hours == 0) return '$rest min';
  return rest == 0 ? '$hours h' : '$hours h $rest';
}

/// Abre a folha de registro retroativo. Retorna `true` quando uma sessão entra.
Future<bool?> showQuickLogSheet(BuildContext context, Game game) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(0xFF1E1E2A),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => QuickLogSheet(game: game),
  );
}

/// Registro retroativo em dois toques: abrir a folha e escolher a duração.
///
/// O dia começa em "Hoje"; "Ontem" e o seletor de data deixam o registro
/// retroativo a um toque de distância.
class QuickLogSheet extends ConsumerStatefulWidget {
  const QuickLogSheet({super.key, required this.game});

  final Game game;

  @override
  ConsumerState<QuickLogSheet> createState() => _QuickLogSheetState();
}

class _QuickLogSheetState extends ConsumerState<QuickLogSheet> {
  late DateTime _day;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _day = DateTime(now.year, now.month, now.day);
  }

  Future<void> _log(int minutes) async {
    if (_saving) return;
    setState(() => _saving = true);
    final session = buildRetroactiveSession(
      game: widget.game,
      day: _day,
      minutes: minutes,
      now: DateTime.now(),
    );
    try {
      await SessionsApi.create(widget.game.id, session);
      ref.invalidate(sessionsForGameProvider(widget.game.id));
      ref.invalidate(dashboardProvider);
      if (mounted) Navigator.pop(context, true);
    } catch (_) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Não foi possível registrar a sessão.')),
      );
    }
  }

  Future<void> _pickDay() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _day,
      firstDate: DateTime(now.year - 5),
      lastDate: DateTime(now.year, now.month, now.day),
      helpText: 'Dia da sessão',
    );
    if (picked != null) {
      setState(() => _day = DateTime(picked.year, picked.month, picked.day));
    }
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final yesterday = today.subtract(const Duration(days: 1));
    final isToday = _day == today;
    final isYesterday = _day == yesterday;

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 24),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Registrar sessão',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              widget.game.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Color(0xFF8888A0), fontSize: 13),
            ),
            const SizedBox(height: 18),
            const Text('DIA', style: _eyebrow),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('Hoje'),
                  selected: isToday,
                  onSelected: (_) => setState(() => _day = today),
                ),
                ChoiceChip(
                  label: const Text('Ontem'),
                  selected: isYesterday,
                  onSelected: (_) => setState(() => _day = yesterday),
                ),
                ChoiceChip(
                  avatar: const Icon(Icons.calendar_today_rounded, size: 14),
                  label: Text(
                    isToday || isYesterday
                        ? 'Outro dia'
                        : DateFormat('d MMM', 'pt_BR').format(_day),
                  ),
                  selected: !isToday && !isYesterday,
                  onSelected: (_) => _pickDay(),
                ),
              ],
            ),
            const SizedBox(height: 18),
            const Text('QUANTO TEMPO', style: _eyebrow),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final minutes in quickLogDurations)
                  ActionChip(
                    label: Text(formatQuickLogDuration(minutes)),
                    onPressed: _saving ? null : () => _log(minutes),
                  ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              isToday
                  ? 'A sessão termina agora, com a duração escolhida.'
                  : 'A sessão entra no dia escolhido, no horário atual.',
              style: const TextStyle(color: Color(0xFF6B6B7E), fontSize: 12),
            ),
            if (_saving) ...[
              const SizedBox(height: 16),
              const LinearProgressIndicator(),
            ],
          ],
        ),
      ),
    );
  }
}
