// Modelos do detalhe do jogo que a web já tinha: plataformas associadas,
// jornadas, conquistas, DLC e jogos da franquia. Todos espelham os contratos
// de `packages/contracts`; nenhuma regra é recalculada aqui.

class GamePlatform {
  final String id;
  final String gameId;
  final String platformId;
  final String? edition;
  final String? format;
  final bool owned;
  final bool isPrimary;
  final bool countsTowardTotal;
  final String? externalSource;
  final int? externalPlaytimeMinutes;
  final int externalPlaytimeImportedMinutes;
  final DateTime? externalActivityStartedAt;
  final DateTime? externalActivityEndedAt;
  final int externalActivityDays;

  const GamePlatform({
    required this.id,
    required this.gameId,
    required this.platformId,
    this.edition,
    this.format,
    this.owned = false,
    this.isPrimary = false,
    this.countsTowardTotal = false,
    this.externalSource,
    this.externalPlaytimeMinutes,
    this.externalPlaytimeImportedMinutes = 0,
    this.externalActivityStartedAt,
    this.externalActivityEndedAt,
    this.externalActivityDays = 0,
  });

  /// Há tempo da plataforma que ainda não virou horas retroativas.
  bool get canImportPlaytime =>
      externalPlaytimeMinutes != null && externalPlaytimeMinutes! > externalPlaytimeImportedMinutes;

  factory GamePlatform.fromJson(Map<String, dynamic> json) => GamePlatform(
        id: json['id'] as String,
        gameId: json['gameId'] as String,
        platformId: json['platformId'] as String,
        edition: json['edition'] as String?,
        format: json['format'] as String?,
        owned: json['owned'] as bool? ?? false,
        isPrimary: json['isPrimary'] as bool? ?? false,
        countsTowardTotal: json['countsTowardTotal'] as bool? ?? false,
        externalSource: json['externalSource'] as String?,
        externalPlaytimeMinutes: json['externalPlaytimeMinutes'] as int?,
        externalPlaytimeImportedMinutes: json['externalPlaytimeImportedMinutes'] as int? ?? 0,
        externalActivityStartedAt: _instant(json['externalActivityStartedAt']),
        externalActivityEndedAt: _instant(json['externalActivityEndedAt']),
        externalActivityDays: json['externalActivityDays'] as int? ?? 0,
      );
}

const gamePlatformFormatLabels = {
  'PHYSICAL': 'Físico',
  'DIGITAL': 'Digital',
  'SUBSCRIPTION': 'Assinatura',
  'CLOUD': 'Nuvem',
};

class Playthrough {
  final String id;
  final String gameId;
  final int sequence;
  final String? label;
  final String status;
  final String? primaryPlatformId;
  final String? startedAt;
  final String? completedAt;
  final String? notes;
  final bool isReplay;

  const Playthrough({
    required this.id,
    required this.gameId,
    required this.sequence,
    this.label,
    required this.status,
    this.primaryPlatformId,
    this.startedAt,
    this.completedAt,
    this.notes,
    this.isReplay = false,
  });

  String get title => label ?? (isReplay ? 'Replay ${sequence - 1}' : 'Primeira jornada');

  factory Playthrough.fromJson(Map<String, dynamic> json) => Playthrough(
        id: json['id'] as String,
        gameId: json['gameId'] as String,
        sequence: json['sequence'] as int,
        label: json['label'] as String?,
        status: json['status'] as String,
        primaryPlatformId: json['primaryPlatformId'] as String?,
        startedAt: json['startedAt'] as String?,
        completedAt: json['completedAt'] as String?,
        notes: json['notes'] as String?,
        isReplay: json['isReplay'] as bool? ?? false,
      );
}

const playthroughStatusLabels = {
  'PLANNED': 'Planejada',
  'PLAYING': 'Em andamento',
  'PAUSED': 'Pausada',
  'COMPLETED': 'Concluída',
  'ABANDONED': 'Abandonada',
};

/// Transições oferecidas pela interface, espelhando as regras da API (ADR-023).
const playthroughTransitions = <String, List<(String status, String label, bool needsDate)>>{
  'PLANNED': [('PLAYING', 'Iniciar jornada', false)],
  'PLAYING': [('PAUSED', 'Pausar', false), ('COMPLETED', 'Concluir', true), ('ABANDONED', 'Abandonar', false)],
  'PAUSED': [('PLAYING', 'Retomar', false), ('COMPLETED', 'Concluir', true), ('ABANDONED', 'Abandonar', false)],
  'COMPLETED': [('PLAYING', 'Reabrir', false)],
  'ABANDONED': [('PLAYING', 'Retomar', false)],
};

class PlaythroughMetrics {
  final int started;
  final int completed;
  final int replaysStarted;

  const PlaythroughMetrics({this.started = 0, this.completed = 0, this.replaysStarted = 0});

  factory PlaythroughMetrics.fromJson(Map<String, dynamic> json) => PlaythroughMetrics(
        started: json['started'] as int? ?? 0,
        completed: json['completed'] as int? ?? 0,
        replaysStarted: json['replaysStarted'] as int? ?? 0,
      );
}

class MergedAchievement {
  final String id;
  final String? name;
  final String? description;
  final String? iconUrl;
  final double? rarityPercent;
  final String rarityTier;
  final bool unlocked;
  final DateTime? unlockedAt;
  final bool secret;
  final bool isCompletionTrophy;

  const MergedAchievement({
    required this.id,
    this.name,
    this.description,
    this.iconUrl,
    this.rarityPercent,
    this.rarityTier = 'COMMON',
    this.unlocked = false,
    this.unlockedAt,
    this.secret = false,
    this.isCompletionTrophy = false,
  });

  factory MergedAchievement.fromJson(Map<String, dynamic> json) => MergedAchievement(
        id: json['id'] as String,
        name: json['name'] as String?,
        description: json['description'] as String?,
        iconUrl: json['iconUrl'] as String?,
        rarityPercent: (json['rarityPercent'] as num?)?.toDouble(),
        rarityTier: json['rarityTier'] as String? ?? 'COMMON',
        unlocked: json['unlocked'] as bool? ?? false,
        unlockedAt: _instant(json['unlockedAt']),
        secret: json['secret'] as bool? ?? false,
        isCompletionTrophy: json['isCompletionTrophy'] as bool? ?? false,
      );
}

const rarityTierLabels = {
  'COMMON': 'Comum',
  'UNCOMMON': 'Incomum',
  'RARE': 'Raro',
  'ULTRA_RARE': 'Ultra raro',
};

class GameAchievements {
  final bool catalogAvailable;
  final int total;
  final int unlockedCount;
  final double percent;
  final List<MergedAchievement> achievements;
  final Map<String, int> rarityBreakdown;

  const GameAchievements({
    required this.catalogAvailable,
    required this.total,
    required this.unlockedCount,
    required this.percent,
    required this.achievements,
    this.rarityBreakdown = const {},
  });

  factory GameAchievements.fromJson(Map<String, dynamic> json) {
    final breakdown = (json['rarityBreakdown'] as Map<String, dynamic>?) ?? const {};
    return GameAchievements(
      catalogAvailable: json['catalogAvailable'] as bool? ?? false,
      total: json['total'] as int? ?? 0,
      unlockedCount: json['unlockedCount'] as int? ?? 0,
      percent: (json['percent'] as num?)?.toDouble() ?? 0,
      achievements: ((json['achievements'] as List<dynamic>?) ?? const [])
          .map((e) => MergedAchievement.fromJson(e as Map<String, dynamic>))
          .toList(),
      rarityBreakdown: {for (final entry in breakdown.entries) entry.key: entry.value as int},
    );
  }
}

class Dlc {
  final String id;
  final String gameId;
  final String name;
  final String? description;
  final String? coverUrl;
  final String? releaseDate;
  final bool owned;
  final String status;
  final double? estimatedHours;
  final double playedHours;
  final int? rawgId;
  final String? rawgName;

  const Dlc({
    required this.id,
    required this.gameId,
    required this.name,
    this.description,
    this.coverUrl,
    this.releaseDate,
    this.owned = false,
    this.status = 'NOT_STARTED',
    this.estimatedHours,
    this.playedHours = 0,
    this.rawgId,
    this.rawgName,
  });

  factory Dlc.fromJson(Map<String, dynamic> json) => Dlc(
        id: json['id'] as String,
        gameId: json['gameId'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        coverUrl: json['coverUrl'] as String?,
        releaseDate: json['releaseDate'] as String?,
        owned: json['owned'] as bool? ?? false,
        status: json['status'] as String? ?? 'NOT_STARTED',
        estimatedHours: (json['estimatedHours'] as num?)?.toDouble(),
        playedHours: (json['playedHours'] as num?)?.toDouble() ?? 0,
        rawgId: json['rawgId'] as int?,
        rawgName: json['rawgName'] as String?,
      );
}

const dlcStatusLabels = {
  'NOT_STARTED': 'Não iniciada',
  'PLAYING': 'Jogando',
  'COMPLETED': 'Concluída',
};

class FranchiseGameCandidate {
  final int igdbId;
  final String title;
  final int? releaseYear;
  final String? coverUrl;
  final bool inLibrary;
  final String? libraryGameId;
  final String? libraryGameStatus;

  const FranchiseGameCandidate({
    required this.igdbId,
    required this.title,
    this.releaseYear,
    this.coverUrl,
    this.inLibrary = false,
    this.libraryGameId,
    this.libraryGameStatus,
  });

  factory FranchiseGameCandidate.fromJson(Map<String, dynamic> json) => FranchiseGameCandidate(
        igdbId: json['igdbId'] as int,
        title: json['title'] as String,
        releaseYear: json['releaseYear'] as int?,
        coverUrl: json['coverUrl'] as String?,
        inLibrary: json['inLibrary'] as bool? ?? false,
        libraryGameId: json['libraryGameId'] as String?,
        libraryGameStatus: json['libraryGameStatus'] as String?,
      );
}

class FranchiseGames {
  final String franchiseName;
  final List<FranchiseGameCandidate> games;

  const FranchiseGames({required this.franchiseName, required this.games});

  factory FranchiseGames.fromJson(Map<String, dynamic> json) => FranchiseGames(
        franchiseName: json['franchiseName'] as String,
        games: ((json['games'] as List<dynamic>?) ?? const [])
            .map((e) => FranchiseGameCandidate.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

DateTime? _instant(Object? value) => value is String ? DateTime.parse(value).toLocal() : null;
