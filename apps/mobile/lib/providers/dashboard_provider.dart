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

/// Painel para um período arbitrário (`GET /dashboard` com `from`/`to`).
///
/// O período é representado por um registro `(from, to)`; `(null, null)` usa o
/// padrão do servidor (todo o período). A comparação com o período anterior é
/// feita na tela, requisitando uma segunda faixa.
final dashboardRangeProvider =
    FutureProvider.family<Dashboard, ({String? from, String? to})>(
  (ref, range) => DashboardApi.load(from: range.from, to: range.to),
);
