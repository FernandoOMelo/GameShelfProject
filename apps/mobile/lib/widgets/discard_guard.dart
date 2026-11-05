import 'package:flutter/material.dart';

/// Pergunta se as alterações podem ser descartadas. `true` descarta.
Future<bool> confirmDiscard(BuildContext context) async {
  final discard = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Descartar alterações?'),
      content: const Text('O que você preencheu ainda não foi salvo.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Continuar editando')),
        TextButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Descartar', style: TextStyle(color: Color(0xFFE53E3E))),
        ),
      ],
    ),
  );
  return discard ?? false;
}

/// Protege um editor contra perda de alterações: voltar, o gesto de voltar e o
/// arrastar de um sheet perguntam antes de descartar quando [isDirty] é verdadeiro.
/// Salvar fecha por `Navigator.pop`, que não passa pela pergunta.
class DiscardGuard extends StatelessWidget {
  final bool Function() isDirty;
  final Widget child;

  const DiscardGuard({super.key, required this.isDirty, required this.child});

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final navigator = Navigator.of(context);
        if (!isDirty() || await confirmDiscard(context)) navigator.pop();
      },
      child: child,
    );
  }
}
