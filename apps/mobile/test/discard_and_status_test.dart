import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:gameshelf_mobile/screens/game_detail_screen.dart';
import 'package:gameshelf_mobile/widgets/discard_guard.dart';

class _Editor extends StatefulWidget {
  const _Editor();

  @override
  State<_Editor> createState() => _EditorState();
}

class _EditorState extends State<_Editor> {
  final _text = TextEditingController();
  bool _dirty = false;

  @override
  Widget build(BuildContext context) {
    return DiscardGuard(
      isDirty: () => _dirty,
      child: Scaffold(
        appBar: AppBar(title: const Text('Editor')),
        body: Column(children: [
          TextField(controller: _text, onChanged: (_) => _dirty = true),
          ElevatedButton(onPressed: () => Navigator.pop(context, 'saved'), child: const Text('Salvar')),
        ]),
      ),
    );
  }
}

Widget app(ValueChanged<Object?> onResult) => MaterialApp(
      home: Builder(
        builder: (context) => Scaffold(
          body: ElevatedButton(
            onPressed: () async => onResult(await Navigator.push<Object?>(context, MaterialPageRoute(builder: (_) => const _Editor()))),
            child: const Text('abrir'),
          ),
        ),
      ),
    );

void main() {
  group('DiscardGuard', () {
    testWidgets('voltar sem alterações fecha sem perguntar', (tester) async {
      await tester.pumpWidget(app((_) {}));
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.text('Editor'), findsNothing);
      expect(find.text('Descartar alterações?'), findsNothing);
    });

    testWidgets('com alterações pergunta; continuar mantém e descartar fecha', (tester) async {
      await tester.pumpWidget(app((_) {}));
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Hades');
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.text('Descartar alterações?'), findsOneWidget);

      await tester.tap(find.text('Continuar editando'));
      await tester.pumpAndSettle();
      expect(find.text('Editor'), findsOneWidget);

      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Descartar'));
      await tester.pumpAndSettle();
      expect(find.text('Editor'), findsNothing);
    });

    testWidgets('salvar fecha sem passar pela pergunta', (tester) async {
      Object? result;
      await tester.pumpWidget(app((value) => result = value));
      await tester.tap(find.text('abrir'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Hades');
      await tester.tap(find.text('Salvar'));
      await tester.pumpAndSettle();
      expect(result, 'saved');
      expect(find.text('Descartar alterações?'), findsNothing);
    });
  });

  test('quickStatusActions oferece só o que faz sentido para cada status', () {
    List<String> labels(String status) => [for (final a in quickStatusActions(status)) a.label];
    expect(labels('PLAYING'), ['Pausar', 'Abandonar']);
    expect(labels('PAUSED'), ['Retomar', 'Abandonar']);
    expect(labels('ABANDONED'), ['Retomar']);
    expect(labels('BACKLOG'), ['Marcar como jogando', 'Abandonar']);
    expect(labels('COMPLETED'), isEmpty);
    expect(labels('DESIRED'), isEmpty);
  });
}
