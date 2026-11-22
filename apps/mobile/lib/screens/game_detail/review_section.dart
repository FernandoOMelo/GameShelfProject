import 'package:flutter/material.dart';
import '../../models/game.dart';
import '../../widgets/section.dart';

/// "Minha análise" na ficha do jogo (ADR-044): só mostra o que foi preenchido.
class ReviewSection extends StatelessWidget {
  /// Sem análise ainda, a seção mostra um convite (quando há [onEdit]).
  final GameReview? review;
  final VoidCallback? onEdit;

  const ReviewSection({super.key, required this.review, this.onEdit});

  @override
  Widget build(BuildContext context) {
    final current = review;
    final rows = [
      if (current != null)
        for (final entry in GameReview.criteria.entries)
          if (!current.criterion(entry.key).isEmpty) _row(entry.value, current.criterion(entry.key)),
    ];
    final summary = current?.summary?.trim() ?? '';
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const SectionTitle('Minha análise'),
        if (current == null) const Text('Ainda sem análise.', style: TextStyle(color: Color(0xFF8888A0))),
        ...rows,
        if (summary.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(summary, style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 13, height: 1.4)),
          ),
        if (onEdit != null)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(onPressed: onEdit, child: Text(current == null ? 'Adicionar análise' : 'Editar análise')),
          ),
      ]),
    );
  }

  Widget _row(String label, ReviewCriterion criterion) {
    final comment = criterion.comment?.trim() ?? '';
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(label, style: const TextStyle(color: Color(0xFF8888A0)))),
          Text(criterion.score == null ? '—' : '${criterion.score}/10', style: const TextStyle(fontWeight: FontWeight.w600)),
        ]),
        if (comment.isNotEmpty) Text(comment, style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 12)),
      ]),
    );
  }
}
