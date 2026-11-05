import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/metadata_sync_api.dart';
import '../models/metadata_sync.dart';
import '../providers/games_provider.dart';
import '../providers/metadata_sync_provider.dart';
import '../widgets/game_cover.dart';
import '../widgets/section.dart';

const _muted = Color(0xFF8888A0);

/// Jogos cujos metadados a captura automática aplicou sozinha, não achou ou
/// precisa que você escolha (ADR-043).
class MetadataReviewScreen extends ConsumerStatefulWidget {
  const MetadataReviewScreen({super.key});

  @override
  ConsumerState<MetadataReviewScreen> createState() => _MetadataReviewScreenState();
}

class _MetadataReviewScreenState extends ConsumerState<MetadataReviewScreen> {
  bool _running = false;
  String? _message;

  Future<void> _act(Future<void> Function() action, {String? done}) async {
    try {
      await action();
      ref.invalidate(metadataReviewProvider);
      ref.invalidate(gamesProvider);
      if (done != null && mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(done)));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Não foi possível concluir a ação.')));
    }
  }

  Future<void> _run() async {
    setState(() { _running = true; _message = null; });
    try {
      final checked = await MetadataSyncApi.run();
      ref.invalidate(metadataReviewProvider);
      ref.invalidate(gamesProvider);
      if (mounted) setState(() => _message = checked == 0 ? 'Nenhum jogo pendente.' : '$checked jogo(s) consultado(s).');
    } catch (_) {
      if (mounted) setState(() => _message = 'Não foi possível buscar agora.');
    } finally {
      if (mounted) setState(() => _running = false);
    }
  }

  Future<void> _searchAnother(MetadataSyncItem item) async {
    final controller = TextEditingController(text: item.title);
    final query = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Buscar outro título'),
        content: TextField(controller: controller, autofocus: true, decoration: const InputDecoration(labelText: 'Título no IGDB')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
          ElevatedButton(onPressed: () => Navigator.pop(context, controller.text.trim()), child: const Text('Buscar')),
        ],
      ),
    );
    controller.dispose();
    if (query == null || query.isEmpty) return;
    await _act(() => MetadataSyncApi.search(item.gameId, query));
  }

  @override
  Widget build(BuildContext context) {
    final review = ref.watch(metadataReviewProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Metadados a revisar')),
      body: review.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => MessageState(
          icon: Icons.cloud_off_rounded,
          message: 'Não foi possível carregar a revisão',
          actionLabel: 'Tentar novamente',
          onAction: () => ref.invalidate(metadataReviewProvider),
        ),
        data: (data) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            const Text(
              'A API busca capa, descrição, ano, gêneros e mais sozinha. Aqui estão os jogos em que ela aplicou algo para você confirmar, '
              'ou que precisam de uma escolha.',
              style: TextStyle(color: _muted, fontSize: 13),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _running ? null : _run,
              icon: _running
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.travel_explore_rounded),
              label: const Text('Buscar metadados pendentes'),
            ),
            if (_message != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_message!, style: const TextStyle(color: _muted, fontSize: 12))),
            const SizedBox(height: 16),
            if (data.items.isEmpty)
              const MessageState(icon: Icons.check_circle_outline_rounded, message: 'Nada para revisar')
            else
              for (final item in data.items) _ItemCard(item: item, onAct: _act, onSearch: () => _searchAnother(item)),
          ],
        ),
      ),
    );
  }
}

class _ItemCard extends StatelessWidget {
  final MetadataSyncItem item;
  final Future<void> Function(Future<void> Function() action, {String? done}) onAct;
  final VoidCallback onSearch;

  const _ItemCard({required this.item, required this.onAct, required this.onSearch});

  @override
  Widget build(BuildContext context) {
    final applied = item.status == 'APPLIED_AUTO';
    final notFound = item.status == 'NOT_FOUND';
    final fields = item.appliedFields.map((field) => metadataFieldLabels[field] ?? field).join(', ');
    return Card(
      key: ValueKey('metadata-${item.gameId}'),
      color: const Color(0xFF1E1E2A),
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              GameCover(coverUrl: item.coverUrl, width: 44, height: 58),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(item.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                  const SizedBox(height: 2),
                  Text(
                    applied
                        ? 'Preenchido sozinho${fields.isEmpty ? '' : ': $fields'}'
                        : notFound
                            ? 'Nada encontrado com este título'
                            : 'Mais de um resultado possível',
                    style: const TextStyle(color: _muted, fontSize: 12),
                  ),
                ]),
              ),
            ]),
            if (!applied && !notFound)
              for (final candidate in item.candidates.take(5))
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: Text(candidate.title),
                  subtitle: Text([if (candidate.releaseYear != null) '${candidate.releaseYear}', if (candidate.developer != null) candidate.developer!].join(' · ')),
                  trailing: TextButton(
                    onPressed: () => onAct(() => MetadataSyncApi.use(item.gameId, candidate.providerId), done: 'Metadados aplicados.'),
                    child: const Text('Usar este'),
                  ),
                ),
            const SizedBox(height: 4),
            Wrap(spacing: 8, children: [
              if (applied) ...[
                ElevatedButton(onPressed: () => onAct(() => MetadataSyncApi.confirm(item.gameId), done: 'Confirmado.'), child: const Text('Confirmar')),
                OutlinedButton(onPressed: () => onAct(() => MetadataSyncApi.undo(item.gameId), done: 'Desfeito.'), child: const Text('Desfazer')),
              ] else ...[
                OutlinedButton(onPressed: onSearch, child: const Text('Buscar outro')),
                TextButton(onPressed: () => onAct(() => MetadataSyncApi.ignore(item.gameId)), child: const Text('Ignorar')),
              ],
            ]),
          ],
        ),
      ),
    );
  }
}
