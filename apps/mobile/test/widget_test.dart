import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:gameshelf_mobile/models/game.dart';
import 'package:gameshelf_mobile/providers/games_provider.dart';
import 'package:gameshelf_mobile/screens/library_screen.dart';

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
}
