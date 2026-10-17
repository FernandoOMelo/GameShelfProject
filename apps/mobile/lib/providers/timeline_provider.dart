import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/timeline_api.dart';
import '../models/timeline.dart';

class TimelineState {
  final List<TimelineEvent> events;
  final DateTime? nextBefore;
  final bool loadingMore;

  const TimelineState({
    required this.events,
    this.nextBefore,
    this.loadingMore = false,
  });

  bool get hasMore => nextBefore != null;

  TimelineState copyWith({bool? loadingMore}) => TimelineState(
        events: events,
        nextBefore: nextBefore,
        loadingMore: loadingMore ?? this.loadingMore,
      );
}

/// Carrega a linha do tempo em páginas por cursor, acumulando os eventos.
class TimelineNotifier extends AsyncNotifier<TimelineState> {
  @override
  Future<TimelineState> build() async {
    final page = await TimelineApi.page(limit: 50);
    return TimelineState(events: page.events, nextBefore: page.nextBefore);
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(build);
  }

  Future<void> loadMore() async {
    final current = state.valueOrNull;
    if (current == null || current.nextBefore == null || current.loadingMore) return;
    state = AsyncData(current.copyWith(loadingMore: true));
    try {
      final page = await TimelineApi.page(before: current.nextBefore, limit: 50);
      state = AsyncData(TimelineState(
        events: [...current.events, ...page.events],
        nextBefore: page.nextBefore,
      ));
    } catch (_) {
      state = AsyncData(current.copyWith(loadingMore: false));
    }
  }
}

final timelineProvider =
    AsyncNotifierProvider<TimelineNotifier, TimelineState>(TimelineNotifier.new);
