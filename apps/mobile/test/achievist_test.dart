import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:gameshelf_mobile/models/catalog.dart';
import 'package:gameshelf_mobile/models/external_match.dart';
import 'package:gameshelf_mobile/models/game.dart';
import 'package:gameshelf_mobile/models/platform_summary.dart';
import 'package:gameshelf_mobile/providers/achievist_provider.dart';
import 'package:gameshelf_mobile/providers/catalog_provider.dart';
import 'package:gameshelf_mobile/providers/games_provider.dart';
import 'package:gameshelf_mobile/screens/achievist_screen.dart';

class FakeGamesNotifier extends GamesNotifier {
  FakeGamesNotifier(this.games);

  final List<Game> games;

  @override
  Future<List<Game>> build() async => games;
}

const hades = Game(id: 'game-1', title: 'Hades', status: 'BACKLOG', releaseYear: 2020);
const hadesTwo = Game(id: 'game-2', title: 'HADES!', status: 'BACKLOG');

ExternalPendingMatch match({
  String id = 'm1',
  String title = 'Hades',
  List<MatchSuggestion> suggestions = const [MatchSuggestion(gameId: 'game-1', title: 'Hades')],
  bool ambiguous = false,
  int? minutes = 1200,
}) =>
    ExternalPendingMatch(
      id: id,
      title: title,
      platformName: 'PlayStation 5',
      accountLabel: 'fulano',
      externalPlaytimeMinutes: minutes,
      suggestions: suggestions,
      ambiguous: ambiguous,
    );

Widget app(List<ExternalPendingMatch> pending, {SyncState? sync, IntegrationStatus? status}) => ProviderScope(
      overrides: [
        gamesProvider.overrideWith(() => FakeGamesNotifier(const [hades, hadesTwo])),
        platformsProvider.overrideWith((ref) async => const [CatalogItem(id: 'p1', name: 'PlayStation 5', iconKey: 'playstation', color: '#0070D1')]),
        achievistStatusProvider.overrideWith((ref) async => status ?? const IntegrationStatus(configured: true, reachable: true, accounts: 5)),
        achievistSyncStateProvider.overrideWith((ref) async => sync ?? SyncState(status: 'succeeded', finishedAt: DateTime.now().subtract(const Duration(minutes: 19)), fetched: 4, updated: 1, pending: 1)),
        achievistPendingProvider.overrideWith((ref) async => pending),
      ],
      child: const MaterialApp(home: AchievistScreen()),
    );

void main() {
  setUpAll(() async {
    await initializeDateFormatting('pt_BR');
  });

  Future<void> tall(WidgetTester tester) async {
    tester.view.physicalSize = const Size(800, 6000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  group('modelos', () {
    test('ExternalPendingMatch lê as sugestões e sabe o que cabe no lote', () {
      final parsed = ExternalPendingMatch.fromJson({
        'id': 'm1', 'title': 'Hades', 'platformName': 'Steam', 'accountLabel': null,
        'externalPlaytimeMinutes': 1200, 'externalLastPlayedAt': '2026-05-20T22:00:00.000Z',
        'suggestions': [{'gameId': 'game-1', 'title': 'Hades'}], 'ambiguous': false,
      });
      expect(parsed.singleSuggestion, isTrue);
      expect(match(ambiguous: true, suggestions: const [MatchSuggestion(gameId: 'a', title: 'A'), MatchSuggestion(gameId: 'b', title: 'B')]).singleSuggestion, isFalse);
    });

    test('SyncState lê o resumo da rodada', () {
      final state = SyncState.fromJson({
        'status': 'succeeded', 'startedAt': null, 'finishedAt': '2026-06-01T12:00:05.000Z', 'error': null,
        'summary': {'fetched': 4, 'updated': 1, 'pending': 2},
      });
      expect((state.fetched, state.updated, state.pending), (4, 1, 2));
    });
  });

  group('AchievistScreen', () {
    testWidgets('mostra a conexão, o resumo e a entrada com a sugestão única já marcada', (tester) async {
      await tall(tester);
      await tester.pumpWidget(app([match()]));
      await tester.pumpAndSettle();

      expect(find.text('Conexão confirmada · 5 contas conectadas'), findsOneWidget);
      expect(find.textContaining('4 entradas lidas'), findsOneWidget);
      expect(find.text('Importados para revisar'), findsOneWidget);
      expect(find.text('Tempo informado pela plataforma: 20h · última atividade', skipOffstage: false), findsNothing);
      expect(find.textContaining('Tempo informado pela plataforma: 20h'), findsOneWidget);
      final chip = tester.widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Hades · 2020 · sugerido'));
      expect(chip.selected, isTrue);
      expect(find.text('PlayStation 5'), findsWidgets);
    });

    testWidgets('ambiguidade: avisa e deixa o vínculo desabilitado até escolher', (tester) async {
      await tall(tester);
      await tester.pumpWidget(app([
        match(
          ambiguous: true,
          suggestions: const [MatchSuggestion(gameId: 'game-1', title: 'Hades'), MatchSuggestion(gameId: 'game-2', title: 'HADES!')],
        ),
      ]));
      await tester.pumpAndSettle();

      expect(find.textContaining('2 jogos da sua biblioteca têm este título'), findsOneWidget);
      final link = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Vincular a um jogo'));
      expect(link.onPressed, isNull);

      await tester.tap(find.textContaining('HADES!'));
      await tester.pumpAndSettle();
      final enabled = tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Vincular a um jogo'));
      expect(enabled.onPressed, isNotNull);
    });

    testWidgets('filtra a fila por ambiguidade e por título', (tester) async {
      await tall(tester);
      await tester.pumpWidget(app([
        match(id: 'm1', title: 'Hades'),
        match(
          id: 'm2',
          title: 'Celeste',
          ambiguous: true,
          suggestions: const [MatchSuggestion(gameId: 'game-1', title: 'Hades'), MatchSuggestion(gameId: 'game-2', title: 'HADES!')],
        ),
      ]));
      await tester.pumpAndSettle();

      await tester.tap(find.widgetWithText(ChoiceChip, 'Ambíguos'));
      await tester.pumpAndSettle();
      expect(find.text('Celeste'), findsOneWidget);
      expect(find.text('Hades'), findsNothing);

      await tester.tap(find.widgetWithText(ChoiceChip, 'Todos'));
      await tester.enterText(find.widgetWithText(TextField, 'Buscar pelo título'), 'hade');
      await tester.pumpAndSettle();
      expect(find.text('Celeste'), findsNothing);
    });

    testWidgets('o lote só aparece com mais de uma entrada de sugestão única', (tester) async {
      await tall(tester);
      await tester.pumpWidget(app([match(id: 'm1'), match(id: 'm2', title: 'Hades II')]));
      await tester.pumpAndSettle();
      expect(find.text('Vincular todos com sugestão única (2)'), findsOneWidget);
    });

    testWidgets('fila vazia mostra "Tudo vinculado"', (tester) async {
      await tall(tester);
      await tester.pumpWidget(app(const []));
      await tester.pumpAndSettle();
      expect(find.textContaining('Tudo vinculado.'), findsOneWidget);
    });

    testWidgets('integração desligada mostra o aviso e esconde a fila', (tester) async {
      await tall(tester);
      await tester.pumpWidget(app(const [], sync: const SyncState(status: 'disabled', error: 'A integração está desligada.')));
      await tester.pumpAndSettle();
      expect(find.text('Integração desligada'), findsOneWidget);
      expect(find.text('Importados para revisar'), findsNothing);
    });

    testWidgets('cadastrar como novo abre o painel com título, estado e posse', (tester) async {
      await tall(tester);
      await tester.pumpWidget(app([match()]));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cadastrar como novo'));
      await tester.pumpAndSettle();
      expect(find.text('Cadastrar e vincular'), findsOneWidget);
      expect(find.text('Possuo este jogo'), findsOneWidget);
    });
  });
}
