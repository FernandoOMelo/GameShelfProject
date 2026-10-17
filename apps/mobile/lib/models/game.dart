/// Jogo da biblioteca. Espelha `gameSchema` de `packages/contracts`.
///
/// As datas de ciclo de vida (`startedAt`/`completedAt`) são datas de calendário
/// (`YYYY-MM-DD`) e por isso ficam como `String?`, exatamente como a API as devolve:
/// convertê-las para `DateTime` traria fuso horário para um dado sem hora.
class Game {
  final String id;
  final String title;
  final String? description;
  final String? coverUrl;
  final String? backgroundUrl;
  final int? releaseYear;
  final String? developer;
  final String? publisher;
  final String? franchiseId;
  final String? platformId;
  final List<String> genreIds;
  final String status;
  final int? rating;
  final String? difficulty;
  final String? gameType;
  final String? completionCondition;
  final bool favorite;
  final bool gameOfYear;
  final bool excludedFromSuggestions;
  final bool owned;
  final bool archived;
  final String? startedAt;
  final String? completedAt;
  final String priority;
  final double? estimatedMainHours;
  final double? estimatedCompletionistHours;
  final double? personalEstimatedHours;
  final double retroactivePlayedHours;
  final String? notes;
  final String? createdAt;
  final String? updatedAt;

  const Game({
    required this.id,
    required this.title,
    required this.status,
    this.description,
    this.coverUrl,
    this.backgroundUrl,
    this.releaseYear,
    this.developer,
    this.publisher,
    this.franchiseId,
    this.platformId,
    this.genreIds = const [],
    this.rating,
    this.difficulty,
    this.gameType,
    this.completionCondition,
    this.favorite = false,
    this.gameOfYear = false,
    this.excludedFromSuggestions = false,
    this.owned = false,
    this.archived = false,
    this.startedAt,
    this.completedAt,
    this.priority = 'NORMAL',
    this.estimatedMainHours,
    this.estimatedCompletionistHours,
    this.personalEstimatedHours,
    this.retroactivePlayedHours = 0,
    this.notes,
    this.createdAt,
    this.updatedAt,
  });

  factory Game.fromJson(Map<String, dynamic> json) => Game(
        id: json['id'] as String,
        title: json['title'] as String,
        status: json['status'] as String,
        description: json['description'] as String?,
        coverUrl: json['coverUrl'] as String?,
        backgroundUrl: json['backgroundUrl'] as String?,
        releaseYear: json['releaseYear'] as int?,
        developer: json['developer'] as String?,
        publisher: json['publisher'] as String?,
        franchiseId: json['franchiseId'] as String?,
        platformId: json['platformId'] as String?,
        genreIds: (json['genreIds'] as List<dynamic>? ?? const [])
            .map((e) => e as String)
            .toList(),
        rating: json['rating'] as int?,
        difficulty: json['difficulty'] as String?,
        gameType: json['gameType'] as String?,
        completionCondition: json['completionCondition'] as String?,
        favorite: json['favorite'] as bool? ?? false,
        gameOfYear: json['gameOfYear'] as bool? ?? false,
        excludedFromSuggestions: json['excludedFromSuggestions'] as bool? ?? false,
        owned: json['owned'] as bool? ?? false,
        archived: json['archived'] as bool? ?? false,
        startedAt: json['startedAt'] as String?,
        completedAt: json['completedAt'] as String?,
        priority: json['priority'] as String? ?? 'NORMAL',
        estimatedMainHours: (json['estimatedMainHours'] as num?)?.toDouble(),
        estimatedCompletionistHours:
            (json['estimatedCompletionistHours'] as num?)?.toDouble(),
        personalEstimatedHours: (json['personalEstimatedHours'] as num?)?.toDouble(),
        retroactivePlayedHours:
            (json['retroactivePlayedHours'] as num?)?.toDouble() ?? 0,
        notes: json['notes'] as String?,
        createdAt: json['createdAt'] as String?,
        updatedAt: json['updatedAt'] as String?,
      );

  /// Payload de criação/atualização (`gameInputSchema`/`gameUpdateSchema`).
  ///
  /// Campos nulos são omitidos: os schemas usam `.strict()` e tratam os valores
  /// ausentes como "não alterar" no `PATCH`.
  Map<String, dynamic> toInputJson() => {
        'title': title,
        'description': description,
        'coverUrl': coverUrl,
        'backgroundUrl': backgroundUrl,
        'releaseYear': releaseYear,
        'developer': developer,
        'publisher': publisher,
        'franchiseId': franchiseId,
        'platformId': platformId,
        'genreIds': genreIds,
        'status': status,
        'rating': rating,
        'difficulty': difficulty,
        'gameType': gameType,
        'completionCondition': completionCondition,
        'favorite': favorite,
        'gameOfYear': gameOfYear,
        'excludedFromSuggestions': excludedFromSuggestions,
        'owned': owned,
        'archived': archived,
        'startedAt': startedAt,
        'completedAt': completedAt,
        'priority': priority,
        'estimatedMainHours': estimatedMainHours,
        'estimatedCompletionistHours': estimatedCompletionistHours,
        'personalEstimatedHours': personalEstimatedHours,
        'retroactivePlayedHours': retroactivePlayedHours,
        'notes': notes,
      };

  Game copyWith({
    String? title,
    String? status,
    String? priority,
    bool? favorite,
    bool? gameOfYear,
    bool? archived,
    int? rating,
    String? difficulty,
    String? startedAt,
    String? completedAt,
    double? retroactivePlayedHours,
  }) =>
      Game(
        id: id,
        title: title ?? this.title,
        status: status ?? this.status,
        description: description,
        coverUrl: coverUrl,
        backgroundUrl: backgroundUrl,
        releaseYear: releaseYear,
        developer: developer,
        publisher: publisher,
        franchiseId: franchiseId,
        platformId: platformId,
        genreIds: genreIds,
        rating: rating ?? this.rating,
        difficulty: difficulty ?? this.difficulty,
        gameType: gameType,
        completionCondition: completionCondition,
        favorite: favorite ?? this.favorite,
        gameOfYear: gameOfYear ?? this.gameOfYear,
        excludedFromSuggestions: excludedFromSuggestions,
        owned: owned,
        archived: archived ?? this.archived,
        startedAt: startedAt ?? this.startedAt,
        completedAt: completedAt ?? this.completedAt,
        priority: priority ?? this.priority,
        estimatedMainHours: estimatedMainHours,
        estimatedCompletionistHours: estimatedCompletionistHours,
        personalEstimatedHours: personalEstimatedHours,
        retroactivePlayedHours: retroactivePlayedHours ?? this.retroactivePlayedHours,
        notes: notes,
        createdAt: createdAt,
        updatedAt: updatedAt,
      );
}
