import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/achievement_series.dart';
import '../core/stats_api.dart';
import '../models/activity.dart';
import '../models/stats.dart';

/// Ano escolhido no filtro de período das estatísticas (`null` = tudo).
final statsYearProvider = StateProvider<int?>((ref) => null);

final statsProvider = FutureProvider<StatsResponse>(
  (ref) => StatsApi.stats(year: ref.watch(statsYearProvider)),
);
final activityProvider =
    FutureProvider.family<ActivityResponse, int?>((ref, year) => StatsApi.activity(year: year));
final replayProvider =
    FutureProvider.family<ReplayResponse, int?>((ref, year) => StatsApi.replay(year: year));
final achievementSeriesProvider =
    FutureProvider.autoDispose<AchievementSeries>((ref) => StatsApi.achievementSeries());
