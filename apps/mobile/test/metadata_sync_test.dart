import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gameshelf_mobile/models/catalog.dart';
import 'package:gameshelf_mobile/models/game.dart';
import 'package:gameshelf_mobile/models/metadata.dart';
import 'package:gameshelf_mobile/models/metadata_sync.dart';
import 'package:gameshelf_mobile/providers/catalog_provider.dart';
import 'package:gameshelf_mobile/providers/games_provider.dart';
import 'package:gameshelf_mobile/providers/metadata_sync_provider.dart';
import 'package:gameshelf_mobile/screens/metadata_review_screen.dart';
import 'package:gameshelf_mobile/screens/quick_add_game_sheet.dart';

class FakeGamesNotifier extends GamesNotifier {
  final created = <Game>[];

  @override
  Future<List<Game>> build() async => const [];

  @override
  Future<Game> create(Game game) async {
    created.add(game);
    return Game(id: 'new', title: game.title, status: game.status, platformId: game.platformId);
  }
}

MetadataSyncItem item(String status, {List<String> applied = const [], List<GameMetadataCandidate> candidates = const []}) =>
    MetadataSyncItem(gameId: 'g-$status', title: 'Hades $status', status: status, appliedFields: applied, candidates: candidates);

void main() {
  test('MetadataReview lê itens, campos aplicados e candidatos', () {
    final review = MetadataReview.fromJson({
      'count': 1,
      'items': [
        {
          'gameId': 'g1',
          'title': 'Hades',
          'coverUrl': null,
          'status': 'APPLIED_AUTO',
          'appliedFields': ['description', 'genreIds'],
          'candidates': [
            {'providerId': 'igdb-1', 'title': 'Hades'},
          ],
          'checkedAt': '2026-05-01T12:00:00.000Z',
        },
      ],
    });
    expect(review.count, 1);
    expect(review.items.single.appliedFields, ['description', 'genreIds']);
    expect(review.items.single.candidates.single.providerId, 'igdb-1');
  });

  testWidgets('a tela de revisão mostra cada estado com as ações certas', (tester) async {
    final review = MetadataReview(count: 3, items: [
      item('APPLIED_AUTO', applied: ['description', 'coverUrl']),
      item('NEEDS_REVIEW', candidates: const [GameMetadataCandidate(providerId: 'igdb-2', title: 'Hades II', releaseYear: 2024)]),
      item('NOT_FOUND'),
    ]);
    await tester.pumpWidget(ProviderScope(
      overrides: [metadataReviewProvider.overrideWith((ref) async => review)],
      child: const MaterialApp(home: MetadataReviewScreen()),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Preenchido sozinho: descrição, capa'), findsOneWidget);
    expect(find.text('Confirmar'), findsOneWidget);
    expect(find.text('Desfazer'), findsOneWidget);
    expect(find.text('Mais de um resultado possível'), findsOneWidget);
    expect(find.text('Hades II'), findsOneWidget);
    expect(find.text('Usar este'), findsOneWidget);
    expect(find.text('Nada encontrado com este título'), findsOneWidget);
    expect(find.text('Buscar outro'), findsNWidgets(2));
    expect(find.text('Ignorar'), findsNWidgets(2));
  });

  testWidgets('a tela de revisão vazia diz que não há nada a fazer', (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [metadataReviewProvider.overrideWith((ref) async => const MetadataReview(count: 0, items: []))],
      child: const MaterialApp(home: MetadataReviewScreen()),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Nada para revisar'), findsOneWidget);
  });

  group('QuickAddGameSheet', () {
    Future<(FakeGamesNotifier, List<QuickAddResult?>)> open(WidgetTester tester, {Future<List<GameMetadataCandidate>> Function(String)? search}) async {
      final notifier = FakeGamesNotifier();
      final results = <QuickAddResult?>[];
      await tester.pumpWidget(ProviderScope(
        overrides: [
          gamesProvider.overrideWith(() => notifier),
          platformsProvider.overrideWith((ref) async => const [CatalogItem(id: 'p1', name: 'PC')]),
        ],
        child: MaterialApp(
          home: Builder(
            builder: (context) => Scaffold(
              body: ElevatedButton(
                onPressed: () async => results.add(await showModalBottomSheet<QuickAddResult>(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => QuickAddGameSheet(search: search ?? (_) async => const [], debounce: const Duration(milliseconds: 10)),
                )),
                child: const Text('abrir'),
              ),
            ),
          ),
        ),
      ));
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();
      return (notifier, results);
    }

    testWidgets('adiciona só com o título e o status Na biblioteca', (tester) async {
      final (notifier, results) = await open(tester);
      await tester.enterText(find.byType(TextField), 'Hades');
      await tester.tap(find.text('Adicionar'));
      await tester.pumpAndSettle();
      expect(notifier.created.single.title, 'Hades');
      expect(notifier.created.single.status, 'BACKLOG');
      expect(results.single!.game!.id, 'new');
    });

    testWidgets('exige título e oferece o editor completo', (tester) async {
      final (_, results) = await open(tester);
      await tester.tap(find.text('Adicionar'));
      await tester.pump();
      expect(find.text('Informe o título do jogo.'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'Hollow');
      await tester.tap(find.text('Mais detalhes'));
      await tester.pumpAndSettle();
      expect(results.single!.moreDetailsTitle, 'Hollow');
    });

    testWidgets('sugere o título oficial enquanto digita', (tester) async {
      final (_, _) = await open(tester, search: (_) async => const [GameMetadataCandidate(providerId: 'i', title: 'Hades', releaseYear: 2020)]);
      await tester.enterText(find.byType(TextField), 'hades');
      await tester.pump(const Duration(milliseconds: 50));
      await tester.pump();
      expect(find.text('Hades (2020)'), findsOneWidget);
      await tester.tap(find.text('Hades (2020)'));
      await tester.pump();
      expect(find.widgetWithText(TextField, 'Hades'), findsOneWidget);
    });
  });
}
