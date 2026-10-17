/// Estado dos filtros da biblioteca (`libraryFilterStateSchema`).
///
/// É o mesmo objeto que a web salva como "view salva": manter a forma idêntica
/// permite criar e aplicar filtros salvos no celular usando a mesma rota.
class LibraryFilterState {
  final String query;
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

  const LibraryFilterState({
    this.query = '',
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

  factory LibraryFilterState.fromJson(Map<String, dynamic> json) => LibraryFilterState(
        query: json['query'] as String? ?? '',
        status: json['status'] as String? ?? 'ALL',
        priority: json['priority'] as String? ?? 'ALL',
        platformId: json['platformId'] as String? ?? 'ALL',
        genreId: json['genreId'] as String? ?? 'ALL',
        franchiseId: json['franchiseId'] as String? ?? 'ALL',
        developer: json['developer'] as String? ?? 'ALL',
        listId: json['listId'] as String? ?? 'ALL',
        completedYear: json['completedYear'] as String? ?? 'ALL',
        archived: json['archived'] as bool? ?? false,
        sortBy: json['sortBy'] as String? ?? 'TITLE',
      );

  Map<String, dynamic> toJson() => {
        'query': query,
        'status': status,
        'priority': priority,
        'platformId': platformId,
        'genreId': genreId,
        'franchiseId': franchiseId,
        'developer': developer,
        'listId': listId,
        'completedYear': completedYear,
        'archived': archived,
        'sortBy': sortBy,
      };
}

/// Filtro salvo (`savedFilterSchema`).
class SavedFilter {
  final String id;
  final String name;
  final LibraryFilterState filters;

  const SavedFilter({
    required this.id,
    required this.name,
    required this.filters,
  });

  factory SavedFilter.fromJson(Map<String, dynamic> json) => SavedFilter(
        id: json['id'] as String,
        name: json['name'] as String,
        filters: LibraryFilterState.fromJson(
          json['filters'] as Map<String, dynamic>,
        ),
      );
}
