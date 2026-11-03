/// Saúde de uma integração (`integrationHealthSchema`), sem segredos.
class IntegrationHealth {
  final String key; // igdb | rawg | achievist
  final String name;
  final bool configured;
  final List<String> envVars;
  final DateTime? lastCheckedAt;
  final bool? lastOk;
  final DateTime? lastSuccessAt;
  final String? lastMessage;

  const IntegrationHealth({
    required this.key,
    required this.name,
    required this.configured,
    this.envVars = const [],
    this.lastCheckedAt,
    this.lastOk,
    this.lastSuccessAt,
    this.lastMessage,
  });

  factory IntegrationHealth.fromJson(Map<String, dynamic> json) => IntegrationHealth(
        key: json['key'] as String,
        name: json['name'] as String,
        configured: json['configured'] as bool,
        envVars: (json['envVars'] as List<dynamic>? ?? const []).cast<String>(),
        lastCheckedAt: DateTime.tryParse(json['lastCheckedAt'] as String? ?? '')?.toLocal(),
        lastOk: json['lastOk'] as bool?,
        lastSuccessAt: DateTime.tryParse(json['lastSuccessAt'] as String? ?? '')?.toLocal(),
        lastMessage: json['lastMessage'] as String?,
      );

  String get statusLabel => !configured
      ? 'Não configurada'
      : lastOk == false
          ? 'Com falha'
          : lastOk == true
              ? 'Funcionando'
              : 'Configurada';
}
