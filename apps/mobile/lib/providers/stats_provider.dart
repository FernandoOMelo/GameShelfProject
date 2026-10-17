import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/stats_api.dart';
import '../models/activity.dart';
import '../models/stats.dart';

final statsProvider = FutureProvider<StatsResponse>((ref) => StatsApi.stats());
final activityProvider =
    FutureProvider.family<ActivityResponse, int?>((ref, year) => StatsApi.activity(year: year));
final replayProvider =
    FutureProvider.family<ReplayResponse, int?>((ref, year) => StatsApi.replay(year: year));
