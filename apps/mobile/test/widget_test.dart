import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gameshelf_mobile/models/game.dart';
import 'package:gameshelf_mobile/models/queue_item.dart';
import 'package:gameshelf_mobile/providers/games_provider.dart';
import 'package:gameshelf_mobile/providers/queue_provider.dart';
import 'package:gameshelf_mobile/screens/library_screen.dart';
import 'package:gameshelf_mobile/screens/queue_screen.dart';
import 'package:gameshelf_mobile/screens/quick_log_sheet.dart';

Game makeGame(String id, String title, {String status = 'BACKLOG'}) => Game(
      id: id,
      title: title,
      status: status,
    );

class FakeGamesNotifier extends GamesNotifier {
  FakeGamesNotifier(this.games);

  final List<Game> games;

  @override
  Future<List<Game>> build() async => games;
}

class FakeQueueNotifier extends QueueNotifier {
  FakeQueueNotifier(this.items);

  final List<QueueItem> items;
  final removed = <String>[];
  final restored = <String>[];

  @override
  Future<List<QueueItem>> build() async => items;

  @override
  Future<void> remove(String gameId) async {
    removed.add(gameId);
  }

  @override
  Future<void> restore(QueueItem item, int index) async {
    restored.add('${item.game.id}@$index');
  }
}

Widget wrap(List<Game> games) => ProviderScope(
      overrides: [gamesProvider.overrideWith(() => FakeGamesNotifier(games))],
      child: const MaterialApp(home: Scaffold(body: LibraryScreen())),
    );

void main() {
  group('Game.fromJson', () {
    test('reads the platform id the API returns', () {
      final game = Game.fromJson({
        'id': 'a', 'title': 'Hades', 'status': 'PLAYING',
        'platformId': 'platform-1', 'coverUrl': null, 'backgroundUrl': null,
        'estimatedMainHours': 12.5, 'personalEstimatedHours': null,
        'retroactivePlayedHours': 3, 'developer': 'Supergiant', 'releaseYear': 2020,
      });

      expect(game.platformId, 'platform-1');
      expect(game.estimatedMainHours, 12.5);
      expect(game.retroactivePlayedHours, 3);
    });

    test('tolerates the nullable fields being absent', () {
      final game = Game.fromJson({'id': 'a', 'title': 'Hades', 'status': 'BACKLOG'});

      expect(game.platformId, isNull);
      expect(game.coverUrl, isNull);
      expect(game.retroactivePlayedHours, 0);
    });
  });

  group('LibraryScreen', () {
    testWidgets('lists the games with their status', (tester) async {
      await tester.pumpWidget(wrap([
        makeGame('1', 'Hollow Knight', status: 'PLAYING'),
        makeGame('2', 'Celeste'),
      ]));
      await tester.pumpAndSettle();

      expect(find.text('Hollow Knight'), findsOneWidget);
      expect(find.text('Celeste'), findsOneWidget);
      expect(find.text('Jogando'), findsOneWidget);
      expect(find.text('2 jogos'), findsOneWidget);
    });

    testWidgets('filters the list by the search term', (tester) async {
      await tester.pumpWidget(wrap([
        makeGame('1', 'Hollow Knight'),
        makeGame('2', 'Celeste'),
      ]));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'cele');
      await tester.pumpAndSettle();

      expect(find.text('Celeste'), findsOneWidget);
      expect(find.text('Hollow Knight'), findsNothing);
      expect(find.text('1 jogo'), findsOneWidget);
    });

    testWidgets('shows the empty state when nothing matches', (tester) async {
      await tester.pumpWidget(wrap([makeGame('1', 'Hollow Knight')]));
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'zelda');
      await tester.pumpAndSettle();

      expect(find.text('Nenhum jogo encontrado'), findsOneWidget);
    });
  });

  group('buildRetroactiveSession', () {
    test('termina no horário atual e recua a duração', () {
      final session = buildRetroactiveSession(
        game: makeGame('1', 'Celeste'),
        day: DateTime(2026, 10, 16),
        minutes: 90,
        now: DateTime(2026, 10, 16, 21, 30),
      );

      expect(session.endedAt, DateTime(2026, 10, 16, 21, 30));
      expect(session.startedAt, DateTime(2026, 10, 16, 20));
      expect(session.toJson()['startedAt'], DateTime(2026, 10, 16, 20).toUtc().toIso8601String());
    });

    test('preserva o dia escolhido no registro retroativo', () {
      final session = buildRetroactiveSession(
        game: makeGame('1', 'Celeste'),
        day: DateTime(2026, 10, 14),
        minutes: 60,
        now: DateTime(2026, 10, 16, 21, 30),
      );

      expect(session.endedAt, DateTime(2026, 10, 14, 21, 30));
      expect(session.startedAt, DateTime(2026, 10, 14, 20, 30));
    });
  });

  group('formatQuickLogDuration', () {
    test('escreve minutos e horas', () {
      expect(formatQuickLogDuration(30), '30 min');
      expect(formatQuickLogDuration(60), '1 h');
      expect(formatQuickLogDuration(90), '1 h 30');
      expect(formatQuickLogDuration(180), '3 h');
    });
  });

  group('QuickLogSheet', () {
    testWidgets('oferece os dias e as durações', (tester) async {
      await tester.pumpWidget(ProviderScope(
        child: MaterialApp(
          home: Scaffold(body: QuickLogSheet(game: makeGame('1', 'Celeste'))),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Hoje'), findsOneWidget);
      expect(find.text('Ontem'), findsOneWidget);
      expect(find.text('30 min'), findsOneWidget);
      expect(find.text('1 h 30'), findsOneWidget);
      expect(find.text('A sessão termina agora, com a duração escolhida.'), findsOneWidget);

      await tester.tap(find.text('Ontem'));
      await tester.pumpAndSettle();

      expect(find.text('A sessão entra no dia escolhido, no horário atual.'), findsOneWidget);
    });
  });

  group('QueueScreen', () {
    testWidgets('deslizar remove o item e oferece desfazer', (tester) async {
      final notifier = FakeQueueNotifier([
        QueueItem(position: 0, addedAt: DateTime(2026), game: makeGame('1', 'Hollow Knight')),
        QueueItem(position: 1, addedAt: DateTime(2026), game: makeGame('2', 'Celeste')),
      ]);
      await tester.pumpWidget(ProviderScope(
        overrides: [queueProvider.overrideWith(() => notifier)],
        child: const MaterialApp(home: QueueScreen()),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Fila (2)'), findsOneWidget);

      await tester.drag(find.text('Celeste'), const Offset(-600, 0));
      await tester.pumpAndSettle();

      expect(notifier.removed, ['2']);
      expect(find.text('Fila (1)'), findsOneWidget);
      expect(find.text('Celeste saiu da fila'), findsOneWidget);

      await tester.tap(find.text('Desfazer'));
      await tester.pumpAndSettle();

      expect(notifier.restored, ['2@1']);
    });
  });
}
