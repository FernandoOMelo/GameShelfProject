import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../models/game.dart';
import '../models/session.dart';
import '../providers/games_provider.dart';
import '../widgets/game_cover.dart';
import 'library_screen.dart';
import 'quick_log_sheet.dart';

class GameDetailScreen extends ConsumerWidget {
  final Game game;

  const GameDetailScreen({super.key, required this.game});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessions = ref.watch(sessionsForGameProvider(game.id));

    return Scaffold(
      appBar: AppBar(
        title: Text(game.title),
        actions: [
          IconButton(
            onPressed: () => showQuickLogSheet(context, game),
            tooltip: 'Registrar sessão',
            icon: const Icon(Icons.timer_outlined),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              GameCover(coverUrl: game.coverUrl, width: 96, height: 128),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    StatusPill(status: game.status),
                    const SizedBox(height: 10),
                    Text(
                      [game.releaseYear, game.developer].where((part) => part != null).join(' · '),
                      style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          const _SectionTitle('Estimativas'),
          _InfoRow(label: 'História principal', value: _hours(game.estimatedMainHours)),
          _InfoRow(label: 'Pessoal', value: _hours(game.personalEstimatedHours)),
          _InfoRow(label: 'Lançadas sem sessão', value: _hours(game.retroactivePlayedHours)),
          const SizedBox(height: 24),
          const _SectionTitle('Sessões'),
          sessions.when(
            data: (items) => items.isEmpty
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Text('Nenhuma sessão registrada.', style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 13)),
                  )
                : Column(children: [
                    _InfoRow(label: 'Total jogado', value: _totalPlayed(items, game.retroactivePlayedHours)),
                    const SizedBox(height: 8),
                    ...items.map((session) => _SessionTile(session: session)),
                  ]),
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, _) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Row(
                children: [
                  const Expanded(
                    child: Text('Não foi possível carregar as sessões.', style: TextStyle(color: Color(0xFF8888A0), fontSize: 13)),
                  ),
                  TextButton(
                    onPressed: () => ref.invalidate(sessionsForGameProvider(game.id)),
                    child: const Text('Tentar novamente'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _hours(double? value) => value == null || value == 0 ? '—' : '${_trim(value)} h';

  static String _totalPlayed(List<Session> sessions, double retroactiveHours) {
    final minutes = sessions.fold<int>(0, (total, session) => total + (session.durationMinutes ?? 0));
    return _hours(minutes / 60 + retroactiveHours);
  }

  static String _trim(double value) {
    final rounded = (value * 10).round() / 10;
    return rounded == rounded.roundToDouble() ? rounded.toStringAsFixed(0) : rounded.toStringAsFixed(1);
  }
}

class _SessionTile extends StatelessWidget {
  final Session session;

  const _SessionTile({required this.session});

  @override
  Widget build(BuildContext context) {
    final details = [
      session.location,
      session.progress == null ? null : '${session.progress}%',
    ].where((part) => part != null).join(' · ');

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2A),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                DateFormat("d 'de' MMMM 'de' y · HH:mm", 'pt_BR').format(session.startedAt.toLocal()),
                style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
              ),
              Text(
                session.isActive ? 'Em andamento' : _duration(session.durationMinutes),
                style: TextStyle(
                  color: session.isActive ? const Color(0xFF48BB78) : const Color(0xFF8888A0),
                  fontSize: 12,
                ),
              ),
            ],
          ),
          if (details.isNotEmpty) ...[
            const SizedBox(height: 5),
            Text(details, style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
          ],
          for (final entry in _recap(session)) ...[
            const SizedBox(height: 6),
            Text(entry.key, style: const TextStyle(color: Color(0xFF6C63FF), fontSize: 10, fontWeight: FontWeight.w600)),
            Text(entry.value, style: const TextStyle(color: Color(0xFF6B6B7E), fontSize: 12)),
          ],
        ],
      ),
    );
  }

  static List<MapEntry<String, String>> _recap(Session session) {
    final fields = {
      'Resumo da história': session.notes,
      'Decisões importantes': session.keyDecisions,
      'Dicas e lembretes': session.tips,
    };
    return fields.entries
        .where((entry) => entry.value != null && entry.value!.isNotEmpty)
        .map((entry) => MapEntry(entry.key, entry.value!))
        .toList();
  }

  static String _duration(int? minutes) {
    if (minutes == null) return '—';
    final hours = minutes ~/ 60;
    final rest = minutes % 60;
    if (hours == 0) return '$rest min';
    return rest == 0 ? '$hours h' : '$hours h $rest min';
  }
}

class _SectionTitle extends StatelessWidget {
  final String title;

  const _SectionTitle(this.title);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(color: Color(0xFF6B6B7E), fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.6),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF8888A0), fontSize: 13)),
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
