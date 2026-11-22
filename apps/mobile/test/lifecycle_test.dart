import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gameshelf_mobile/models/game.dart';
import 'package:gameshelf_mobile/models/lifecycle.dart';
import 'package:gameshelf_mobile/screens/finish_game_sheet.dart';
import 'package:gameshelf_mobile/screens/game_detail/review_section.dart';
import 'package:gameshelf_mobile/screens/review_form.dart';
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

    // A etapa de critérios é alta; uma tela maior evita rolar dentro do teste.
    void tallScreen(WidgetTester tester) {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
    }

    testWidgets('percorre as etapas e grava só o que foi preenchido', (tester) async {
      tallScreen(tester);
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
      for (var i = 0; i < 3; i++) {
        await tester.tap(find.text('Próximo')); // extras, critérios e análise puláveis
        await tester.pumpAndSettle();
      }
      expect(find.text('Nota'), findsOneWidget);
      await tester.tap(find.text('Concluir'));
      await tester.pumpAndSettle();

      expect(saved, {'rating': 10, 'difficulty': 'AA'});
      expect(closed, isNotNull);
    });

    testWidgets('grava a análise com critérios e texto quando preenchida', (tester) async {
      tallScreen(tester);
      Map<String, dynamic>? saved;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: FinishGameSheet(result: result(), onChangeDate: (_) async => result(), onSaveExtras: (values) async => saved = values),
        ),
      ));
      for (var i = 0; i < 3; i++) {
        await tester.tap(find.text('Pular'));
        await tester.pumpAndSettle();
      }
      await tester.tap(find.byKey(const ValueKey('soundtrack-10')));
      await tester.enterText(find.byKey(const ValueKey('gameplay-comment')), 'Combate fluido');
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byKey(const ValueKey('review-summary')), 'Obra-prima.');
      await tester.tap(find.text('Próximo'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Concluir'));
      await tester.pumpAndSettle();

      expect(saved, {
        'review': {
          'summary': 'Obra-prima.',
          'gameplay': {'score': null, 'comment': 'Combate fluido'},
          'setting': {'score': null, 'comment': null},
          'soundtrack': {'score': 10, 'comment': null},
          'story': {'score': null, 'comment': null},
        },
      });
    });

    testWidgets('pular tudo fecha sem gravar nada', (tester) async {
      tallScreen(tester);
      var saves = 0;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: FinishGameSheet(result: result(), onChangeDate: (_) async => result(), onSaveExtras: (_) async { saves += 1; return null; }),
        ),
      ));
      for (var i = 0; i < 5; i++) {
        await tester.tap(find.text('Pular'));
        await tester.pumpAndSettle();
      }
      await tester.tap(find.text('Concluir'));
      await tester.pumpAndSettle();
      expect(saves, 0);
    });
  });

  testWidgets('ReviewSection mostra só os critérios preenchidos', (tester) async {
    final game = Game.fromJson(gameJson(status: 'COMPLETED')..['review'] = {
      'summary': 'Obra-prima.',
      'gameplay': {'score': 9, 'comment': 'Combate fluido'},
      'setting': {'score': null, 'comment': null},
      'soundtrack': {'score': null, 'comment': null},
      'story': {'score': null, 'comment': null},
    });
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: ReviewSection(review: game.review!))));
    expect(find.text('MINHA ANÁLISE'), findsOneWidget);
    expect(find.text('9/10'), findsOneWidget);
    expect(find.text('Combate fluido'), findsOneWidget);
    expect(find.text('Obra-prima.'), findsOneWidget);
    expect(find.text('Ambientação'), findsNothing);
  });

  group('ReviewEditorSheet', () {
    Game reviewed() => Game.fromJson(gameJson(status: 'COMPLETED')..['review'] = {
          'summary': 'Boa.',
          'gameplay': {'score': 8, 'comment': null},
          'setting': {'score': null, 'comment': null},
          'soundtrack': {'score': null, 'comment': null},
          'story': {'score': null, 'comment': null},
        });

    Future<void> open(WidgetTester tester, Game game, void Function(ReviewEdit?) onResult) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(body: ElevatedButton(onPressed: () async => onResult(await showReviewEditor(context, game)), child: const Text('abrir'))),
        ),
      ));
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();
    }

    testWidgets('carrega a análise atual e salva a alteração', (tester) async {
      ReviewEdit? result;
      await open(tester, reviewed(), (value) => result = value);
      expect(find.text('Boa.'), findsOneWidget);
      await tester.tap(find.byKey(const ValueKey('story-7')));
      await tester.tap(find.text('Salvar'));
      await tester.pumpAndSettle();
      final saved = (result as ReviewSaved).review!;
      expect(saved.summary, 'Boa.');
      expect(saved.criterion('gameplay').score, 8);
      expect(saved.criterion('story').score, 7);
    });

    testWidgets('esvaziar tudo remove a análise e cancelar não altera nada', (tester) async {
      ReviewEdit? result;
      await open(tester, reviewed(), (value) => result = value);
      await tester.tap(find.byKey(const ValueKey('gameplay-8')));
      await tester.enterText(find.byKey(const ValueKey('review-summary')), '');
      await tester.tap(find.text('Salvar'));
      await tester.pumpAndSettle();
      expect((result as ReviewSaved).review, isNull);

      result = null;
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(result, isNull);
    });
  });

  testWidgets('ReviewSection sem análise oferece adicionar', (tester) async {
    var edits = 0;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: ReviewSection(review: null, onEdit: () => edits++))));
    expect(find.text('Ainda sem análise.'), findsOneWidget);
    await tester.tap(find.text('Adicionar análise'));
    expect(edits, 1);
  });

  test('canFinish exclui desejados e já zerados', () {
    expect(canFinish(Game.fromJson(gameJson(status: 'PLAYING'))), isTrue);
    expect(canFinish(Game.fromJson(gameJson(status: 'DESIRED'))), isFalse);
    expect(canFinish(Game.fromJson(gameJson(status: 'COMPLETED'))), isFalse);
  });
}
