import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/metadata_api.dart';
import '../models/game.dart';
import '../models/metadata.dart';
import '../providers/catalog_provider.dart';
import '../providers/games_provider.dart';

/// Resultado do cadastro rápido: o jogo criado ou o pedido de abrir o editor completo.
class QuickAddResult {
  final Game? game;
  final String? moreDetailsTitle;

  const QuickAddResult.created(Game this.game) : moreDetailsTitle = null;
  const QuickAddResult.moreDetails(String this.moreDetailsTitle) : game = null;
}

/// Cadastro rápido (ADR-043): título, plataforma e pronto. Capa, descrição, ano e
/// gêneros chegam sozinhos pela captura automática no servidor.
class QuickAddGameSheet extends ConsumerStatefulWidget {
  final Future<List<GameMetadataCandidate>> Function(String query) search;
  final Duration debounce;

  const QuickAddGameSheet({
    super.key,
    this.search = MetadataApi.searchGames,
    this.debounce = const Duration(milliseconds: 600),
  });

  @override
  ConsumerState<QuickAddGameSheet> createState() => _QuickAddGameSheetState();
}

class _QuickAddGameSheetState extends ConsumerState<QuickAddGameSheet> {
  final _title = TextEditingController();
  Timer? _timer;
  List<GameMetadataCandidate> _suggestions = const [];
  String? _platformId;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _timer?.cancel();
    _title.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _timer?.cancel();
    final query = value.trim();
    if (query.length < 3) {
      setState(() => _suggestions = const []);
      return;
    }
    _timer = Timer(widget.debounce, () async {
      try {
        final found = await widget.search(query);
        if (mounted && _title.text.trim() == query) setState(() => _suggestions = found.take(3).toList());
      } catch (_) {
        // Sem provedor configurado ou sem rede: o cadastro segue sem sugestões.
      }
    });
  }

  Future<void> _add() async {
    final title = _title.text.trim();
    if (title.isEmpty) {
      setState(() => _error = 'Informe o título do jogo.');
      return;
    }
    setState(() { _saving = true; _error = null; });
    try {
      final game = await ref.read(gamesProvider.notifier).create(Game(id: '', title: title, status: 'BACKLOG', platformId: _platformId));
      if (mounted) Navigator.pop(context, QuickAddResult.created(game));
    } catch (_) {
      if (mounted) setState(() { _saving = false; _error = 'Não foi possível adicionar o jogo.'; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final platforms = ref.watch(platformsProvider);
    return Padding(
      padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 24),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Adicionar jogo', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            const Text('Digite o nome. Capa, ano, gêneros e descrição são buscados sozinhos depois.', style: TextStyle(color: Color(0xFF8888A0), fontSize: 13)),
            const SizedBox(height: 16),
            TextField(
              controller: _title,
              autofocus: true,
              textCapitalization: TextCapitalization.words,
              onChanged: _onChanged,
              onSubmitted: (_) => _add(),
              decoration: InputDecoration(labelText: 'Título *', errorText: _error),
            ),
            if (_suggestions.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Wrap(spacing: 8, runSpacing: 4, children: [
                  for (final item in _suggestions)
                    ActionChip(
                      label: Text(item.releaseYear == null ? item.title : '${item.title} (${item.releaseYear})'),
                      onPressed: () => setState(() { _title.text = item.title; _suggestions = const []; }),
                    ),
                ]),
              ),
            const SizedBox(height: 12),
            platforms.when(
              data: (items) => DropdownButtonFormField<String?>(
                initialValue: _platformId,
                decoration: const InputDecoration(labelText: 'Plataforma (opcional)'),
                items: [
                  const DropdownMenuItem(value: null, child: Text('—')),
                  for (final item in items) DropdownMenuItem(value: item.id, child: Text(item.name)),
                ],
                onChanged: (value) => setState(() => _platformId = value),
              ),
              loading: () => const LinearProgressIndicator(),
              error: (_, _) => const SizedBox.shrink(),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(onPressed: _saving ? null : _add, child: const Text('Adicionar')),
            ),
            TextButton(
              onPressed: _saving ? null : () => Navigator.pop(context, QuickAddResult.moreDetails(_title.text.trim())),
              child: const Text('Mais detalhes'),
            ),
          ],
        ),
      ),
    );
  }
}
