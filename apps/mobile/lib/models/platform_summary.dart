import 'catalog.dart';

/// Resumo por plataforma (`platformSummarySchema`): números da biblioteca,
/// tempo e conquistas, sem nenhuma conta feita no cliente.
class PlatformSummary {
  final CatalogItem platform;
  final int gameCount;
  final int completedCount;
  final int dominatedCount;
  final int localPlayedMinutes;
  final int externalPlayedMinutes;
  final int achievementsUnlocked;
  final int achievementsTotal;
  final List<String> recentGameCovers;

  const PlatformSummary({
    required this.platform,
    this.gameCount = 0,
    this.completedCount = 0,
    this.dominatedCount = 0,
    this.localPlayedMinutes = 0,
    this.externalPlayedMinutes = 0,
    this.achievementsUnlocked = 0,
    this.achievementsTotal = 0,
    this.recentGameCovers = const [],
  });

  /// Há dado vindo do Achievist (tempo informado ou conquistas).
  bool get hasExternal => externalPlayedMinutes > 0 || achievementsTotal > 0;

  /// Tempo exibido: o informado pela plataforma quando existe, senão o local.
  int get shownMinutes => externalPlayedMinutes > 0 ? externalPlayedMinutes : localPlayedMinutes;

  factory PlatformSummary.fromJson(Map<String, dynamic> json) => PlatformSummary(
        platform: CatalogItem.fromJson(json['platform'] as Map<String, dynamic>),
        gameCount: json['gameCount'] as int? ?? 0,
        completedCount: json['completedCount'] as int? ?? 0,
        dominatedCount: json['dominatedCount'] as int? ?? 0,
        localPlayedMinutes: json['localPlayedMinutes'] as int? ?? 0,
        externalPlayedMinutes: json['externalPlayedMinutes'] as int? ?? 0,
        achievementsUnlocked: json['achievementsUnlocked'] as int? ?? 0,
        achievementsTotal: json['achievementsTotal'] as int? ?? 0,
        recentGameCovers: ((json['recentGameCovers'] as List<dynamic>?) ?? const [])
            .whereType<String>()
            .toList(),
      );
}

/// Entrada do catálogo padrão (`GET /platforms/catalog`): logo e cor oficiais.
class PlatformCatalogEntry {
  final String name;
  final String catalogKey;
  final String iconKey;
  final String color;

  const PlatformCatalogEntry({
    required this.name,
    required this.catalogKey,
    required this.iconKey,
    required this.color,
  });

  factory PlatformCatalogEntry.fromJson(Map<String, dynamic> json) => PlatformCatalogEntry(
        name: json['name'] as String,
        catalogKey: json['catalogKey'] as String,
        iconKey: json['iconKey'] as String,
        color: json['color'] as String,
      );
}

/// Estado da sincronização com o Achievist (`externalSyncStateSchema`).
class SyncState {
  final String status;
  final DateTime? startedAt;
  final DateTime? finishedAt;
  final String? error;

  /// Resumo da última rodada (`summary` da API), quando houve uma.
  final int? fetched;
  final int? updated;
  final int? pending;

  const SyncState({
    required this.status,
    this.startedAt,
    this.finishedAt,
    this.error,
    this.fetched,
    this.updated,
    this.pending,
  });

  bool get disabled => status == 'disabled';
  bool get running => status == 'running';
  bool get failed => status == 'failed';

  /// Quando a última rodada terminou (ou começou, se ainda não terminou).
  DateTime? get lastAt => finishedAt ?? startedAt;

  factory SyncState.fromJson(Map<String, dynamic> json) => SyncState(
        status: json['status'] as String,
        startedAt: json['startedAt'] == null ? null : DateTime.parse(json['startedAt'] as String).toLocal(),
        finishedAt: json['finishedAt'] == null ? null : DateTime.parse(json['finishedAt'] as String).toLocal(),
        error: json['error'] as String?,
        fetched: (json['summary'] as Map<String, dynamic>?)?['fetched'] as int?,
        updated: (json['summary'] as Map<String, dynamic>?)?['updated'] as int?,
        pending: (json['summary'] as Map<String, dynamic>?)?['pending'] as int?,
      );
}
