import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gameshelf_mobile/models/catalog.dart';
import 'package:gameshelf_mobile/models/platform_summary.dart';
import 'package:gameshelf_mobile/providers/catalog_provider.dart';
import 'package:gameshelf_mobile/providers/platforms_provider.dart';
import 'package:gameshelf_mobile/screens/platforms_screen.dart';
import 'package:gameshelf_mobile/widgets/platform_logo.dart';
import 'package:gameshelf_mobile/widgets/section.dart';

PlatformSummary summary(String id, String name,
        {String? iconKey, String? color, String? parentId, int games = 0, int completed = 0, int externalMinutes = 0, int unlocked = 0, int total = 0}) =>
    PlatformSummary(
      platform: CatalogItem(id: id, name: name, iconKey: iconKey, color: color, parentId: parentId),
      gameCount: games,
      completedCount: completed,
      externalPlayedMinutes: externalMinutes,
      achievementsUnlocked: unlocked,
      achievementsTotal: total,
    );

Widget app(List<PlatformSummary> items, {SyncState? sync}) => ProviderScope(
      overrides: [
        platformSummariesProvider.overrideWith((ref) async => items),
        platformsProvider.overrideWith((ref) async => items.map((item) => item.platform).toList()),
        syncStateProvider.overrideWith((ref) async => sync),
        platformCatalogProvider.overrideWith((ref) async => const [
              PlatformCatalogEntry(name: 'Rockstar', catalogKey: 'rockstar', iconKey: 'rockstar', color: '#F08A00'),
              PlatformCatalogEntry(name: 'Steam', catalogKey: 'steam', iconKey: 'steam', color: '#2A6FA8'),
            ]),
      ],
      child: const MaterialApp(home: PlatformsScreen()),
    );

void main() {
  group('formatHours', () {
    test('usa minutos abaixo de uma hora e Xh Ymin até 100 h', () {
      expect(formatHours(0.7), '42min');
      expect(formatHours(0), '0min');
      expect(formatHours(1.5), '1h 30min');
      expect(formatHours(5 + 17 / 60), '5h 17min');
      expect(formatHours(10), '10h');
      expect(formatHours(null), '—');
    });

    test('acima de 100 h mostra só as horas, com separador de milhar', () {
      expect(formatHours(109.25), '109h');
      expect(formatHours(1569.4), '1.569h');
    });

    test('formatMinutes segue o mesmo padrão', () {
      expect(formatMinutes(45), '45min');
      expect(formatMinutes(90), '1h 30min');
      expect(formatMinutes(null), 'Em andamento');
    });
  });

  group('hexColor', () {
    test('aceita #RRGGBB e rejeita o resto', () {
      expect(hexColor('#0070D1'), const Color(0xFF0070D1));
      expect(hexColor('0070D1'), isNull);
      expect(hexColor(null), isNull);
    });
  });

  group('PlatformsScreen', () {
    testWidgets('mostra contadores, progresso e omite o que não tem dado', (tester) async {
      await tester.pumpWidget(app([
        summary('1', 'PlayStation 5', iconKey: 'playstation', color: '#0070D1', games: 3, completed: 1, externalMinutes: 90, unlocked: 30, total: 120),
        summary('2', 'PC', iconKey: 'pc', color: '#5B6573', games: 2),
      ], sync: SyncState(status: 'succeeded', finishedAt: DateTime.now().subtract(const Duration(minutes: 19)))));
      await tester.pumpAndSettle();

      expect(find.text('PlayStation 5'), findsOneWidget);
      expect(find.text('1h 30min'), findsOneWidget);
      expect(find.text('Zerados 33%'.toUpperCase()), findsOneWidget);
      expect(find.text('Conquistas 30 de 120'.toUpperCase()), findsOneWidget);
      expect(find.text('Pronto'), findsOneWidget);
      expect(find.text('Sync há 19 minutos'), findsOneWidget);
      // PC não tem dado do Achievist: aparece como manual e sem tempo.
      expect(find.text('Manual'), findsOneWidget);
      expect(find.text('Dados registrados manualmente'), findsOneWidget);
    });

    testWidgets('mostra o estado vazio com a ação de adicionar', (tester) async {
      await tester.pumpWidget(app(const []));
      await tester.pumpAndSettle();
      expect(find.text('Nenhuma plataforma ainda. Adicione uma para agrupar seus jogos.'), findsOneWidget);
      expect(find.text('Adicionar plataforma'), findsOneWidget);
    });

    testWidgets('o cadastro oferece o catálogo e preenche o nome ao escolher', (tester) async {
      await tester.pumpWidget(app([summary('1', 'PC', iconKey: 'pc', games: 1)]));
      await tester.pumpAndSettle();

      await tester.tap(find.byTooltip('Adicionar plataforma'));
      await tester.pumpAndSettle();
      expect(find.text('Rockstar'), findsOneWidget);
      await tester.tap(find.text('Rockstar'));
      await tester.pumpAndSettle();

      final nameField = tester.widget<TextField>(find.widgetWithText(TextField, 'Rockstar'));
      expect(nameField.controller!.text, 'Rockstar');
      expect(find.text('#F08A00'), findsOneWidget);
    });
  });
}
