import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:gameshelf_mobile/models/catalog.dart';
import 'package:gameshelf_mobile/models/game.dart';
import 'package:gameshelf_mobile/models/queue_item.dart';
import 'package:gameshelf_mobile/providers/games_provider.dart';
import 'package:gameshelf_mobile/providers/queue_provider.dart';
import 'package:gameshelf_mobile/screens/game_detail_screen.dart';
import 'package:gameshelf_mobile/models/game_extras.dart';
import 'package:gameshelf_mobile/models/session.dart';
import 'package:gameshelf_mobile/providers/catalog_provider.dart';
import 'package:gameshelf_mobile/providers/game_extras_provider.dart';
import 'package:gameshelf_mobile/screens/game_detail/achievements_panel.dart';
import 'package:gameshelf_mobile/screens/game_detail/journey_panel.dart';
import 'package:gameshelf_mobile/screens/game_detail/sessions_panel.dart';

const gameId = 'game-1';

class FakeSessionsNotifier extends SessionsNotifier {
  @override
  Future<List<Session>> build(String gameId) async => const [];
}

class FakeQueueNotifier extends QueueNotifier {
  @override
  Future<List<QueueItem>> build() async => const [];
}

GamePlatform link({DateTime? start, DateTime? end, int days = 0}) => GamePlatform(
      id: 'link-1',
      gameId: gameId,
      platformId: 'p1',
      owned: true,
      isPrimary: true,
      externalSource: 'achievist',
      externalPlaytimeMinutes: 90,
      externalActivityStartedAt: start,
      externalActivityEndedAt: end,
      externalActivityDays: days,
    );

Widget wrap(Widget child, {List<Override> overrides = const []}) => ProviderScope(
      overrides: overrides,
      child: MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child))),
    );

void main() {
  setUpAll(() async {
    await initializeDateFormatting('pt_BR');
  });

  group('modelos', () {
    test('GamePlatform sabe se ainda há tempo a lançar', () {
      final parsed = GamePlatform.fromJson({
        'id': 'a', 'gameId': gameId, 'platformId': 'p1', 'owned': true, 'isPrimary': false,
        'externalPlaytimeMinutes': 120, 'externalPlaytimeImportedMinutes': 30,
        'externalActivityStartedAt': '2024-01-10T15:00:00.000Z', 'externalActivityDays': 3,
      });
      expect(parsed.canImportPlaytime, isTrue);
      expect(parsed.externalActivityStartedAt, isNotNull);
      expect(parsed.externalActivityDays, 3);
    });

    test('Playthrough nomeia replays e a primeira jornada', () {
      final first = Playthrough.fromJson({'id': 'a', 'gameId': gameId, 'sequence': 1, 'status': 'PLAYING', 'isReplay': false});
      final replay = Playthrough.fromJson({'id': 'b', 'gameId': gameId, 'sequence': 2, 'status': 'COMPLETED', 'isReplay': true});
      expect(first.title, 'Primeira jornada');
      expect(replay.title, 'Replay 1');
    });

    test('GameAchievements parseia a lista mesclada', () {
      final parsed = GameAchievements.fromJson({
        'catalogAvailable': true, 'total': 2, 'unlockedCount': 1, 'percent': 50,
        'achievements': [
          {'id': 'a', 'name': 'Fuga', 'description': 'd', 'iconUrl': null, 'rarityPercent': 80, 'rarityTier': 'COMMON', 'unlocked': true, 'unlockedAt': '2026-10-09T12:21:00.000Z', 'secret': false, 'isCompletionTrophy': false},
          {'id': 'b', 'name': null, 'description': null, 'iconUrl': null, 'rarityPercent': 2.3, 'rarityTier': 'ULTRA_RARE', 'unlocked': false, 'unlockedAt': null, 'secret': true, 'isCompletionTrophy': true},
        ],
        'rarityBreakdown': {'common': 1, 'uncommon': 0, 'rare': 0, 'ultraRare': 1},
      });
      expect(parsed.achievements.where((item) => item.secret), hasLength(1));
      expect(parsed.rarityBreakdown['ultraRare'], 1);
    });
  });

  group('GameAchievementsPanel', () {
    GameAchievements data() => const GameAchievements(
          catalogAvailable: true,
          total: 2,
          unlockedCount: 1,
          percent: 50,
          achievements: [
            MergedAchievement(id: 'a', name: 'Fuga do abismo', description: 'Conclua o primeiro escape.', unlocked: true, rarityPercent: 80),
            MergedAchievement(id: 'b', rarityTier: 'ULTRA_RARE', rarityPercent: 2.3, secret: true),
          ],
        );

    testWidgets('separa as conquistas por plataforma em abas', (tester) async {
      const groups = [
        AchievementGroup(id: 'ps', name: 'PlayStation 5', total: 1, unlockedCount: 1, percent: 100, achievements: [
          MergedAchievement(id: 'a', name: 'Troféu PSN', description: 'x', unlocked: true),
        ]),
        AchievementGroup(id: 'pc', name: 'PC', total: 1, unlockedCount: 0, percent: 0, achievements: [
          MergedAchievement(id: 'b', name: 'Conquista Steam', description: 'y'),
        ]),
      ];
      await tester.pumpWidget(wrap(const GameAchievementsPanel(gameId: gameId), overrides: [
        gameAchievementsProvider(gameId).overrideWith((ref) async => const GameAchievements(
              catalogAvailable: true, total: 2, unlockedCount: 1, percent: 50, achievements: [], groups: groups)),
      ]));
      await tester.pumpAndSettle();
      expect(find.text('Troféu PSN'), findsOneWidget);
      expect(find.text('Conquista Steam'), findsNothing);

      await tester.tap(find.text('PC · 0/1'));
      await tester.pumpAndSettle();
      expect(find.text('Conquista Steam'), findsOneWidget);
      expect(find.text('Troféu PSN'), findsNothing);
      expect(find.text('0/1 · 0%'), findsOneWidget);
    });

    testWidgets('mantém a secreta oculta até o usuário ativar a opção', (tester) async {
      await tester.pumpWidget(wrap(const GameAchievementsPanel(gameId: gameId),
          overrides: [gameAchievementsProvider(gameId).overrideWith((ref) async => data())]));
      await tester.pumpAndSettle();

      expect(find.text('1/2 · 50%'), findsOneWidget);
      expect(find.text('Fuga do abismo'), findsOneWidget);
      expect(find.text('Conquista secreta'), findsNothing);

      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();
      expect(find.text('Conquista secreta'), findsOneWidget);
      expect(find.text('Os detalhes desta conquista serão revelados quando desbloqueada'), findsOneWidget);
    });

    testWidgets('avisa quando ainda não há catálogo vinculado', (tester) async {
      await tester.pumpWidget(wrap(const GameAchievementsPanel(gameId: gameId), overrides: [
        gameAchievementsProvider(gameId).overrideWith((ref) async =>
            const GameAchievements(catalogAvailable: false, total: 0, unlockedCount: 0, percent: 0, achievements: [])),
      ]));
      await tester.pumpAndSettle();
      expect(find.textContaining('Ainda sem catálogo vinculado'), findsOneWidget);
    });
  });

  group('GameJourneyPanel', () {
    List<Override> overrides(List<GamePlatform> links) => [
          gamePlatformsProvider(gameId).overrideWith((ref) async => links),
          playthroughsProvider(gameId).overrideWith((ref) async => const <Playthrough>[]),
          playthroughMetricsProvider(gameId).overrideWith((ref) async => const PlaythroughMetrics()),
          platformsProvider.overrideWith((ref) async => const [CatalogItem(id: 'p1', name: 'PlayStation 5', iconKey: 'playstation', color: '#0070D1')]),
        ];

    testWidgets('sugere início e zerado e só grava ao tocar', (tester) async {
      final applied = <String>[];
      await tester.pumpWidget(wrap(
        GameJourneyPanel(
          gameId: gameId,
          gameStatus: 'COMPLETED',
          gameStartedAt: null,
          gameCompletedAt: null,
          onApplyDate: (field, value) async => applied.add('$field=$value'),
          onGameChanged: () {},
        ),
        overrides: overrides([link(start: DateTime(2024, 1, 10, 12), end: DateTime(2024, 2, 20, 12), days: 12)]),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Datas sugeridas pelo Achievist'), findsOneWidget);
      expect(applied, isEmpty);
      await tester.tap(find.textContaining('como início'));
      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('como data de zerado'));
      await tester.pumpAndSettle();
      expect(applied, ['startedAt=2024-01-10', 'completedAt=2024-02-20']);
    });

    testWidgets('não sugere o que o jogo já tem nem o zerado de um jogo que não foi zerado', (tester) async {
      await tester.pumpWidget(wrap(
        GameJourneyPanel(
          gameId: gameId,
          gameStatus: 'PLAYING',
          gameStartedAt: '2024-01-01',
          gameCompletedAt: null,
          onApplyDate: (_, _) async {},
          onGameChanged: () {},
        ),
        overrides: overrides([link(start: DateTime(2024, 1, 10, 12), end: DateTime(2024, 2, 20, 12))]),
      ));
      await tester.pumpAndSettle();
      expect(find.text('Datas sugeridas pelo Achievist'), findsNothing);
      expect(find.text('PlayStation 5'), findsOneWidget);
      expect(find.text('Iniciar jornada'), findsOneWidget);
    });
  });

  group('SessionsPanel', () {
    Future<List<double>> pump(WidgetTester tester, {double retro = 10}) async {
      final saved = <double>[];
      await tester.pumpWidget(wrap(SessionsPanel(
        sessions: [Session(id: 's1', gameId: gameId, startedAt: DateTime(2026, 10, 7, 20), durationMinutes: 90, endedAt: DateTime(2026, 10, 7, 21, 30))],
        retroactiveHours: retro,
        onSetRetroactive: (total) async => saved.add(total),
        onEdit: (_) {},
        onDelete: (_) {},
      )));
      return saved;
    }

    testWidgets('soma horas e minutos ao total lançado', (tester) async {
      final saved = await pump(tester);
      expect(find.text('11h 30min'), findsOneWidget); // 90 min de sessão + 10 h lançadas

      await tester.enterText(find.widgetWithText(TextField, 'Horas'), '5');
      await tester.enterText(find.widgetWithText(TextField, 'Minutos'), '17');
      await tester.tap(find.text('Lançar horas'));
      await tester.pumpAndSettle();
      expect(saved.single, closeTo(15.28, 0.001));
    });

    testWidgets('corrigir substitui o total e minutos inválidos são recusados', (tester) async {
      final saved = await pump(tester);
      await tester.enterText(find.widgetWithText(TextField, 'Horas'), '3');
      await tester.enterText(find.widgetWithText(TextField, 'Minutos'), '75');
      await tester.tap(find.text('Corrigir total'));
      await tester.pumpAndSettle();
      expect(saved, isEmpty);
      expect(find.text('Informe horas inteiras e minutos de 0 a 59.'), findsOneWidget);

      await tester.enterText(find.widgetWithText(TextField, 'Minutos'), '30');
      await tester.tap(find.text('Corrigir total'));
      await tester.pumpAndSettle();
      expect(saved.single, 3.5);
    });

    testWidgets('zerar pede confirmação antes de apagar', (tester) async {
      final saved = await pump(tester);
      await tester.ensureVisible(find.text('Zerar horas lançadas'));
      await tester.tap(find.text('Zerar horas lançadas'));
      await tester.pumpAndSettle();
      expect(saved, isEmpty);
      await tester.tap(find.text('Zerar'));
      await tester.pumpAndSettle();
      expect(saved.single, 0);
    });
  });

  group('GameDetailScreen', () {
    testWidgets('navega entre os jogos da lista com Anterior e Próximo', (tester) async {
      const first = Game(id: 'game-1', title: 'Primeiro jogo', status: 'PLAYING');
      const second = Game(id: 'game-2', title: 'Segundo jogo', status: 'BACKLOG');
      List<Override> forGame(String id) => [
            gamePlatformsProvider(id).overrideWith((ref) async => const <GamePlatform>[]),
            playthroughsProvider(id).overrideWith((ref) async => const <Playthrough>[]),
            playthroughMetricsProvider(id).overrideWith((ref) async => const PlaythroughMetrics()),
            gameAchievementsProvider(id).overrideWith((ref) async =>
                const GameAchievements(catalogAvailable: false, total: 0, unlockedCount: 0, percent: 0, achievements: [])),
            dlcsProvider(id).overrideWith((ref) async => const <Dlc>[]),
          ];
      await tester.pumpWidget(ProviderScope(
        overrides: [
          sessionsForGameProvider.overrideWith(FakeSessionsNotifier.new),
          queueProvider.overrideWith(FakeQueueNotifier.new),
          platformsProvider.overrideWith((ref) async => const <CatalogItem>[]),
          franchisesProvider.overrideWith((ref) async => const <CatalogItem>[]),
          ...forGame('game-1'),
          ...forGame('game-2'),
        ],
        child: const MaterialApp(home: GameDetailScreen(game: first, siblings: [first, second])),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Primeiro jogo'), findsWidgets);
      expect(find.text('1/2'), findsOneWidget);
      expect(tester.widget<TextButton>(find.widgetWithText(TextButton, 'Anterior')).onPressed, isNull);

      await tester.tap(find.widgetWithText(TextButton, 'Próximo'));
      await tester.pumpAndSettle();
      expect(find.text('Segundo jogo'), findsWidgets);
      expect(find.text('2/2'), findsOneWidget);
      expect(tester.widget<TextButton>(find.widgetWithText(TextButton, 'Próximo')).onPressed, isNull);
    });

    testWidgets('mostra o hero com a plataforma e troca entre as abas', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          sessionsForGameProvider.overrideWith(FakeSessionsNotifier.new),
          queueProvider.overrideWith(FakeQueueNotifier.new),
          platformsProvider.overrideWith((ref) async => const [CatalogItem(id: 'p1', name: 'PlayStation 5', iconKey: 'playstation', color: '#0070D1')]),
          franchisesProvider.overrideWith((ref) async => const <CatalogItem>[]),
          gamePlatformsProvider(gameId).overrideWith((ref) async => const <GamePlatform>[]),
          playthroughsProvider(gameId).overrideWith((ref) async => const <Playthrough>[]),
          playthroughMetricsProvider(gameId).overrideWith((ref) async => const PlaythroughMetrics()),
          gameAchievementsProvider(gameId).overrideWith((ref) async => const GameAchievements(
                catalogAvailable: true, total: 1, unlockedCount: 0, percent: 0,
                achievements: [MergedAchievement(id: 'a', name: 'Primeira vitória', description: 'Vença.')],
              )),
          dlcsProvider(gameId).overrideWith((ref) async => const <Dlc>[]),
        ],
        child: const MaterialApp(
          home: GameDetailScreen(game: Game(id: gameId, title: 'Cyberpunk 2077', status: 'PLAYING', platformId: 'p1')),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(Tab, 'Resumo'), findsOneWidget);
      expect(find.widgetWithText(Tab, 'Conquistas'), findsOneWidget);
      expect(find.widgetWithText(Tab, 'Sessões'), findsOneWidget);
      expect(find.widgetWithText(Tab, 'DLC & Franquia'), findsOneWidget);
      expect(find.text('PlayStation 5'), findsWidgets);
      expect(find.text('Nenhuma plataforma associada.'), findsOneWidget);

      await tester.tap(find.widgetWithText(Tab, 'Conquistas'));
      await tester.pumpAndSettle();
      expect(find.text('Primeira vitória'), findsOneWidget);

      await tester.tap(find.widgetWithText(Tab, 'Sessões'));
      await tester.pumpAndSettle();
      expect(find.text('Lançar horas retroativas'), findsOneWidget);

      await tester.tap(find.widgetWithText(Tab, 'DLC & Franquia'));
      await tester.pumpAndSettle();
      expect(find.text('Nenhuma DLC cadastrada para este jogo.'), findsOneWidget);
    });
  });
}
