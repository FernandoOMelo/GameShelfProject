import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/game_list.dart';
import '../providers/lists_provider.dart';
import '../widgets/section.dart';
import 'list_detail_screen.dart';

class ListsScreen extends ConsumerWidget {
  const ListsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lists = ref.watch(listsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Listas'),
        actions: [
          IconButton(
            tooltip: 'Atualizar',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.read(listsProvider.notifier).refresh(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _create(context, ref),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Lista'),
      ),
      body: lists.when(
        data: (items) => items.isEmpty
            ? const MessageState(
                icon: Icons.bookmarks_outlined,
                message: 'Nenhuma lista ainda.\nCrie uma para organizar sua coleção.',
              )
            : RefreshIndicator(
                onRefresh: () => ref.read(listsProvider.notifier).refresh(),
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, index) => _ListTile(
                    list: items[index],
                    onRename: () => _rename(context, ref, items[index]),
                    onDelete: () => _delete(context, ref, items[index]),
                  ),
                ),
              ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => MessageState(
          icon: Icons.cloud_off_rounded,
          message: 'Não foi possível carregar as listas',
          actionLabel: 'Tentar novamente',
          onAction: () => ref.read(listsProvider.notifier).refresh(),
        ),
      ),
    );
  }

  Future<void> _create(BuildContext context, WidgetRef ref) async {
    final name = await _askName(context, title: 'Nova lista');
    if (name == null || name.isEmpty) return;
    try {
      await ref.read(listsProvider.notifier).create(name);
    } catch (_) {
      if (!context.mounted) return;
      _snack(context, 'Não foi possível criar a lista. Talvez o nome já exista.');
    }
  }

  Future<void> _rename(BuildContext context, WidgetRef ref, GameListSummary list) async {
    final name = await _askName(context, title: 'Renomear lista', initial: list.name);
    if (name == null || name.isEmpty || name == list.name) return;
    try {
      await ref.read(listsProvider.notifier).rename(list.id, name);
    } catch (_) {
      if (!context.mounted) return;
      _snack(context, 'Não foi possível renomear a lista.');
    }
  }

  Future<void> _delete(BuildContext context, WidgetRef ref, GameListSummary list) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Excluir lista'),
        content: Text('Excluir a lista "${list.name}"? Os jogos continuam na biblioteca.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancelar')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Excluir', style: TextStyle(color: Color(0xFFE53E3E))),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(listsProvider.notifier).delete(list.id);
    } catch (_) {
      if (!context.mounted) return;
      _snack(context, 'Não foi possível excluir a lista.');
    }
  }

  static Future<String?> _askName(
    BuildContext context, {
    required String title,
    String? initial,
  }) {
    final controller = TextEditingController(text: initial);
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          autofocus: true,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(labelText: 'Nome'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          TextButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Salvar'),
          ),
        ],
      ),
    );
  }

  static void _snack(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _ListTile extends StatelessWidget {
  final GameListSummary list;
  final VoidCallback onRename;
  final VoidCallback onDelete;

  const _ListTile({required this.list, required this.onRename, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF1E1E2A),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => ListDetailScreen(listId: list.id)),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: [
              const Icon(Icons.bookmarks_rounded, color: Color(0xFF6C63FF)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(list.name,
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                    const SizedBox(height: 2),
                    Text(
                      '${list.gameCount} ${list.gameCount == 1 ? 'jogo' : 'jogos'}',
                      style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12),
                    ),
                  ],
                ),
              ),
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert_rounded, color: Color(0xFF6B6B7E), size: 20),
                onSelected: (value) => value == 'rename' ? onRename() : onDelete(),
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'rename', child: Text('Renomear')),
                  PopupMenuItem(
                    value: 'delete',
                    child: Text('Excluir', style: TextStyle(color: Color(0xFFE53E3E))),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
