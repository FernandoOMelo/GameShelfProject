import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:gameshelf_mobile/models/activity.dart';
import 'package:gameshelf_mobile/models/challenge.dart';
import 'package:gameshelf_mobile/models/dashboard.dart';
import 'package:gameshelf_mobile/models/game.dart';
import 'package:gameshelf_mobile/models/goal.dart';
import 'package:gameshelf_mobile/models/queue_item.dart';
import 'package:gameshelf_mobile/models/stats.dart';
import 'package:gameshelf_mobile/models/suggestion.dart';
import 'package:gameshelf_mobile/models/timeline.dart';
import 'package:gameshelf_mobile/providers/challenge_provider.dart';
import 'package:gameshelf_mobile/providers/dashboard_provider.dart';
import 'package:gameshelf_mobile/providers/goals_provider.dart';
import 'package:gameshelf_mobile/providers/queue_provider.dart';
import 'package:gameshelf_mobile/providers/timeline_provider.dart';
import 'package:gameshelf_mobile/screens/goals_screen.dart';
import 'package:gameshelf_mobile/screens/more_screen.dart';
import 'package:gameshelf_mobile/screens/progress_screen.dart';
import 'package:gameshelf_mobile/screens/queue_screen.dart';
import 'package:gameshelf_mobile/screens/timeline_screen.dart';

Game makeGame(String id, String title, {String status = 'BACKLOG'}) =>
    Game(id: id, title: title, status: status);

class FakeGoalsNotifier extends GoalsNotifier {
  FakeGoalsNotifier(this.goals);

  final List<GoalProgress> goals;

  @override
  Future<List<GoalProgress>> build() async => goals;
}

class FakeTimelineNotifier extends TimelineNotifier {
  FakeTimelineNotifier(this.initial);

  final TimelineState initial;

  @override
  Future<TimelineState> build() async => initial;
}

class ReorderableQueueNotifier extends QueueNotifier {
  ReorderableQueueNotifier(this.items);

  final List<QueueItem> items;
  final reorders = <List<String>>[];

  @override
  Future<List<QueueItem>> build() async => items;

  @override
  Future<void> reorder(List<String> gameIds) async {
    reorders.add(gameIds);
  }
}

class FakeQueueNotifier extends QueueNotifier {
  FakeQueueNotifier(this.items);

  final List<QueueItem> items;

  @override
  Future<List<QueueItem>> build() async => items;
}

class FakeChallengeNotifier extends ChallengeNotifier {
  FakeChallengeNotifier(this.challenge);

  final MainChallenge? challenge;

  @override
  Future<MainChallenge?> build() async => challenge;
}

void main() {
  setUpAll(() async {
    await initializeDateFormatting('pt_BR');
  });

  group('GoalProgress', () {
    test('parseia o progresso e descreve o tipo', () {
      final goal = GoalProgress.fromJson({
        'id': 'g1',
        'kind': 'COMPLETED_GAMES',
        'period': 'YEAR',
        'year': 2026,
        'month': null,
        'target': 12,
        'current': 5,
        'percent': 41.7,
        'elapsedPercent': 79,
        'achieved': false,
        'onTrack': true,
      });

      expect(goal.kindLabel, 'Jogos zerados');
      expect(goal.target, 12);
      expect(goal.onTrack, isTrue);
    });
  });

  group('StatsResponse', () {
    test('parseia totais, grupos e favoritos com nota', () {
      final stats = StatsResponse.fromJson({
        'totals': {
          'completedCount': 3,
          'completedHours': 40,
          'averageCompletedHours': 13.3,
          'longestGame': {'id': 'x', 'title': 'Longo', 'coverUrl': null, 'hours': 25},
          'shortestGame': null,
          'journeyStart': '2024-01-01',
          'journeyDays': 300,
          'completionRate': 60,
          'averageHoursPerGame': 8.5,
        },
        'ratingDistribution': [
          {'rating': 9, 'count': 2},
          {'rating': 11, 'count': 0},
        ],
        'difficultyDistribution': [
          {'difficulty': 'B', 'count': 1},
        ],
        'byGenre': [
          {'key': 'rpg', 'name': 'RPG', 'completedCount': 2, 'hours': 30, 'averageRating': 9},
        ],
        'byType': [],
        'byPlatform': [],
        'byYear': [
          {'year': 2026, 'completedCount': 1, 'hours': 10, 'gameOfYear': null},
        ],
        'favorites': [
          {'id': 'f1', 'title': 'Favorito', 'coverUrl': null, 'hours': 12, 'rating': 10},
        ],
        'topGenres': [],
        'topTypes': [],
        'byReleaseYear': [
          {'year': 2015, 'count': 2},
        ],
        'byDeveloper': [],
      });

      expect(stats.totals.completedCount, 3);
      expect(stats.totals.longestGame?.title, 'Longo');
      expect(stats.ratingDistribution.length, 2);
      expect(stats.favorites.single.rating, 10);
      expect(stats.byGenre.single.name, 'RPG');
    });
  });

  group('ReplayResponse', () {
    test('parseia os destaques aninhados do ano', () {
      final replay = ReplayResponse.fromJson({
        'year': 2026,
        'totalMinutes': 1200,
        'sessionCount': 14,
        'activeDays': 9,
        'completedCount': 4,
        'mostPlayedGame': {'id': 'g1', 'title': 'Hades', 'coverUrl': null, 'minutes': 300},
        'topGenre': {'name': 'Roguelike', 'minutes': 320},
        'longestSession': {'gameId': 'g1', 'title': 'Hades', 'date': '2026-03-01', 'minutes': 180},
        'busiestMonth': {'month': 3, 'minutes': 400},
        'gameOfYear': {'id': 'g2', 'title': 'Celeste', 'coverUrl': null, 'hours': 12},
      });

      expect(replay.mostPlayedGame?.minutes, 300);
      expect(replay.topGenre?.name, 'Roguelike');
      expect(replay.longestSession?.date, '2026-03-01');
      expect(replay.busiestMonth?.month, 3);
      expect(replay.gameOfYear?.title, 'Celeste');
    });
  });

  group('TimelineEvent', () {
    test('parseia um evento de sessão com o diário', () {
      final event = TimelineEvent.fromJson({
        'type': 'SESSION',
        'at': '2026-10-16T20:00:00.000Z',
        'date': '2026-10-16',
        'sessionId': 's1',
        'durationMinutes': 90,
        'progress': 40,
        'location': 'Cidade baixa',
        'notes': 'Cheguei ao chefe',
        'keyDecisions': null,
        'tips': null,
        'gameId': 'g1',
        'gameTitle': 'Hollow Knight',
        'coverUrl': null,
      });

      expect(event.type, TimelineEvent.session);
      expect(event.durationMinutes, 90);
      expect(event.location, 'Cidade baixa');
    });

    test('parseia uma missão completada', () {
      final event = TimelineEvent.fromJson({
        'type': 'CHALLENGE_COMPLETED',
        'at': '2026-10-16T20:00:00.000Z',
        'date': '2026-10-16',
        'title': 'Clássicos do SNES',
        'gamesCount': 3,
      });

      expect(event.challengeTitle, 'Clássicos do SNES');
      expect(event.gamesCount, 3);
    });
  });

  group('Suggestion', () {
    test('parseia o jogo, a pontuação e os motivos', () {
      final suggestion = Suggestion.fromJson({
        'game': {'id': 'g1', 'title': 'Celeste', 'status': 'BACKLOG'},
        'score': 7.5,
        'reasons': ['Curto e bem avaliado', 'Na sua plataforma'],
      });

      expect(suggestion.game.title, 'Celeste');
      expect(suggestion.score, 7.5);
      expect(suggestion.reasons, hasLength(2));
    });
  });

  group('goalLabel', () {
    test('escreve meta anual e mensal', () {
      const annual = GoalProgress(
        id: 'a', kind: 'COMPLETED_GAMES', period: 'YEAR', year: 2026, target: 10,
        current: 0, percent: 0, elapsedPercent: 0, achieved: false, onTrack: false,
      );
      const monthly = GoalProgress(
        id: 'b', kind: 'PLAYED_HOURS', period: 'MONTH', year: 2026, month: 3, target: 20,
        current: 0, percent: 0, elapsedPercent: 0, achieved: false, onTrack: false,
      );

      expect(goalLabel(annual), 'Zerar 10 jogos · 2026');
      expect(goalLabel(monthly), 'Jogar 20 h · março de 2026');
    });
  });

  group('GoalsScreen', () {
    testWidgets('lista as metas com progresso', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          goalsProvider.overrideWith(() => FakeGoalsNotifier(const [
                GoalProgress(
                  id: 'a', kind: 'COMPLETED_GAMES', period: 'YEAR', year: 2026,
                  target: 10, current: 6, percent: 60, elapsedPercent: 50,
                  achieved: false, onTrack: true,
                ),
              ])),
        ],
        child: const MaterialApp(home: GoalsScreen()),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Zerar 10 jogos · 2026'), findsOneWidget);
      expect(find.textContaining('no ritmo'), findsOneWidget);
    });

    testWidgets('mostra o estado vazio quando não há metas', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          goalsProvider.overrideWith(() => FakeGoalsNotifier(const [])),
        ],
        child: const MaterialApp(home: GoalsScreen()),
      ));
      await tester.pumpAndSettle();

      expect(find.textContaining('Defina metas'), findsOneWidget);
    });
  });

  group('MoreScreen', () {
    testWidgets('oferece os destinos secundários', (tester) async {
      await tester.pumpWidget(const MaterialApp(home: MoreScreen()));
      await tester.pumpAndSettle();

      for (final label in ['Listas', 'Estatísticas', 'Atividade', 'Metas', 'Configurações']) {
        expect(find.text(label), findsOneWidget);
      }
    });
  });

  group('TimelineScreen', () {
    testWidgets('agrupa os eventos por dia', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          timelineProvider.overrideWith(() => FakeTimelineNotifier(TimelineState(
                events: [
                  TimelineEvent(
                    type: TimelineEvent.gameStarted,
                    at: DateTime(2026, 10, 16, 20),
                    date: '2026-10-16',
                    gameId: 'g1',
                    gameTitle: 'Hollow Knight',
                  ),
                ],
              ))),
        ],
        child: const MaterialApp(home: TimelineScreen()),
      ));
      await tester.pumpAndSettle();

      expect(find.text('16 de outubro de 2026'), findsOneWidget);
      expect(find.textContaining('Iniciou'), findsOneWidget);
    });
  });

  group('QueueScreen', () {
    testWidgets('move o item uma posição para baixo pelas ações', (tester) async {
      final notifier = ReorderableQueueNotifier([
        QueueItem(position: 0, addedAt: DateTime(2026), game: makeGame('1', 'Hollow Knight')),
        QueueItem(position: 1, addedAt: DateTime(2026), game: makeGame('2', 'Celeste')),
      ]);
      await tester.pumpWidget(ProviderScope(
        overrides: [queueProvider.overrideWith(() => notifier)],
        child: const MaterialApp(home: QueueScreen()),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.byIcon(Icons.more_vert_rounded).first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Mover para baixo'));
      await tester.pumpAndSettle();

      expect(notifier.reorders.single, ['2', '1']);
    });
  });

  group('MainChallenge', () {
    test('parseia o progresso da missão', () {
      final challenge = MainChallenge.fromJson({
        'title': 'Saga Souls',
        'listId': 'l1',
        'listName': 'Clássicos',
        'totalGames': 5,
        'completedGames': 2,
        'percent': 40,
      });

      expect(challenge.title, 'Saga Souls');
      expect(challenge.listName, 'Clássicos');
      expect(challenge.completedGames, 2);
      expect(challenge.percent, 40);
    });
  });

  group('ProgressScreen', () {
    Dashboard dashboardWith({double weeklyHours = 5}) => Dashboard.fromJson({
          'gameCount': 0,
          'completedCount': 0,
          'playingCount': 0,
          'totalPlayedHours': 0,
          'backlogRemainingHours': 0,
          'weeklyHours': weeklyHours,
        });

    testWidgets('mostra a missão principal e a meta semanal', (tester) async {
      tester.view.physicalSize = const Size(900, 4000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final dashboard = dashboardWith();
      await tester.pumpWidget(ProviderScope(
        overrides: [
          dashboardRangeProvider.overrideWith((ref, range) async => dashboard),
          queueProvider.overrideWith(() => FakeQueueNotifier(const [])),
          challengeProvider.overrideWith(
            () => FakeChallengeNotifier(const MainChallenge(
              title: 'Saga Souls',
              listId: 'l1',
              listName: 'Clássicos',
              totalGames: 5,
              completedGames: 2,
              percent: 40,
            )),
          ),
        ],
        child: const MaterialApp(home: ProgressScreen()),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Missão principal'), findsOneWidget);
      expect(find.text('Saga Souls'), findsOneWidget);
      expect(find.textContaining('2 / 5 zerados'), findsOneWidget);
      expect(find.text('Minutos por semana'), findsOneWidget);
      expect(find.text('300'), findsOneWidget);
    });

    testWidgets('valida a meta semanal antes de salvar', (tester) async {
      tester.view.physicalSize = const Size(900, 4000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final dashboard = dashboardWith();
      await tester.pumpWidget(ProviderScope(
        overrides: [
          dashboardRangeProvider.overrideWith((ref, range) async => dashboard),
          queueProvider.overrideWith(() => FakeQueueNotifier(const [])),
          challengeProvider.overrideWith(() => FakeChallengeNotifier(null)),
        ],
        child: const MaterialApp(home: ProgressScreen()),
      ));
      await tester.pumpAndSettle();

      expect(find.textContaining('Defina um objetivo'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'abc');
      await tester.tap(find.widgetWithText(FilledButton, 'Salvar'));
      await tester.pumpAndSettle();

      expect(find.textContaining('entre 0 e 10080'), findsOneWidget);
    });
  });
}
