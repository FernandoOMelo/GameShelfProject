import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:gameshelf_mobile/core/achievement_series.dart';
import 'package:gameshelf_mobile/models/activity.dart';
import 'package:gameshelf_mobile/models/catalog.dart';
import 'package:gameshelf_mobile/models/platform_summary.dart';
import 'package:gameshelf_mobile/models/stats.dart';
import 'package:gameshelf_mobile/providers/catalog_provider.dart';
import 'package:gameshelf_mobile/providers/platforms_provider.dart';
import 'package:gameshelf_mobile/providers/stats_provider.dart';
import 'package:gameshelf_mobile/screens/stats_screen.dart';

StatsResponse stats({bool withData = true}) => StatsResponse.fromJson({
      'library': {
        'gameCount': 6, 'platformLinkCount': 5, 'playthroughCount': 3, 'playthroughsStarted': 3, 'playthroughsCompleted': 2,
        'replaysStarted': 1, 'gamesWithCompletedPlaythrough': 2, 'gamesWithoutPlaythrough': 1,
        'localPlayedHours': 42, 'externalPlaytimeHours': 10, 'externalCountedHours': 6, 'consolidatedPlayedHours': 48,
        'externalPlaytimeByPlatform': [{'key': 'p1', 'name': 'PlayStation 5', 'hours': 10.0}, {'key': 'p2', 'name': 'PC', 'hours': 0.0}],
      },
      'totals': {
        'completedCount': withData ? 2 : 0, 'completedHours': withData ? 42 : 0, 'averageCompletedHours': withData ? 21 : null,
        'longestGame': null, 'shortestGame': null, 'journeyStart': '2024-01-01', 'journeyDays': 400,
        'completionRate': 66.7, 'averageHoursPerGame': 14,
      },
      'ratingDistribution': [{'rating': 11, 'count': withData ? 1 : 0}],
      'difficultyDistribution': [{'difficulty': 'C', 'count': 0}],
      'byGenre': withData
          ? [
              {'key': 'g1', 'name': 'RPG', 'completedCount': 2, 'hours': 42, 'averageRating': 9},
              {'key': 'g2', 'name': 'Ação', 'completedCount': 1, 'hours': 10, 'averageRating': null},
            ]
          : [],
      'byType': [], 'byPlatform': [],
      'byYear': [{'year': 2025, 'completedCount': 2, 'hours': 42, 'gameOfYear': null}],
      'favorites': withData ? [{'id': 'x', 'title': 'Hades', 'coverUrl': null, 'hours': 30, 'rating': 11}] : [],
      'topGenres': [], 'topTypes': [],
      'byReleaseYear': [{'year': 2020, 'count': 2}],
      'byDeveloper': [],
    });

ActivityResponse activity() => ActivityResponse.fromJson({
      'year': DateTime.now().year, 'days': [], 'activeDays': 0, 'totalMinutes': 0, 'maxDayMinutes': 0, 'currentStreak': 0,
      'longestStreak': 0, 'achievementDays': [{'date': '${DateTime.now().year}-03-10', 'count': 2}],
    });

ReplayResponse replay() => ReplayResponse.fromJson({
      'year': DateTime.now().year, 'totalMinutes': 0, 'sessionCount': 0, 'activeDays': 0, 'completedCount': 0,
      'mostPlayedGame': null, 'topGenre': null, 'longestSession': null, 'busiestMonth': null, 'gameOfYear': null,
    });

Widget app(StatsResponse response, {List<Override> extra = const []}) => ProviderScope(
      overrides: [
        statsProvider.overrideWith((ref) async => response),
        platformSummariesProvider.overrideWith((ref) async => const <PlatformSummary>[]),
        platformsProvider.overrideWith((ref) async => const [CatalogItem(id: 'p1', name: 'PlayStation 5', iconKey: 'playstation', color: '#0070D1')]),
        achievementSeriesProvider.overrideWith((ref) async => const AchievementSeries(total: 0, days: [])),
        activityProvider.overrideWith((ref, year) async => activity()),
        replayProvider.overrideWith((ref, year) async => replay()),
        ...extra,
      ],
      child: const MaterialApp(home: StatsScreen()),
    );

void main() {
  setUpAll(() async {
    await initializeDateFormatting('pt_BR');
  });

  Future<void> tall(WidgetTester tester) async {
    tester.view.physicalSize = const Size(800, 9000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  group('LibraryStats', () {
    test('lê a biblioteca e aceita a resposta antiga sem o bloco', () {
      expect(stats().library!.consolidatedPlayedHours, 48);
      expect(stats().library!.externalPlaytimeByPlatform, hasLength(2));
      final legacy = Map<String, dynamic>.from({
        'totals': {
          'completedCount': 0, 'completedHours': 0, 'journeyDays': 0, 'completionRate': 0,
        },
        'ratingDistribution': [], 'difficultyDistribution': [], 'byGenre': [], 'byType': [], 'byPlatform': [],
        'byYear': [], 'favorites': [], 'topGenres': [], 'topTypes': [], 'byReleaseYear': [], 'byDeveloper': [],
      });
      expect(StatsResponse.fromJson(legacy).library, isNull);
    });
  });

  group('StatsScreen', () {
    testWidgets('mostra os destaques, as seções e esconde as seções vazias numa faixa', (tester) async {
      await tall(tester);
      await tester.pumpWidget(app(stats()));
      await tester.pumpAndSettle();

      expect(find.text('Jogos zerados'), findsOneWidget);
      expect(find.text('Total consolidado'), findsOneWidget);
      expect(find.text('48h'), findsOneWidget);
      expect(find.text('Biblioteca'), findsOneWidget);
      expect(find.text('Jornadas'), findsOneWidget);
      expect(find.text('Tempo'), findsOneWidget);
      // Tempo por plataforma: só a que tem horas.
      expect(find.text('Tempo informado por plataforma'), findsOneWidget);
      expect(find.text('PC'), findsNothing);
      // Por gênero com participação percentual.
      expect(find.text('RPG'), findsOneWidget);
      expect(find.text('2 · 67%'), findsOneWidget);
      // Seções sem dado vão para a faixa.
      expect(find.text('Ainda sem dados'), findsOneWidget);
      expect(find.text('Por tipo'), findsOneWidget); // listado dentro da faixa
      expect(find.text('Top 10 jogos favoritos'), findsOneWidget);
    });

    testWidgets('sem jogos zerados, os números viram traço com a dica do que os preenche', (tester) async {
      await tall(tester);
      await tester.pumpWidget(app(stats(withData: false)));
      await tester.pumpAndSettle();
      expect(find.text('Zere um jogo para ver'), findsOneWidget);
      expect(find.text('Zere um jogo com horas'), findsWidgets);
    });

    testWidgets('o filtro de ano refaz a consulta só dos jogos zerados', (tester) async {
      await tall(tester);
      final years = <int?>[];
      await tester.pumpWidget(app(stats(), extra: [
        statsProvider.overrideWith((ref) async {
          years.add(ref.watch(statsYearProvider));
          return stats();
        }),
      ]));
      await tester.pumpAndSettle();
      expect(years, [null]);

      await tester.tap(find.widgetWithText(ChoiceChip, '2025'));
      await tester.pumpAndSettle();
      expect(years.last, 2025);
      expect(find.textContaining('Jogos zerados em 2025'), findsOneWidget);
    });

    testWidgets('o mapa de atividade conta os dias com conquistas à parte das horas', (tester) async {
      await tall(tester);
      await tester.pumpWidget(app(stats()));
      await tester.pumpAndSettle();
      expect(find.text('Dias com conquistas'), findsOneWidget);
      expect(find.textContaining('borda roxa'), findsOneWidget);
    });
  });
}
