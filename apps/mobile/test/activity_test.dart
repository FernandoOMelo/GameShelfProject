import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:gameshelf_mobile/core/achievement_series.dart';
import 'package:gameshelf_mobile/core/timezone.dart';
import 'package:gameshelf_mobile/models/activity.dart';
import 'package:gameshelf_mobile/models/catalog.dart';
import 'package:gameshelf_mobile/models/timeline.dart';
import 'package:gameshelf_mobile/providers/stats_provider.dart';
import 'package:gameshelf_mobile/screens/timeline_screen.dart';
import 'package:gameshelf_mobile/widgets/achievements_chart.dart';

AchievementDay day(int y, int m, int d, int count) => AchievementDay(DateTime.utc(y, m, d), count);

String _today() {
  final now = DateTime.now();
  return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
}

TimelineEvent session({List<TimelineAchievement> achievements = const []}) => TimelineEvent(
      type: TimelineEvent.session,
      at: DateTime.now(),
      date: _today(),
      gameId: 'g1',
      gameTitle: 'Cyberpunk 2077',
      platformId: 'p1',
      durationMinutes: 70,
      achievements: achievements,
    );

void main() {
  setUpAll(() async {
    await initializeDateFormatting('pt_BR');
  });

  group('fuso da API', () {
    test('usa o sinal do getTimezoneOffset do JavaScript (UTC menos local)', () {
      // Em UTC-3 o Dart informa -180 e a API espera +180.
      expect(apiTimezoneOffsetMinutes(), -DateTime.now().timeZoneOffset.inMinutes);
    });
  });

  group('buildCumulativeSeries', () {
    final days = [day(2025, 1, 10, 3), day(2026, 2, 1, 2), day(2026, 2, 5, 1)];
    final now = DateTime(2026, 3, 1);

    test('acumula todo o período e termina no total', () {
      final series = buildCumulativeSeries(days, SeriesRange.all, now: now);
      expect(series.points.first.value, 0);
      expect(series.points.last.value, 6);
    });

    test('o recorte do ano começa no acumulado anterior, não em zero', () {
      final series = buildCumulativeSeries(days, SeriesRange.thisYear, now: now);
      expect(series.points.first.value, 3);
      expect(series.points.last.value, 6);
      expect(series.max, 6);
    });

    test('sem conquistas a curva é uma linha reta em zero', () {
      final series = buildCumulativeSeries(const [], SeriesRange.all, now: now);
      expect(series.points.every((point) => point.value == 0), isTrue);
    });

    test('niceMax arredonda para uma escala legível', () {
      expect(niceMax(1400), 2000);
      expect(niceMax(6), 8);
      expect(niceMax(0), 4);
    });
  });

  group('relativeDay', () {
    final now = DateTime(2026, 11, 1, 12);
    test('hoje, ontem, há N dias e data por extenso', () {
      expect(relativeDay('2026-11-01', now: now), 'Hoje');
      expect(relativeDay('2026-10-31', now: now), 'Ontem');
      expect(relativeDay('2026-10-29', now: now), 'há 3 dias');
      expect(relativeDay('2026-10-12', now: now), '12 de outubro de 2026');
    });
  });

  group('TimelineEvent', () {
    test('parseia conquistas e o total do dia', () {
      final event = TimelineEvent.fromJson({
        'type': 'ACHIEVEMENTS_UNLOCKED', 'at': '2026-10-31T02:15:43.000Z', 'date': '2026-10-30',
        'gameId': 'g1', 'gameTitle': 'Cyberpunk 2077', 'coverUrl': null, 'count': 14, 'platformId': 'p1',
        'achievements': [
          {'name': 'Trophy 51', 'description': null, 'iconUrl': null, 'unlockedAt': '2026-10-31T02:15:43.000Z'},
        ],
      });
      expect(event.type, TimelineEvent.achievementsUnlocked);
      expect(event.unlockedCount, 14);
      expect(event.achievements.single.name, 'Trophy 51');
      expect(event.platformId, 'p1');
    });

    test('sessão sem o campo de conquistas continua válida', () {
      final event = TimelineEvent.fromJson({
        'type': 'SESSION', 'at': '2026-10-07T20:00:00.000Z', 'date': '2026-10-07',
        'gameId': 'g1', 'gameTitle': 'Hades', 'sessionId': 's1', 'durationMinutes': 90,
      });
      expect(event.achievements, isEmpty);
      expect(event.unlockedCount, 0);
    });
  });

  group('ActivityResponse', () {
    test('lê os dias com conquistas e aceita a resposta antiga sem o campo', () {
      final base = {
        'year': 2026, 'days': [], 'activeDays': 0, 'totalMinutes': 0, 'maxDayMinutes': 0, 'currentStreak': 0, 'longestStreak': 0,
      };
      expect(ActivityResponse.fromJson(base).achievementDays, isEmpty);
      final withDays = ActivityResponse.fromJson({
        ...base,
        'achievementDays': [{'date': '2026-03-10', 'count': 2}],
      });
      expect(withDays.achievementDays.single.count, 2);
    });
  });

  group('FeedCard', () {
    Widget host(Widget child) => MaterialApp(home: Scaffold(body: SingleChildScrollView(child: child)));
    const platform = CatalogItem(id: 'p1', name: 'PlayStation 5', iconKey: 'playstation', color: '#0070D1');
    final achievement = TimelineAchievement(
      name: 'Todos os homens da presidente',
      description: 'Salve a presidente Myers.',
      unlockedAt: DateTime(2026, 10, 31, 20, 30),
    );

    testWidgets('mostra a conquista dentro da sessão e abre o detalhe ao tocar', (tester) async {
      await tester.pumpWidget(host(FeedCard(event: session(achievements: [achievement]), platform: platform, onOpenGame: (_) {})));

      expect(find.textContaining('Jogou durante 1h 10min e desbloqueou 1 conquista em', findRichText: true), findsOneWidget);
      expect(find.text('Hoje'), findsOneWidget);

      await tester.tap(find.byTooltip('Todos os homens da presidente'));
      await tester.pumpAndSettle();
      expect(find.text('Salve a presidente Myers.'), findsOneWidget);
    });

    testWidgets('conquistas sem sessão aparecem só como informação', (tester) async {
      final event = TimelineEvent(
        type: TimelineEvent.achievementsUnlocked,
        at: DateTime.now(),
        date: _today(),
        gameId: 'g1',
        gameTitle: 'Cyberpunk 2077',
        count: 14,
        achievements: [achievement],
      );
      await tester.pumpWidget(host(FeedCard(event: event, platform: platform, onOpenGame: (_) {})));
      expect(find.textContaining('Desbloqueou 14 conquistas em', findRichText: true), findsOneWidget);
      expect(find.textContaining('Jogou durante', findRichText: true), findsNothing);
      expect(find.text('+13'), findsOneWidget);
    });
  });

  group('AchievementsChart', () {
    testWidgets('desenha a curva e aceita toque para ver o valor do dia', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [
          achievementSeriesProvider.overrideWith((ref) async => AchievementSeries(total: 3, days: [day(2025, 1, 10, 3)])),
        ],
        child: const MaterialApp(home: Scaffold(body: SingleChildScrollView(child: AchievementsChart()))),
      ));
      await tester.pumpAndSettle();
      expect(find.text('Conquistas ao longo do tempo'), findsOneWidget);

      await tester.tapAt(tester.getCenter(find.byType(CustomPaint).last));
      await tester.pump();
    });

    testWidgets('some quando não há conquistas com data', (tester) async {
      await tester.pumpWidget(ProviderScope(
        overrides: [achievementSeriesProvider.overrideWith((ref) async => const AchievementSeries(total: 0, days: []))],
        child: const MaterialApp(home: Scaffold(body: AchievementsChart())),
      ));
      await tester.pumpAndSettle();
      expect(find.text('Conquistas ao longo do tempo'), findsNothing);
    });
  });
}
