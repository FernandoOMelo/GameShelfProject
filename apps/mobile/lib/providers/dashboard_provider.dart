import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/dashboard_api.dart';
import '../models/dashboard.dart';

class DashboardNotifier extends AsyncNotifier<Dashboard> {
  @override
  Future<Dashboard> build() => DashboardApi.get();

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(DashboardApi.get);
  }
}

final dashboardProvider = AsyncNotifierProvider<DashboardNotifier, Dashboard>(DashboardNotifier.new);
