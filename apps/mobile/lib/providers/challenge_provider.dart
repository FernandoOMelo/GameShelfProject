import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/challenge_api.dart';
import '../models/challenge.dart';

class ChallengeNotifier extends AsyncNotifier<MainChallenge?> {
  @override
  Future<MainChallenge?> build() => ChallengeApi.get();

  Future<void> refresh() async {
    state = await AsyncValue.guard(ChallengeApi.get);
  }

  Future<void> save({required String title, required String listId}) async {
    await ChallengeApi.save(title: title, listId: listId);
    await refresh();
  }

  Future<void> clear() async {
    await ChallengeApi.clear();
    await refresh();
  }
}

final challengeProvider =
    AsyncNotifierProvider<ChallengeNotifier, MainChallenge?>(ChallengeNotifier.new);
