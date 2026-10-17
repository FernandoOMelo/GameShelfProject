import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/lists_api.dart';
import '../core/queue_api.dart';
import '../models/game.dart';
import '../providers/games_provider.dart';
import '../providers/lists_provider.dart';
import '../providers/queue_provider.dart';
import '../widgets/game_cover.dart';
import '../widgets/section.dart';
import '../widgets/status.dart';
import 'game_detail_screen.dart';

/// Jogos de uma lista: ver, adicionar, remover e montar a fila a partir dela.
class ListDetailScreen extends ConsumerWidget {
  final String listId;

  const ListDetailScreen({super.key, required this.listId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(listDetailProvider(listId));

    return Scaffold(
      appBar: AppBar(
        title: Text(list.valueOrNull?.name ?? 'Lista'),
        actions: [
          IconButton(
            tooltip: 'Montar fila a partir da lista',
            icon: const Icon(Icons.playlist_add_rounded),
            onPressed: () => _queueFromList(context, ref),
          ),
          IconButton(
            tooltip: 'Adicionar jogo',
            icon: const Icon(Icons.add_rounded),
            onPressed: () => _addGame(context, ref),
          ),
        ],
      ),
      body: list.when(
        data: (value) => value.games.isEmpty
            ? const MessageState(
                icon: Icons.videogame_asset_off_rounded,
                message: 'Nenhum jogo nesta lista ainda.',
              )
            : RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(listDetailProvider(listId));
                  await ref.read(listsProvider.notifier).refresh();
                },
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: value.games.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, index) => _GameRow(
                    game: value.games[index],
                    onRemove: () => _removeGame(context, ref, value.games[index]),
                  ),
                ),
              ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => MessageState(
          icon: Icons.cloud_off_rounded,
          message: 'Não foi possível carregar a lista',
          actionLabel: 'Tentar novamente',
          onAction: () => ref.invalidate(listDetailProvider(listId)),
        ),
      ),
    );
  }

  Future<void> _removeGame(BuildContext context, WidgetRef ref, Game game) async {
    try {
      await ListsApi.removeGame(listId, game.id);
      ref.invalidate(listDetailProvider(listId));
      await ref.read(listsProvider.notifier).refresh();
    } catch (_) {
      if (!context.mounted) return;
      _snack(context, 'Não foi possível remover o jogo da lista.');
    }
  }

  Future<void> _addGame(BuildContext context, WidgetRef ref) async {
    final games = ref.read(gamesProvider).valueOrNull ?? const <Game>[];
    final current = ref.read(listDetailProvider(listId)).valueOrNull;
    final existing = current?.games.map((game) => game.id).toSet() ?? <String>{};
    final choices = games
        .where((game) => !existing.contains(game.id) && !game.archived)
        .toList()
      ..sort((a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));

    final picked = await showModalBottomSheet<Game>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1E2A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _GamePicker(games: choices),
    );
    if (picked == null) return;
    try {
      await ListsApi.addGame(listId, picked.id);
      ref.invalidate(listDetailProvider(listId));
      await ref.read(listsProvider.notifier).refresh();
    } catch (_) {
      if (!context.mounted) return;
      _snack(context, 'Não foi possível adicionar o jogo (talvez já esteja na lista).');
    }
  }

  Future<void> _queueFromList(BuildContext context, WidgetRef ref) async {
    try {
      final result = await QueueApi.addFromList(listId);
      await ref.read(queueProvider.notifier).refresh();
      if (!context.mounted) return;
      _snack(context, '${result.added} adicionados à fila · ${result.skipped} ignorados.');
    } catch (_) {
      if (!context.mounted) return;
      _snack(context, 'Não foi possível montar a fila a partir da lista.');
    }
  }

  static void _snack(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _GameRow extends StatelessWidget {
  final Game game;
  final VoidCallback onRemove;

  const _GameRow({required this.game, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF1E1E2A),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => GameDetailScreen(game: game)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(10),
          child: Row(
            children: [
              GameCover(coverUrl: game.coverUrl, width: 44, height: 58),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(game.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    StatusPill(status: game.status),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Remover da lista',
                onPressed: onRemove,
                icon: const Icon(Icons.remove_circle_outline, color: Color(0xFF6B6B7E)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Seletor de jogos da biblioteca para adicionar a uma lista.
class _GamePicker extends StatefulWidget {
  final List<Game> games;

  const _GamePicker({required this.games});

  @override
  State<_GamePicker> createState() => _GamePickerState();
}

class _GamePickerState extends State<_GamePicker> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final visible = widget.games
        .where((game) => game.title.toLowerCase().contains(_query.toLowerCase()))
        .toList();

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.75,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                autofocus: true,
                decoration: const InputDecoration(
                  hintText: 'Buscar jogo',
                  prefixIcon: Icon(Icons.search_rounded, color: Color(0xFF6B6B7E)),
                  isDense: true,
                ),
                onChanged: (value) => setState(() => _query = value),
              ),
            ),
            Expanded(
              child: visible.isEmpty
                  ? const MessageState(
                      icon: Icons.search_off_rounded,
                      message: 'Nenhum jogo disponível para adicionar.',
                    )
                  : ListView.builder(
                      itemCount: visible.length,
                      itemBuilder: (_, index) {
                        final game = visible[index];
                        return ListTile(
                          leading: GameCover(coverUrl: game.coverUrl, width: 36, height: 48),
                          title: Text(game.title),
                          subtitle: Text('${game.releaseYear ?? ''}'),
                          onTap: () => Navigator.pop(context, game),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
