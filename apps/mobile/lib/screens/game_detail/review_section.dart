import 'package:flutter/material.dart';
import '../../models/game.dart';
import '../../widgets/section.dart';

/// "Minha análise" na ficha do jogo (ADR-044): só mostra o que foi preenchido.
class ReviewSection extends StatelessWidget {
  final GameReview review;

  const ReviewSection({super.key, required this.review});

  @override
  Widget build(BuildContext context) {
    final rows = [
      for (final entry in GameReview.criteria.entries)
        if (!review.criterion(entry.key).isEmpty) _row(entry.value, review.criterion(entry.key)),
    ];
    final summary = review.summary?.trim() ?? '';
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const SectionTitle('Minha análise'),
        ...rows,
        if (summary.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(summary, style: const TextStyle(color: Color(0xFFB8B8C8), fontSize: 13, height: 1.4)),
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
