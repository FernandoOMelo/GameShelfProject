/// Candidato do jogo da biblioteca para uma entrada importada (sugestão por título).
class MatchSuggestion {
  final String gameId;
  final String title;

  const MatchSuggestion({required this.gameId, required this.title});

  factory MatchSuggestion.fromJson(Map<String, dynamic> json) =>
      MatchSuggestion(gameId: json['gameId'] as String, title: json['title'] as String);
}

/// Entrada importada do Achievist que ainda precisa ser vinculada a um jogo
/// (`externalPendingMatchSchema`). A sugestão é só sugestão: nada é vinculado
/// sem o toque do usuário, e ambiguidade não é resolvida sozinha.
class ExternalPendingMatch {
  final String id;
  final String title;
  final String platformName;
  final String? accountLabel;
  final int? externalPlaytimeMinutes;
  final DateTime? externalLastPlayedAt;
  final List<MatchSuggestion> suggestions;
  final bool ambiguous;

  const ExternalPendingMatch({
    required this.id,
    required this.title,
    required this.platformName,
    this.accountLabel,
    this.externalPlaytimeMinutes,
    this.externalLastPlayedAt,
    this.suggestions = const [],
    this.ambiguous = false,
  });

  /// Uma única sugestão sem ambiguidade: elegível ao vínculo em lote.
  bool get singleSuggestion => !ambiguous && suggestions.length == 1;

  factory ExternalPendingMatch.fromJson(Map<String, dynamic> json) => ExternalPendingMatch(
        id: json['id'] as String,
        title: json['title'] as String,
        platformName: json['platformName'] as String,
        accountLabel: json['accountLabel'] as String?,
        externalPlaytimeMinutes: json['externalPlaytimeMinutes'] as int?,
        externalLastPlayedAt:
            json['externalLastPlayedAt'] == null ? null : DateTime.parse(json['externalLastPlayedAt'] as String).toLocal(),
        suggestions: ((json['suggestions'] as List<dynamic>?) ?? const [])
            .map((e) => MatchSuggestion.fromJson(e as Map<String, dynamic>))
            .toList(),
        ambiguous: json['ambiguous'] as bool? ?? false,
      );
}

/// Diagnóstico da conexão (`externalIntegrationStatusSchema`): diz se o servidor
/// tem as credenciais e se elas autenticam agora, sem expor usuário, senha ou URL.
class IntegrationStatus {
  final bool configured;
  final bool? reachable;
  final int? accounts;
  final String? error;

  const IntegrationStatus({required this.configured, this.reachable, this.accounts, this.error});

  factory IntegrationStatus.fromJson(Map<String, dynamic> json) => IntegrationStatus(
        configured: json['configured'] as bool? ?? false,
        reachable: json['reachable'] as bool?,
        accounts: json['accounts'] as int?,
        error: json['error'] as String?,
      );
}
