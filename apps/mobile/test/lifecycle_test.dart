import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gameshelf_mobile/models/game.dart';
import 'package:gameshelf_mobile/models/lifecycle.dart';
import 'package:gameshelf_mobile/screens/finish_game_sheet.dart';
import 'package:gameshelf_mobile/screens/journey_start_sheet.dart';

Map<String, dynamic> gameJson({String status = 'PLAYING', String? completedAt}) => {
      'id': 'game-1',
      'title': 'Hades',
      'genreIds': <String>[],
      'platformIds': <String>[],
      'status': status,
      'favorite': false,
      'gameOfYear': false,
      'excludedFromSuggestions': false,
      'owned': true,
      'archived': false,
      'priority': 'NORMAL',
      'retroactivePlayedHours': 0,
      'completedAt': completedAt,
    };

Map<String, dynamic> hintJson(String mode, {Map<String, dynamic>? last}) => {
      'start': {
        'mode': mode,
        'journeyId': null,
        'nextSequence': 2,
        'suggestedPlatformId': null,
        'gameStatusAfter': 'PLAYING',
        'lastSession': last,
      },
      'finish': {'journeyId': null, 'hasOpenSession': false, 'suggestedCompletedAt': '2026-05-01'},
    };

void main() {
  group('LifecycleHint', () {
    test('lê o modo, a sequência e onde parou', () {
      final hint = LifecycleHint.fromJson(hintJson('OFFER_REPLAY', last: {
        'endedAt': '2026-04-01T21:00:00.000Z',
        'progress': 30,
        'location': 'Tártaro',
        'keyDecisions': null,
      }));
      expect(hint.startMode, 'OFFER_REPLAY');
      expect(hint.isOffer, isTrue);
      expect(hint.nextSequence, 2);
      expect(hint.lastSession!.location, 'Tártaro');
      expect(hint.suggestedCompletedAt, '2026-05-01');
    });

    test('jornada ativa não é uma oferta', () {
      expect(LifecycleHint.fromJson(hintJson('LINK_ACTIVE')).isOffer, isFalse);
    });
  });

  group('JourneyStartSheet', () {
    Future<void> pump(WidgetTester tester, LifecycleHint hint, ValueChanged<bool?> onResult) async {
      await tester.pumpWidget(MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: ElevatedButton(
              onPressed: () async => onResult(await showModalBottomSheet<bool>(
                context: context,
                builder: (_) => JourneyStartSheet(game: Game.fromJson(gameJson()), hint: hint),
              )),
              child: const Text('abrir'),
            ),
          ),
        ),
      ));
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();
    }

    testWidgets('primeira jornada: um toque confirma e mostra onde parou', (tester) async {
      bool? result;
      final hint = LifecycleHint.fromJson(hintJson('OFFER_FIRST', last: {
        'endedAt': '2026-04-01T21:00:00.000Z',
        'progress': 30,
        'location': 'Tártaro',
        'keyDecisions': null,
      }));
      await pump(tester, hint, (value) => result = value);
      expect(find.text('Iniciar a jornada?'), findsOneWidget);
      expect(find.text('Parou em: Tártaro · 30%'), findsOneWidget);
      await tester.tap(find.text('Iniciar jornada #2'));
      await tester.pumpAndSettle();
      expect(result, isTrue);
    });

    testWidgets('"Agora não" dispensa o convite de replay', (tester) async {
      bool? result;
      await pump(tester, LifecycleHint.fromJson(hintJson('OFFER_REPLAY')), (value) => result = value);
      expect(find.text('Começar um replay?'), findsOneWidget);
      await tester.tap(find.text('Agora não'));
      await tester.pumpAndSettle();
      expect(result, isFalse);
    });
  });

  group('FinishGameSheet', () {
    FinishResult result() => FinishResult.fromJson({
          'game': gameJson(status: 'COMPLETED', completedAt: '2026-05-01'),
          'undo': {'status': 'PLAYING', 'journey': {'action': 'NONE', 'id': null}},
        });

    testWidgets('percorre as etapas e grava só o que foi preenchido', (tester) async {
      Map<String, dynamic>? saved;
      FinishResult? closed;
      await tester.pumpWidget(MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: ElevatedButton(
              onPressed: () async => closed = await showModalBottomSheet<FinishResult>(
                context: context,
                isScrollControlled: true,
                builder: (_) => FinishGameSheet(
                  result: result(),
                  onChangeDate: (_) async => result(),
                  onSaveExtras: (values) async => saved = values,
                ),
              ),
              child: const Text('abrir'),
            ),
          ),
        ),
      ));
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();

      expect(find.text('Hades zerado!'), findsOneWidget);
      expect(find.text('Em 01/05/2026'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('rating-10')));
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('difficulty-AA')));
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Próximo')); // extras puláveis
      await tester.pumpAndSettle();
      expect(find.text('Nota'), findsOneWidget);
      await tester.tap(find.text('Concluir'));
      await tester.pumpAndSettle();

      expect(saved, {'rating': 10, 'difficulty': 'AA'});
      expect(closed, isNotNull);
    });

    testWidgets('pular tudo fecha sem gravar nada', (tester) async {
      var saves = 0;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: FinishGameSheet(result: result(), onChangeDate: (_) async => result(), onSaveExtras: (_) async { saves += 1; return null; }),
        ),
      ));
      for (var i = 0; i < 3; i++) {
        await tester.tap(find.text('Pular'));
        await tester.pumpAndSettle();
      }
      await tester.tap(find.text('Concluir'));
      await tester.pumpAndSettle();
      expect(saves, 0);
    });
  });

  test('canFinish exclui desejados e já zerados', () {
    expect(canFinish(Game.fromJson(gameJson(status: 'PLAYING'))), isTrue);
    expect(canFinish(Game.fromJson(gameJson(status: 'DESIRED'))), isFalse);
    expect(canFinish(Game.fromJson(gameJson(status: 'COMPLETED'))), isFalse);
  });
}
