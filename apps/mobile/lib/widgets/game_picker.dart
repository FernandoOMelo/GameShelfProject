import 'package:flutter/material.dart';
import '../models/game.dart';
import 'game_cover.dart';

String _fold(String value) {
  const from = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
  const to = 'aaaaaeeeeiiiiooooouuuucn';
  final lower = value.toLowerCase();
  final buffer = StringBuffer();
  for (final rune in lower.runes) {
    final char = String.fromCharCode(rune);
    final index = from.indexOf(char);
    buffer.write(index >= 0 ? to[index] : char);
  }
  return buffer.toString();
}

/// Escolhe um jogo da biblioteca por busca. Os [suggestedIds] aparecem antes,
/// marcados como "mesmo título" (usados pela mesclagem de duplicados).
Future<Game?> pickGame(
  BuildContext context, {
  required String title,
  required List<Game> games,
  Set<String> excludeIds = const {},
  Set<String> suggestedIds = const {},
}) {
  return showModalBottomSheet<Game>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(0xFF1E1E2A),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
    builder: (_) => _GamePickerSheet(
      title: title,
      games: games.where((game) => !excludeIds.contains(game.id)).toList(),
      suggestedIds: suggestedIds,
    ),
  );
}

class _GamePickerSheet extends StatefulWidget {
  final String title;
  final List<Game> games;
  final Set<String> suggestedIds;

  const _GamePickerSheet({required this.title, required this.games, required this.suggestedIds});

  @override
  State<_GamePickerSheet> createState() => _GamePickerSheetState();
}

class _GamePickerSheetState extends State<_GamePickerSheet> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _fold(_search.text.trim());
    final matches = widget.games.where((game) => query.isEmpty || _fold(game.title).contains(query)).toList()
      ..sort((a, b) {
        final sa = widget.suggestedIds.contains(a.id) ? 0 : 1;
        final sb = widget.suggestedIds.contains(b.id) ? 0 : 1;
        return sa != sb ? sa.compareTo(sb) : a.title.compareTo(b.title);
      });
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 12 + MediaQuery.of(context).viewInsets.bottom),
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.7,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              TextField(
                controller: _search,
                autofocus: true,
                decoration: const InputDecoration(hintText: 'Buscar jogo', prefixIcon: Icon(Icons.search_rounded)),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: matches.isEmpty
                    ? const Center(child: Text('Nenhum jogo encontrado.', style: TextStyle(color: Color(0xFF8888A0))))
                    : ListView.builder(
                        itemCount: matches.length,
                        itemBuilder: (_, index) {
                          final game = matches[index];
                          final suggested = widget.suggestedIds.contains(game.id);
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: GameCover(coverUrl: game.coverUrl, width: 36, height: 48, borderRadius: BorderRadius.circular(6)),
                            title: Text(game.title, maxLines: 2, overflow: TextOverflow.ellipsis),
                            subtitle: Text(
                              [if (game.releaseYear != null) '${game.releaseYear}', if (suggested) 'mesmo título'].join(' · '),
                              style: TextStyle(color: suggested ? const Color(0xFF9E97FF) : const Color(0xFF8888A0), fontSize: 12),
                            ),
                            onTap: () => Navigator.pop(context, game),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
