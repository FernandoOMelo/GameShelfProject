import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/catalog.dart';
import '../models/game.dart';
import '../models/game_list.dart';
import '../models/saved_filter.dart';
import '../providers/catalog_provider.dart';
import '../providers/games_provider.dart';
import '../providers/lists_provider.dart';
import '../providers/saved_filters_provider.dart';
import '../widgets/game_cover.dart';
import '../widgets/section.dart';
import '../widgets/status.dart';
import '../core/lists_api.dart';
import 'game_detail_screen.dart';
import 'game_editor_screen.dart';
import 'quick_log_sheet.dart';

/// Estado dos filtros da biblioteca no app (espelha `LibraryFilterState`).
class _Filters {
  final String status;
  final String priority;
  final String platformId;
  final String genreId;
  final String franchiseId;
  final String developer;
  final String listId;
  final String completedYear;
  final bool archived;
  final String sortBy;

  const _Filters({
    this.status = 'ALL',
    this.priority = 'ALL',
    this.platformId = 'ALL',
    this.genreId = 'ALL',
    this.franchiseId = 'ALL',
    this.developer = 'ALL',
    this.listId = 'ALL',
    this.completedYear = 'ALL',
    this.archived = false,
    this.sortBy = 'TITLE',
  });

  factory _Filters.fromLibrary(LibraryFilterState state) => _Filters(
        status: state.status,
        priority: state.priority,
        platformId: state.platformId,
        genreId: state.genreId,
        franchiseId: state.franchiseId,
        developer: state.developer,
        listId: state.listId,
        completedYear: state.completedYear,
        archived: state.archived,
        sortBy: state.sortBy,
      );

  LibraryFilterState toLibrary(String query) => LibraryFilterState(
        query: query,
        status: status,
        priority: priority,
        platformId: platformId,
        genreId: genreId,
        franchiseId: franchiseId,
        developer: developer,
        listId: listId,
        completedYear: completedYear,
        archived: archived,
        sortBy: sortBy,
      );

  int get activeCount => [
        status,
        priority,
        platformId,
        genreId,
        franchiseId,
        developer,
        listId,
        completedYear,
      ].where((value) => value != 'ALL').length +
      (archived ? 1 : 0);

  bool get isDefault => activeCount == 0 && sortBy == 'TITLE';
}

class LibraryScreen extends ConsumerStatefulWidget {
  const LibraryScreen({super.key});

  @override
  ConsumerState<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends ConsumerState<LibraryScreen> {
  final _searchController = TextEditingController();
  _Filters _filters = const _Filters();
  bool _compact = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final games = ref.watch(gamesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Biblioteca'),
        actions: [
          IconButton(
            tooltip: _compact ? 'Visual confortável' : 'Visual compacto',
            icon: Icon(_compact ? Icons.view_agenda_outlined : Icons.view_list_rounded),
            onPressed: () => setState(() => _compact = !_compact),
          ),
          PopupMenuButton<String>(
            tooltip: 'Views salvas',
            icon: const Icon(Icons.bookmark_border_rounded),
            onSelected: _onSavedFilterAction,
            itemBuilder: (_) {
              final saved = ref.read(savedFiltersProvider).valueOrNull ?? const [];
              return <PopupMenuEntry<String>>[
                const PopupMenuItem(value: 'ALL', child: Text('Biblioteca completa')),
                for (final filter in saved)
                  PopupMenuItem(value: filter.id, child: Text(filter.name)),
                if (saved.isNotEmpty) const PopupMenuDivider(),
                if (saved.isNotEmpty) ...saved.map((filter) => PopupMenuItem(
                      value: 'del:${filter.id}',
                      child: Text('Excluir "${filter.name}"'),
                    )),
                const PopupMenuItem(value: 'save', child: Text('Salvar filtros atuais')),
              ];
            },
          ),
          IconButton(
            tooltip: 'Filtros',
            icon: Badge(
              isLabelVisible: _filters.activeCount > 0,
              label: Text('${_filters.activeCount}'),
              child: const Icon(Icons.tune_rounded),
            ),
            onPressed: _openFilters,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openEditor(null),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Jogo'),
      ),
      body: games.when(
        data: (all) => _body(all),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, _) => MessageState(
          icon: Icons.cloud_off_rounded,
          message: 'Não foi possível carregar a biblioteca',
          actionLabel: 'Tentar novamente',
          onAction: () => ref.read(gamesProvider.notifier).refresh(),
        ),
      ),
    );
  }

  Widget _body(List<Game> all) {
    final visible = _visibleGames(all);
    return RefreshIndicator(
      onRefresh: () => ref.read(gamesProvider.notifier).refresh(),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchController,
              decoration: const InputDecoration(
                hintText: 'Buscar na biblioteca',
                prefixIcon: Icon(Icons.search_rounded, color: Color(0xFF6B6B7E)),
                isDense: true,
              ),
              onChanged: (_) => setState(() {}),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '${visible.length} ${visible.length == 1 ? 'jogo' : 'jogos'}',
                    style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12),
                  ),
                ),
                if (!_filters.isDefault || _searchController.text.isNotEmpty)
                  TextButton(
                    onPressed: () => setState(() {
                      _searchController.clear();
                      _filters = const _Filters();
                    }),
                    child: const Text('Limpar'),
                  ),
              ],
            ),
          ),
          Expanded(
            child: visible.isEmpty
                ? const MessageState(
                    icon: Icons.videogame_asset_off_rounded,
                    message: 'Nenhum jogo encontrado',
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                    itemCount: visible.length,
                    separatorBuilder: (_, _) => SizedBox(height: _compact ? 6 : 10),
                    itemBuilder: (_, index) => _GameTile(
                      game: visible[index],
                      compact: _compact,
                      onEdit: () => _openEditor(visible[index]),
                      onDelete: () => _confirmDelete(visible[index]),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  List<Game> _visibleGames(List<Game> all) {
    final term = _searchController.text.trim().toLowerCase();
    final filtered = all.where((game) {
      if (_filters.archived != game.archived) return false;
      if (term.isNotEmpty && !game.title.toLowerCase().contains(term)) return false;
      if (_filters.status != 'ALL' && game.status != _filters.status) return false;
      if (_filters.priority != 'ALL' && game.priority != _filters.priority) return false;
      if (_filters.platformId != 'ALL' && game.platformId != _filters.platformId) return false;
      if (_filters.genreId != 'ALL' && !game.genreIds.contains(_filters.genreId)) return false;
      if (_filters.franchiseId != 'ALL' && game.franchiseId != _filters.franchiseId) return false;
      if (_filters.developer != 'ALL' && game.developer != _filters.developer) return false;
      if (_filters.listId != 'ALL' && !_listGameIds.contains(game.id)) return false;
      if (_filters.completedYear != 'ALL' &&
          !(game.completedAt ?? '').startsWith(_filters.completedYear)) {
        return false;
      }
      return true;
    }).toList();

    if (_filters.sortBy == 'TITLE') return filtered;
    final field = _filters.sortBy == 'STARTED_DESC' ? 'startedAt' : 'completedAt';
    filtered.sort((a, b) {
      final left = field == 'startedAt' ? a.startedAt : a.completedAt;
      final right = field == 'startedAt' ? b.startedAt : b.completedAt;
      if (left == right) return a.title.compareTo(b.title);
      if (left == null) return 1;
      if (right == null) return -1;
      return right.compareTo(left);
    });
    return filtered;
  }

  Set<String> _listGameIds = const {};

  Future<void> _loadListIds(String listId) async {
    if (listId == 'ALL') {
      setState(() => _listGameIds = const {});
      return;
    }
    try {
      final list = await ListsApi.get(listId);
      if (mounted) setState(() => _listGameIds = list.games.map((g) => g.id).toSet());
    } catch (_) {
      if (mounted) setState(() => _listGameIds = const {});
    }
  }

  Future<void> _openFilters() async {
    final games = ref.read(gamesProvider).valueOrNull ?? const <Game>[];
    final lists = ref.read(listsProvider).valueOrNull ?? const [];
    final platforms = ref.read(platformsProvider).valueOrNull ?? const <CatalogItem>[];
    final genres = ref.read(genresProvider).valueOrNull ?? const <CatalogItem>[];
    final franchises = ref.read(franchisesProvider).valueOrNull ?? const <CatalogItem>[];
    final developers = {
      for (final game in games) if (game.developer != null) game.developer!,
    }.toList()
      ..sort();
    final years = {
      for (final game in games)
        if (game.completedAt != null) game.completedAt!.substring(0, 4),
    }.toList()
      ..sort((a, b) => b.compareTo(a));

    final next = await showModalBottomSheet<_Filters>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1E2A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _FilterSheet(
        initial: _filters,
        lists: lists,
        platforms: platforms,
        genres: genres,
        franchises: franchises,
        developers: developers,
        years: years,
      ),
    );
    if (next != null) {
      setState(() => _filters = next);
      await _loadListIds(next.listId);
    }
  }

  Future<void> _onSavedFilterAction(String value) async {
    if (value == 'ALL') {
      setState(() {
        _searchController.clear();
        _filters = const _Filters();
      });
      await _loadListIds('ALL');
      return;
    }
    if (value == 'save') {
      await _saveCurrentFilters();
      return;
    }
    if (value.startsWith('del:')) {
      await ref.read(savedFiltersProvider.notifier).delete(value.substring(4));
      return;
    }
    final saved = (ref.read(savedFiltersProvider).valueOrNull ?? const <SavedFilter>[])
        .where((filter) => filter.id == value);
    if (saved.isEmpty) return;
    final chosen = saved.first;
    setState(() {
      _searchController.text = chosen.filters.query;
      _filters = _Filters.fromLibrary(chosen.filters);
    });
    await _loadListIds(chosen.filters.listId);
  }

  Future<void> _saveCurrentFilters() async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Salvar filtros'),
        content: TextField(
          controller: controller,
          autofocus: true,
          decoration: const InputDecoration(labelText: 'Nome do filtro'),
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
    if (name == null || name.isEmpty) return;
    try {
      await ref
          .read(savedFiltersProvider.notifier)
          .create(name, _filters.toLibrary(_searchController.text));
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Filtro "$name" salvo.')));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Não foi possível salvar o filtro.')),
        );
      }
    }
  }

  Future<void> _openEditor(Game? game) async {
    final saved = await Navigator.push<Game>(
      context,
      MaterialPageRoute(builder: (_) => GameEditorScreen(game: game)),
    );
    if (saved != null) await ref.read(gamesProvider.notifier).reload();
  }

  Future<void> _confirmDelete(Game game) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Excluir jogo'),
        content: Text(
          'Excluir ${game.title} e todo o histórico de sessões relacionado? '
          'Esta ação não pode ser desfeita.',
        ),
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
      await ref.read(gamesProvider.notifier).delete(game.id);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Não foi possível excluir o jogo.')),
        );
      }
    }
  }
}

class _GameTile extends StatelessWidget {
  final Game game;
  final bool compact;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _GameTile({
    required this.game,
    required this.compact,
    required this.onEdit,
    required this.onDelete,
  });

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
          padding: EdgeInsets.all(compact ? 8 : 10),
          child: Row(
            children: [
              GameCover(
                coverUrl: game.coverUrl,
                width: compact ? 40 : 52,
                height: compact ? 52 : 68,
              ),
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
                    Row(
                      children: [
                        StatusPill(status: game.status),
                        if (game.favorite) ...[
                          const SizedBox(width: 6),
                          const Icon(Icons.favorite, size: 13, color: Color(0xFFE53E3E)),
                        ],
                      ],
                    ),
                    if (!compact && (game.developer != null || game.releaseYear != null)) ...[
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
              IconButton(
                onPressed: () => showQuickLogSheet(context, game),
                tooltip: 'Registrar sessão',
                visualDensity: VisualDensity.compact,
                icon: const Icon(Icons.timer_outlined, color: Color(0xFF6B6B7E), size: 20),
              ),
              PopupMenuButton<String>(
                tooltip: 'Ações',
                icon: const Icon(Icons.more_vert_rounded, color: Color(0xFF6B6B7E), size: 20),
                onSelected: (value) {
                  if (value == 'edit') onEdit();
                  if (value == 'delete') onDelete();
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'edit', child: Text('Editar')),
                  PopupMenuItem(value: 'delete', child: Text('Excluir')),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Formulário de filtros em bottom sheet.
class _FilterSheet extends StatefulWidget {
  final _Filters initial;
  final List<GameListSummary> lists;
  final List<CatalogItem> platforms;
  final List<CatalogItem> genres;
  final List<CatalogItem> franchises;
  final List<String> developers;
  final List<String> years;

  const _FilterSheet({
    required this.initial,
    required this.lists,
    required this.platforms,
    required this.genres,
    required this.franchises,
    required this.developers,
    required this.years,
  });

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late String _status = widget.initial.status;
  late String _priority = widget.initial.priority;
  late String _platformId = widget.initial.platformId;
  late String _genreId = widget.initial.genreId;
  late String _franchiseId = widget.initial.franchiseId;
  late String _developer = widget.initial.developer;
  late String _listId = widget.initial.listId;
  late String _completedYear = widget.initial.completedYear;
  late bool _archived = widget.initial.archived;
  late String _sortBy = widget.initial.sortBy;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Filtros', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            _dropdown('Status da biblioteca', _status, {
              'ALL': 'Todos',
              ...statusLabels,
            }, (value) => setState(() => _status = value)),
            _dropdown('Prioridade', _priority, {'ALL': 'Todas', ...priorityLabels},
                (value) => setState(() => _priority = value)),
            _dropdown('Ordenar por', _sortBy, const {
              'TITLE': 'Título',
              'STARTED_DESC': 'Início mais recente',
              'COMPLETED_DESC': 'Conclusão mais recente',
            }, (value) => setState(() => _sortBy = value)),
            _dropdown(
              'Plataforma',
              _platformId,
              {'ALL': 'Todas', for (final item in widget.platforms) item.id: item.name},
              (value) => setState(() => _platformId = value),
            ),
            _dropdown(
              'Gênero',
              _genreId,
              {'ALL': 'Todos', for (final item in widget.genres) item.id: item.name},
              (value) => setState(() => _genreId = value),
            ),
            _dropdown(
              'Franquia',
              _franchiseId,
              {'ALL': 'Todas', for (final item in widget.franchises) item.id: item.name},
              (value) => setState(() => _franchiseId = value),
            ),
            if (widget.developers.isNotEmpty)
              _dropdown(
                'Desenvolvedor',
                _developer,
                {'ALL': 'Todos', for (final name in widget.developers) name: name},
                (value) => setState(() => _developer = value),
              ),
            if (widget.lists.isNotEmpty)
              _dropdown(
                'Lista',
                _listId,
                {'ALL': 'Todas', for (final item in widget.lists) item.id: item.name},
                (value) => setState(() => _listId = value),
              ),
            if (widget.years.isNotEmpty)
              _dropdown(
                'Ano de conclusão',
                _completedYear,
                {'ALL': 'Todos', for (final year in widget.years) year: year},
                (value) => setState(() => _completedYear = value),
              ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _archived,
              onChanged: (value) => setState(() => _archived = value),
              title: const Text('Mostrar arquivados'),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context, const _Filters()),
                    child: const Text('Limpar'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context, _Filters(
                      status: _status, priority: _priority, platformId: _platformId,
                      genreId: _genreId, franchiseId: _franchiseId, developer: _developer,
                      listId: _listId, completedYear: _completedYear, archived: _archived,
                      sortBy: _sortBy,
                    )),
                    child: const Text('Aplicar'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _dropdown(
    String label,
    String value,
    Map<String, String> options,
    ValueChanged<String> onChanged,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DropdownButtonFormField<String>(
        initialValue: options.containsKey(value) ? value : 'ALL',
        decoration: InputDecoration(labelText: label),
        items: [
          for (final entry in options.entries)
            DropdownMenuItem(value: entry.key, child: Text(entry.value)),
        ],
        onChanged: (next) {
          if (next != null) onChanged(next);
        },
      ),
    );
  }
}
