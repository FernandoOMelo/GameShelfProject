import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/queue_api.dart';
import '../models/game.dart';
import '../models/game_list.dart';
import '../models/queue_item.dart';
import '../providers/active_session_provider.dart';
import '../providers/games_provider.dart';
import '../providers/lists_provider.dart';
import '../providers/queue_provider.dart';
import '../widgets/game_cover.dart';

class QueueScreen extends ConsumerWidget {
  const QueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queueAsync = ref.watch(queueProvider);

    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openAddSource(context, ref),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Adicionar'),
      ),
      body: queueAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorView(onRetry: () => ref.invalidate(queueProvider)),
        data: (items) => items.isEmpty
            ? const _EmptyView()
            : _QueueList(items: items),
      ),
    );
  }

  Future<void> _openAddSource(BuildContext context, WidgetRef ref) async {
    final source = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: const Color(0xFF1E1E2A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _AddSourceSheet(),
    );
    if (!context.mounted || source == null) return;
    if (source == 'library') {
      await _pickFromLibrary(context, ref);
    } else if (source == 'list') {
      await _pickList(context, ref);
    }
  }

  Future<void> _pickFromLibrary(BuildContext context, WidgetRef ref) async {
    final queue = ref.read(queueProvider).valueOrNull ?? const <QueueItem>[];
    final inQueue = queue.map((item) => item.game.id).toSet();
    final games = (ref.read(gamesProvider).valueOrNull ?? const <Game>[])
        .where((game) => game.owned && !game.archived && !inQueue.contains(game.id))
        .toList()
      ..sort((a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));

    if (games.isEmpty) {
      _snack(context, 'Nenhum jogo disponível para adicionar à fila.');
      return;
    }

    final chosen = await showModalBottomSheet<Game>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1E2A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _LibraryPicker(games: games),
    );
    if (chosen == null) return;
    try {
      await ref.read(queueProvider.notifier).add(chosen);
      if (context.mounted) _snack(context, '${chosen.title} entrou na fila.');
    } catch (_) {
      if (context.mounted) _snack(context, 'Não foi possível adicionar à fila.');
    }
  }

  Future<void> _pickList(BuildContext context, WidgetRef ref) async {
    final lists = ref.read(listsProvider).valueOrNull ?? const <GameListSummary>[];
    if (lists.isEmpty) {
      _snack(context, 'Crie uma lista na aba Mais para montar a fila a partir dela.');
      return;
    }
    final chosen = await showDialog<GameListSummary>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Montar a fila a partir de uma lista'),
        children: [
          for (final list in lists)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(context, list),
              child: Text('${list.name} (${list.gameCount})'),
            ),
        ],
      ),
    );
    if (chosen == null) return;
    try {
      final result = await QueueApi.addFromList(chosen.id);
      await ref.read(queueProvider.notifier).refresh();
      if (context.mounted) {
        _snack(
          context,
          '${result.added} ${result.added == 1 ? 'jogo entrou' : 'jogos entraram'} na fila'
          '${result.skipped > 0 ? ' · ${result.skipped} ignorado(s)' : ''}.',
        );
      }
    } catch (_) {
      if (context.mounted) _snack(context, 'Não foi possível montar a fila a partir da lista.');
    }
  }

  static void _snack(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}

/// Escolha da origem dos jogos adicionados à fila.
class _AddSourceSheet extends StatelessWidget {
  const _AddSourceSheet();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 20, 20, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text('Adicionar à fila',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.video_library_outlined, color: Color(0xFF6C63FF)),
            title: const Text('Da biblioteca'),
            subtitle: const Text('Escolha um jogo da sua coleção'),
            onTap: () => Navigator.pop(context, 'library'),
          ),
          ListTile(
            leading: const Icon(Icons.bookmarks_outlined, color: Color(0xFF6C63FF)),
            title: const Text('De uma lista'),
            subtitle: const Text('Enfileira os jogos elegíveis da lista'),
            onTap: () => Navigator.pop(context, 'list'),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}

/// Seletor de jogo da biblioteca com busca.
class _LibraryPicker extends StatefulWidget {
  final List<Game> games;

  const _LibraryPicker({required this.games});

  @override
  State<_LibraryPicker> createState() => _LibraryPickerState();
}

class _LibraryPickerState extends State<_LibraryPicker> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final term = _search.text.trim().toLowerCase();
    final visible = widget.games
        .where((game) => term.isEmpty || game.title.toLowerCase().contains(term))
        .toList();

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.7,
        child: Column(
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 20, 20, 8),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text('Escolher jogo',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: TextField(
                controller: _search,
                decoration: const InputDecoration(
                  hintText: 'Buscar',
                  prefixIcon: Icon(Icons.search_rounded, color: Color(0xFF6B6B7E)),
                  isDense: true,
                ),
                onChanged: (_) => setState(() {}),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: visible.isEmpty
                  ? const Center(
                      child: Text('Nenhum jogo encontrado',
                          style: TextStyle(color: Color(0xFF8888A0))),
                    )
                  : ListView.builder(
                      itemCount: visible.length,
                      itemBuilder: (_, index) => ListTile(
                        leading: GameCover(coverUrl: visible[index].coverUrl, width: 36, height: 46),
                        title: Text(visible[index].title),
                        onTap: () => Navigator.pop(context, visible[index]),
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QueueList extends ConsumerStatefulWidget {
  final List<QueueItem> items;

  const _QueueList({required this.items});

  @override
  ConsumerState<_QueueList> createState() => _QueueListState();
}

class _QueueListState extends ConsumerState<_QueueList> {
  late List<QueueItem> _items;

  @override
  void initState() {
    super.initState();
    _items = List.from(widget.items);
  }

  @override
  void didUpdateWidget(_QueueList old) {
    super.didUpdateWidget(old);
    if (old.items != widget.items) {
      _items = List.from(widget.items);
    }
  }

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverAppBar(
          title: Text('Fila (${_items.length})'),
          pinned: true,
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: () => ref.invalidate(queueProvider),
            ),
          ],
        ),
        SliverReorderableList(
          itemCount: _items.length,
          onReorderItem: _onReorder,
          itemBuilder: (context, i) {
            final item = _items[i];
            return Dismissible(
              key: ValueKey('queue-dismiss-${item.game.id}'),
              direction: DismissDirection.endToStart,
              onDismissed: (_) => _remove(item),
              background: const _RemoveBackground(),
              child: _QueueCard(
                key: ValueKey(item.game.id),
                item: item,
                position: i + 1,
                canMoveUp: i > 0,
                canMoveDown: i < _items.length - 1,
                onMoveUp: () => _moveBy(i, -1),
                onMoveDown: () => _moveBy(i, 1),
                onRemove: () => _remove(item),
              ),
            );
          },
        ),
      ],
    );
  }

  void _onReorder(int oldIndex, int newIndex) {
    setState(() {
      final item = _items.removeAt(oldIndex);
      _items.insert(newIndex, item);
    });
    _persistOrder();
  }

  /// Move o item uma posição para cima ou para baixo (equivalente às setas da web).
  void _moveBy(int index, int delta) {
    final target = index + delta;
    if (target < 0 || target >= _items.length) return;
    setState(() {
      final item = _items.removeAt(index);
      _items.insert(target, item);
    });
    _persistOrder();
  }

  void _persistOrder() {
    final gameIds = _items.map((item) => item.game.id).toList();
    ref.read(queueProvider.notifier).reorder(gameIds);
  }

  Future<void> _remove(QueueItem item) async {
    final index = _items.indexWhere((entry) => entry.game.id == item.game.id);
    if (index < 0) return;
    final messenger = ScaffoldMessenger.of(context);
    // Some da lista na hora: deslizar precisa de resposta imediata.
    setState(() => _items.removeAt(index));
    try {
      await ref.read(queueProvider.notifier).remove(item.game.id);
    } catch (_) {
      if (!mounted) return;
      setState(() => _items.insert(index, item));
      messenger.showSnackBar(
        const SnackBar(content: Text('Não foi possível remover da fila.')),
      );
      return;
    }
    if (!mounted) return;
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text('${item.game.title} saiu da fila'),
        action: SnackBarAction(
          label: 'Desfazer',
          onPressed: () => _undo(item, index),
        ),
      ),
    );
  }

  Future<void> _undo(QueueItem item, int index) async {
    try {
      await ref.read(queueProvider.notifier).restore(item, index);
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Não foi possível desfazer.')),
      );
    }
  }
}

/// Fundo revelado ao deslizar o card da fila para a esquerda.
class _RemoveBackground extends StatelessWidget {
  const _RemoveBackground();

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.centerRight,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.only(right: 24),
      decoration: BoxDecoration(
        color: const Color(0xFFE53E3E),
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.remove_circle_outline, color: Colors.white, size: 20),
          SizedBox(width: 8),
          Text(
            'Remover',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class _QueueCard extends ConsumerWidget {
  final QueueItem item;
  final int position;
  final bool canMoveUp;
  final bool canMoveDown;
  final VoidCallback onMoveUp;
  final VoidCallback onMoveDown;
  final VoidCallback onRemove;

  const _QueueCard({
    super.key,
    required this.item,
    required this.position,
    required this.canMoveUp,
    required this.canMoveDown,
    required this.onMoveUp,
    required this.onMoveDown,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final game = item.game;
    final sessionState = ref.watch(activeSessionProvider);
    final isActive = sessionState.hasActive && sessionState.game?.id == game.id;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        child: Row(
          children: [
            ReorderableDragStartListener(
              index: position - 1,
              child: const Padding(
                padding: EdgeInsets.only(right: 10),
                child: Icon(Icons.drag_handle_rounded, color: Color(0xFF6B6B7E)),
              ),
            ),
            Container(
              width: 26,
              alignment: Alignment.center,
              child: Text(
                '$position',
                style: const TextStyle(
                  color: Color(0xFF6C63FF),
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
            ),
            const SizedBox(width: 10),
            GameCover(coverUrl: game.coverUrl, width: 48, height: 62),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    game.title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  if (game.estimatedMainHours != null) ...[
                    const SizedBox(height: 3),
                    Text(
                      '~${game.estimatedMainHours!.toStringAsFixed(0)}h',
                      style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: 8),
            if (!isActive)
              _StartButton(game: game)
            else
              const Chip(
                label: Text('Ativo', style: TextStyle(fontSize: 11)),
                backgroundColor: Color(0xFF1A3A2A),
                labelStyle: TextStyle(color: Color(0xFF48BB78)),
                padding: EdgeInsets.zero,
              ),
            PopupMenuButton<String>(
              tooltip: 'Ações',
              icon: const Icon(Icons.more_vert_rounded, size: 20, color: Color(0xFF6B6B7E)),
              padding: EdgeInsets.zero,
              onSelected: (value) {
                if (value == 'up') onMoveUp();
                if (value == 'down') onMoveDown();
                if (value == 'remove') onRemove();
              },
              itemBuilder: (_) => [
                PopupMenuItem(
                  value: 'up',
                  enabled: canMoveUp,
                  child: const Text('Mover para cima'),
                ),
                PopupMenuItem(
                  value: 'down',
                  enabled: canMoveDown,
                  child: const Text('Mover para baixo'),
                ),
                const PopupMenuDivider(),
                const PopupMenuItem(
                  value: 'remove',
                  child: Text('Remover', style: TextStyle(color: Color(0xFFE53E3E))),
                ),
              ],
            ),
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
    return IconButton(
      onPressed: loading ? null : () => ref.read(activeSessionProvider.notifier).start(game),
      icon: const Icon(Icons.play_arrow_rounded),
      color: const Color(0xFF6C63FF),
      padding: EdgeInsets.zero,
      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
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
          Icon(Icons.queue_rounded, size: 64, color: Color(0xFF4A4A5A)),
          SizedBox(height: 16),
          Text(
            'Fila vazia',
            style: TextStyle(color: Color(0xFF8888A0), fontSize: 16),
          ),
          SizedBox(height: 8),
          Text(
            'Adicione jogos pela biblioteca ou por uma lista',
            style: TextStyle(color: Color(0xFF6B6B7E), fontSize: 14),
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final VoidCallback onRetry;

  const _ErrorView({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_rounded, size: 48, color: Color(0xFF8888A0)),
          const SizedBox(height: 16),
          const Text(
            'Não foi possível carregar a fila',
            style: TextStyle(color: Color(0xFF8888A0)),
          ),
          const SizedBox(height: 16),
          TextButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Tentar novamente'),
          ),
        ],
      ),
    );
  }
}
