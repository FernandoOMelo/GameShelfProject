class Game {
  final String id;
  final String title;
  final String status;
  final String? coverUrl;
  final String? backgroundUrl;
  final double? estimatedMainHours;
  final double? personalEstimatedHours;
  final double retroactivePlayedHours;
  final String? developer;
  final String? platformId;
  final int? releaseYear;

  const Game({
    required this.id,
    required this.title,
    required this.status,
    this.coverUrl,
    this.backgroundUrl,
    this.estimatedMainHours,
    this.personalEstimatedHours,
    this.retroactivePlayedHours = 0,
    this.developer,
    this.platformId,
    this.releaseYear,
  });

  factory Game.fromJson(Map<String, dynamic> json) => Game(
        id: json['id'] as String,
        title: json['title'] as String,
        status: json['status'] as String,
        coverUrl: json['coverUrl'] as String?,
        backgroundUrl: json['backgroundUrl'] as String?,
        estimatedMainHours: (json['estimatedMainHours'] as num?)?.toDouble(),
        personalEstimatedHours: (json['personalEstimatedHours'] as num?)?.toDouble(),
        retroactivePlayedHours: (json['retroactivePlayedHours'] as num?)?.toDouble() ?? 0,
        developer: json['developer'] as String?,
        platformId: json['platformId'] as String?,
        releaseYear: json['releaseYear'] as int?,
      );
}
