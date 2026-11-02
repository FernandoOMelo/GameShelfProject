import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/game_extras_api.dart';
import '../models/game_extras.dart';

final gamePlatformsProvider = FutureProvider.autoDispose.family<List<GamePlatform>, String>(
  (ref, gameId) => GameExtrasApi.platforms(gameId),
);

final playthroughsProvider = FutureProvider.autoDispose.family<List<Playthrough>, String>(
  (ref, gameId) => GameExtrasApi.playthroughs(gameId),
);

final playthroughMetricsProvider = FutureProvider.autoDispose.family<PlaythroughMetrics, String>(
  (ref, gameId) => GameExtrasApi.playthroughMetrics(gameId),
);

final gameAchievementsProvider = FutureProvider.autoDispose.family<GameAchievements, String>(
  (ref, gameId) => GameExtrasApi.achievements(gameId),
);

final dlcsProvider = FutureProvider.autoDispose.family<List<Dlc>, String>(
  (ref, gameId) => GameExtrasApi.dlcs(gameId),
);

final franchiseGamesProvider = FutureProvider.autoDispose.family<FranchiseGames, String>(
  (ref, franchiseId) => GameExtrasApi.franchiseGames(franchiseId),
);
