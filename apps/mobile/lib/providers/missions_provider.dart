import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/missions_api.dart';
import '../models/integration_health.dart';
import '../models/mission.dart';

class MissionsNotifier extends AsyncNotifier<List<Mission>> {
  @override
  Future<List<Mission>> build() => MissionsApi.list();

  Future<void> refresh() async {
    state = await AsyncValue.guard(MissionsApi.list);
  }

  Future<void> create(Map<String, dynamic> body) async {
    await MissionsApi.create(body);
    await refresh();
  }

  Future<void> patch(String id, Map<String, dynamic> body) async {
    await MissionsApi.update(id, body);
    await refresh();
  }

  Future<void> delete(String id) async {
    await MissionsApi.delete(id);
    await refresh();
  }
}

final missionsProvider = AsyncNotifierProvider<MissionsNotifier, List<Mission>>(MissionsNotifier.new);

final integrationHealthProvider = FutureProvider.autoDispose<List<IntegrationHealth>>((ref) => IntegrationHealthApi.list());
