import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/game.dart';
import '../providers/games_provider.dart';
import '../widgets/game_cover.dart';
import 'game_detail_screen.dart';

const statusLabels = {
  'DESIRED': 'Desejado',
  'BACKLOG': 'Na biblioteca',
  'QUEUED': 'Na fila',
  'PLAYING': 'Jogando',
  'PAUSED': 'Pausado',
  'COMPLETED': 'Zerado',
  'ABANDONED': 'Abandonado',
};

const statusColors = {
  'PLAYING': Color(0xFF48BB78),
  'PAUSED': Color(0xFFECC94B),
  'COMPLETED': Color(0xFF6C63FF),
  'ABANDONED': Color(0xFFE53E3E),
  'BACKLOG': Color(0xFF6B6B7E),
  'DESIRED': Color(0xFF8888A0),
  'QUEUED': Color(0xFF4299E1),
};

class LibraryScreen extends ConsumerStatefulWidget {
  const LibraryScreen({super.key});

  @override
  ConsumerState<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends ConsumerState<LibraryScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final games = ref.watch(gamesProvider);

    return games.when(
      data: (all) {
        final visible = _filter(all);
        return RefreshIndicator(
          onRefresh: () => ref.read(gamesProvider.notifier).refresh(),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                child: TextField(
                  decoration: const InputDecoration(
                    hintText: 'Buscar na biblioteca',
                    prefixIcon: Icon(Icons.search_rounded, color: Color(0xFF6B6B7E)),
                  ),
                  onChanged: (value) => setState(() => _query = value),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    Text(
                      '${visible.length} ${visible.length == 1 ? 'jogo' : 'jogos'}',
                      style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: visible.isEmpty
                    ? const _EmptyLibrary()
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: visible.length,
                        separatorBuilder: (_, _) => const SizedBox(height: 10),
                        itemBuilder: (_, index) => _GameTile(game: visible[index]),
                      ),
              ),
            ],
          ),
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (_, _) => _LibraryError(onRetry: () => ref.invalidate(gamesProvider)),
    );
  }

  List<Game> _filter(List<Game> all) {
    final term = _query.trim().toLowerCase();
    if (term.isEmpty) return all;
    return all.where((game) => game.title.toLowerCase().contains(term)).toList();
  }
}

class _GameTile extends StatelessWidget {
  final Game game;

  const _GameTile({required this.game});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF1E1E2A),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => GameDetailScreen(game: game)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              GameCover(coverUrl: game.coverUrl),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      game.title,
                      style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    StatusPill(status: game.status),
                    if (game.developer != null || game.releaseYear != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        [game.releaseYear, game.developer].where((part) => part != null).join(' · '),
                        style: const TextStyle(color: Color(0xFF6B6B7E), fontSize: 11),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: Color(0xFF4A4A5A)),
            ],
          ),
        ),
      ),
    );
  }
}

class StatusPill extends StatelessWidget {
  final String status;

  const StatusPill({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final color = statusColors[status] ?? const Color(0xFF6B6B7E);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        statusLabels[status] ?? status,
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _EmptyLibrary extends StatelessWidget {
  const _EmptyLibrary();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.videogame_asset_off_rounded, size: 44, color: Color(0xFF4A4A5A)),
            SizedBox(height: 12),
            Text(
              'Nenhum jogo encontrado',
              style: TextStyle(color: Color(0xFF8888A0), fontSize: 14),
            ),
          ],
        ),
      ),
    );
  }
}

class _LibraryError extends StatelessWidget {
  final VoidCallback onRetry;

  const _LibraryError({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 44, color: Color(0xFF4A4A5A)),
            const SizedBox(height: 12),
            const Text(
              'Não foi possível carregar a biblioteca',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF8888A0), fontSize: 14),
            ),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: onRetry, child: const Text('Tentar novamente')),
          ],
        ),
      ),
    );
  }
}
