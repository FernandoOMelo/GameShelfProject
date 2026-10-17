import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/goals_api.dart';
import '../models/goal.dart';

class GoalsNotifier extends AsyncNotifier<List<GoalProgress>> {
  @override
  Future<List<GoalProgress>> build() => GoalsApi.list();

  Future<void> refresh() async {
    state = await AsyncValue.guard(GoalsApi.list);
  }

  Future<void> create({
    required String kind,
    required String period,
    required int year,
    int? month,
    required int target,
  }) async {
    await GoalsApi.create(
      kind: kind,
      period: period,
      year: year,
      month: month,
      target: target,
    );
    await refresh();
  }

  Future<void> updateTarget(String id, int target) async {
    await GoalsApi.updateTarget(id, target);
    await refresh();
  }

  Future<void> delete(String id) async {
    await GoalsApi.delete(id);
    await refresh();
  }
}

final goalsProvider =
    AsyncNotifierProvider<GoalsNotifier, List<GoalProgress>>(GoalsNotifier.new);
