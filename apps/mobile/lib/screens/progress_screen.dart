import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/dashboard_provider.dart';
import '../models/dashboard.dart';

class ProgressScreen extends ConsumerWidget {
  const ProgressScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardAsync = ref.watch(dashboardProvider);

    return Scaffold(
      body: dashboardAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_rounded, size: 48, color: Color(0xFF8888A0)),
              const SizedBox(height: 16),
              TextButton.icon(
                onPressed: () => ref.invalidate(dashboardProvider),
                icon: const Icon(Icons.refresh),
                label: const Text('Tentar novamente'),
              ),
            ],
          ),
        ),
        data: (d) => _ProgressContent(dashboard: d),
      ),
    );
  }
}

class _ProgressContent extends StatelessWidget {
  final Dashboard dashboard;

  const _ProgressContent({required this.dashboard});

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        const SliverAppBar(title: Text('Progresso'), pinned: true),
        SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              _StatsGrid(dashboard: dashboard),
              const SizedBox(height: 24),
              if (dashboard.currentGame != null) ...[
                const _SectionTitle('Jogando agora'),
                const SizedBox(height: 12),
                _CurrentGameCard(pg: dashboard.currentGame!),
                const SizedBox(height: 24),
              ],
              if (dashboard.playingGames.isNotEmpty) ...[
                const _SectionTitle('Em andamento'),
                const SizedBox(height: 12),
                ...dashboard.playingGames.map((pg) => _PlayingGameRow(pg: pg)),
              ],
            ]),
          ),
        ),
      ],
    );
  }
}

class _StatsGrid extends StatelessWidget {
  final Dashboard dashboard;

  const _StatsGrid({required this.dashboard});

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.6,
      children: [
        _StatCard(
          label: 'Horas jogadas',
          value: _formatHours(dashboard.totalPlayedHours),
          icon: Icons.schedule_rounded,
          color: const Color(0xFF6C63FF),
        ),
        _StatCard(
          label: 'Zerados',
          value: '${dashboard.completedCount}',
          icon: Icons.check_circle_outline_rounded,
          color: const Color(0xFF48BB78),
        ),
        _StatCard(
          label: 'Em andamento',
          value: '${dashboard.playingCount}',
          icon: Icons.play_circle_outline_rounded,
          color: const Color(0xFFED8936),
        ),
        _StatCard(
          label: 'Backlog restante',
          value: _formatHours(dashboard.backlogRemainingHours),
          icon: Icons.hourglass_empty_rounded,
          color: const Color(0xFFE53E3E),
        ),
      ],
    );
  }

  String _formatHours(double h) {
    if (h >= 1000) return '${(h / 1000).toStringAsFixed(1)}k h';
    if (h >= 100) return '${h.toStringAsFixed(0)} h';
    return '${h.toStringAsFixed(1)} h';
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2A),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            label,
            style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _CurrentGameCard extends StatelessWidget {
  final dynamic pg;

  const _CurrentGameCard({required this.pg});

  @override
  Widget build(BuildContext context) {
    final game = pg.game;
    final hours = pg.playedHours as double;
    final progress = pg.progress as int?;
    final remaining = pg.remainingHours as double?;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF6C63FF).withAlpha(77), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            game.title,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
          ),
          const SizedBox(height: 12),
          if (progress != null) ...[
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: progress / 100,
                      backgroundColor: const Color(0xFF2A2A3A),
                      valueColor: const AlwaysStoppedAnimation(Color(0xFF6C63FF)),
                      minHeight: 8,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Text(
                  '$progress%',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          Row(
            children: [
              _InfoChip(
                icon: Icons.schedule_rounded,
                label: '${hours.toStringAsFixed(1)}h jogadas',
              ),
              if (remaining != null) ...[
                const SizedBox(width: 8),
                _InfoChip(
                  icon: Icons.hourglass_bottom_rounded,
                  label: '~${remaining.toStringAsFixed(0)}h restantes',
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _PlayingGameRow extends StatelessWidget {
  final dynamic pg;

  const _PlayingGameRow({required this.pg});

  @override
  Widget build(BuildContext context) {
    final game = pg.game;
    final hours = pg.playedHours as double;
    final progress = pg.progress as int?;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E2A),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                game.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w500),
              ),
            ),
            const SizedBox(width: 12),
            Text(
              '${hours.toStringAsFixed(1)}h'
              '${progress != null ? ' · $progress%' : ''}',
              style: const TextStyle(color: Color(0xFF8888A0), fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  final IconData icon;
  final String label;

  const _InfoChip({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: const Color(0xFF8888A0)),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
      ],
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;

  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: const TextStyle(
        color: Color(0xFF8888A0),
        fontSize: 11,
        fontWeight: FontWeight.w600,
        letterSpacing: 1.2,
      ),
    );
  }
}
