import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/queue_provider.dart';
import '../providers/active_session_provider.dart';
import '../models/queue_item.dart';
import '../widgets/game_cover.dart';

class QueueScreen extends ConsumerWidget {
  const QueueScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final queueAsync = ref.watch(queueProvider);

    return Scaffold(
      body: queueAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorView(onRetry: () => ref.invalidate(queueProvider)),
        data: (items) => items.isEmpty
            ? const _EmptyView()
            : _QueueList(items: items),
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
            return _QueueCard(
              key: ValueKey(item.game.id),
              item: item,
              position: i + 1,
              onRemove: () => _remove(item),
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
    final gameIds = _items.map((e) => e.game.id).toList();
    ref.read(queueProvider.notifier).reorder(gameIds);
  }

  Future<void> _remove(QueueItem item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E2A),
        title: const Text('Remover da fila?'),
        content: Text(item.game.title),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancelar')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remover', style: TextStyle(color: Color(0xFFE53E3E))),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(queueProvider.notifier).remove(item.game.id);
    }
  }
}

class _QueueCard extends ConsumerWidget {
  final QueueItem item;
  final int position;
  final VoidCallback onRemove;

  const _QueueCard({
    super.key,
    required this.item,
    required this.position,
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
            const SizedBox(width: 4),
            IconButton(
              onPressed: onRemove,
              icon: const Icon(Icons.remove_circle_outline, size: 20),
              color: const Color(0xFF6B6B7E),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
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
            'Adicione jogos no site para ver aqui',
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
