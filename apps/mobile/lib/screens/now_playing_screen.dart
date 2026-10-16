import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/active_session_provider.dart';
import '../providers/dashboard_provider.dart';
import '../widgets/game_cover.dart';
import '../widgets/session_timer.dart';
import 'end_session_sheet.dart';

class NowPlayingScreen extends ConsumerWidget {
  const NowPlayingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionState = ref.watch(activeSessionProvider);
    final dashboardAsync = ref.watch(dashboardProvider);

    if (sessionState.hasActive) {
      return _ActiveSessionView(sessionState: sessionState);
    }

    return dashboardAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => _ErrorView(message: e.toString(), onRetry: () => ref.invalidate(dashboardProvider)),
      data: (dashboard) {
        if (dashboard.playingGames.isEmpty) {
          return const _EmptyView();
        }
        return _PlayingGamesList(dashboard: dashboard);
      },
    );
  }
}

class _ActiveSessionView extends ConsumerWidget {
  final ActiveSessionState sessionState;

  const _ActiveSessionView({required this.sessionState});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final game = sessionState.game!;
    final session = sessionState.session!;

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            if (game.backgroundUrl != null)
              _BackgroundHeader(
                backgroundUrl: game.backgroundUrl!,
                coverUrl: game.coverUrl,
                title: game.title,
              )
            else
              _SimpleHeader(game: game),
            const SizedBox(height: 32),
            const Text(
              'Em sessão',
              style: TextStyle(color: Color(0xFF8888A0), fontSize: 14, letterSpacing: 1.2),
            ),
            const SizedBox(height: 8),
            SessionTimer(
              startedAt: session.startedAt,
              style: const TextStyle(
                fontSize: 56,
                fontWeight: FontWeight.w700,
                letterSpacing: -2,
                color: Color(0xFF6C63FF),
              ),
            ),
            const Spacer(),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _showEndSheet(context),
                  icon: const Icon(Icons.stop_circle_outlined, size: 22),
                  label: const Text('Encerrar Sessão'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFE53E3E),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showEndSheet(BuildContext context) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1E2A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const EndSessionSheet(),
    );
  }
}

class _BackgroundHeader extends StatelessWidget {
  final String backgroundUrl;
  final String? coverUrl;
  final String title;

  const _BackgroundHeader({
    required this.backgroundUrl,
    this.coverUrl,
    required this.title,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        GameCover(
          coverUrl: backgroundUrl,
          width: double.infinity,
          height: 200,
          borderRadius: BorderRadius.zero,
        ),
        Container(
          height: 200,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Colors.transparent, Color(0xFF121218)],
            ),
          ),
        ),
        Positioned(
          bottom: 16,
          left: 16,
          right: 16,
          child: Row(
            children: [
              GameCover(coverUrl: coverUrl, width: 56, height: 72),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SimpleHeader extends StatelessWidget {
  final dynamic game;

  const _SimpleHeader({required this.game});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
      child: Row(
        children: [
          GameCover(coverUrl: game.coverUrl, width: 64, height: 80),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              game.title,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class _PlayingGamesList extends ConsumerWidget {
  final dynamic dashboard;

  const _PlayingGamesList({required this.dashboard});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          const SliverAppBar(
            title: Text('Agora Jogando'),
            pinned: true,
            floating: false,
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, i) {
                  final pg = dashboard.playingGames[i];
                  return _PlayingGameCard(playingGame: pg);
                },
                childCount: dashboard.playingGames.length,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PlayingGameCard extends ConsumerWidget {
  final dynamic playingGame;

  const _PlayingGameCard({required this.playingGame});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final game = playingGame.game;
    final hours = playingGame.playedHours as double;
    final progress = playingGame.progress as int?;
    final isActive = playingGame.activeSession != null;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            GameCover(coverUrl: game.coverUrl, width: 56, height: 72),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    game.title,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${hours.toStringAsFixed(1)}h jogadas'
                    '${progress != null ? ' · $progress%' : ''}',
                    style: const TextStyle(color: Color(0xFF8888A0), fontSize: 13),
                  ),
                  if (isActive) ...[
                    const SizedBox(height: 6),
                    const Row(
                      children: [
                        Icon(Icons.circle, size: 8, color: Color(0xFF48BB78)),
                        SizedBox(width: 4),
                        Text(
                          'Sessão ativa',
                          style: TextStyle(color: Color(0xFF48BB78), fontSize: 12),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (isActive)
              _EndButton(playingGame: playingGame)
            else
              _StartButton(game: game),
          ],
        ),
      ),
    );
  }
}

class _StartButton extends ConsumerWidget {
  final dynamic game;

  const _StartButton({required this.game});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loading = ref.watch(activeSessionProvider).loading;
    return IconButton.filled(
      onPressed: loading ? null : () => ref.read(activeSessionProvider.notifier).start(game),
      icon: loading
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            )
          : const Icon(Icons.play_arrow_rounded),
      style: IconButton.styleFrom(backgroundColor: const Color(0xFF6C63FF)),
    );
  }
}

class _EndButton extends ConsumerWidget {
  final dynamic playingGame;

  const _EndButton({required this.playingGame});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return IconButton.filled(
      onPressed: () async {
        final activeSession = playingGame.activeSession;
        if (activeSession != null) {
          await ref.read(activeSessionProvider.notifier).setActive(
                playingGame.game,
                activeSession,
              );
        }
        if (context.mounted) {
          await showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            backgroundColor: const Color(0xFF1E1E2A),
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            builder: (_) => const EndSessionSheet(),
          );
        }
      },
      icon: const Icon(Icons.stop_rounded),
      style: IconButton.styleFrom(backgroundColor: const Color(0xFFE53E3E)),
    );
  }
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.sports_esports_rounded, size: 64, color: Color(0xFF4A4A5A)),
          SizedBox(height: 16),
          Text(
            'Nenhum jogo em andamento',
            style: TextStyle(color: Color(0xFF8888A0), fontSize: 16),
          ),
          SizedBox(height: 8),
          Text(
            'Inicie a partir da Fila',
            style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 14),
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 48, color: Color(0xFF8888A0)),
            const SizedBox(height: 16),
            Text(
              'Não foi possível conectar ao servidor',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFF8888A0)),
            ),
            const SizedBox(height: 16),
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Tentar novamente'),
            ),
          ],
        ),
      ),
    );
  }
}
