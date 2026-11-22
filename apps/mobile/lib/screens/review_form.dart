import 'package:flutter/material.dart';
import '../models/game.dart';

const _muted = Color(0xFF8888A0);

/// Estado editável de uma análise (ADR-044), compartilhado entre o assistente de
/// zerar e a edição posterior.
class ReviewDraft {
  final TextEditingController summary;
  final Map<String, int?> scores;
  final Map<String, TextEditingController> comments;

  ReviewDraft([GameReview? initial])
      : summary = TextEditingController(text: initial?.summary ?? ''),
        scores = {for (final key in GameReview.criteria.keys) key: initial?.criterion(key).score},
        comments = {for (final key in GameReview.criteria.keys) key: TextEditingController(text: initial?.criterion(key).comment ?? '')};

  GameReview toReview() => GameReview(
        summary: summary.text,
        byCriterion: {for (final key in GameReview.criteria.keys) key: ReviewCriterion(score: scores[key], comment: comments[key]!.text)},
      );

  void dispose() {
    summary.dispose();
    for (final controller in comments.values) {
      controller.dispose();
    }
  }
}

/// Chips de 1 a 10 e comentário curto por critério.
class ReviewCriteriaFields extends StatelessWidget {
  final ReviewDraft draft;
  final VoidCallback onChanged;

  const ReviewCriteriaFields({super.key, required this.draft, required this.onChanged});

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Avalie só o que quiser, de 1 a 10.', style: TextStyle(color: _muted, fontSize: 12)),
        for (final entry in GameReview.criteria.entries) ...[
          const SizedBox(height: 14),
          Text(entry.value, style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (var value = 1; value <= 10; value++)
              ChoiceChip(
                key: ValueKey('${entry.key}-$value'),
                label: Text('$value'),
                selected: draft.scores[entry.key] == value,
                onSelected: (selected) {
                  draft.scores[entry.key] = selected ? value : null;
                  onChanged();
                },
              ),
          ]),
          TextField(
            key: ValueKey('${entry.key}-comment'),
            controller: draft.comments[entry.key],
            maxLength: 1000,
            decoration: const InputDecoration(hintText: 'Comentário (opcional)', counterText: ''),
          ),
        ],
      ]);
}

class ReviewSummaryField extends StatelessWidget {
  final ReviewDraft draft;

  const ReviewSummaryField({super.key, required this.draft});

  @override
  Widget build(BuildContext context) => TextField(
        key: const ValueKey('review-summary'),
        controller: draft.summary,
        minLines: 5,
        maxLines: 10,
        maxLength: 5000,
        decoration: const InputDecoration(
          labelText: 'Sua análise do jogo (opcional)',
          helperText: 'O que achou, o que ficou na memória, para quem recomenda…',
          alignLabelWithHint: true,
        ),
      );
}

/// Resultado do editor: cancelar não altera nada; salvar vazio remove a análise.
sealed class ReviewEdit {
  const ReviewEdit();
}

class ReviewSaved extends ReviewEdit {
  /// `null` quando tudo ficou vazio (o chamador remove a análise).
  final GameReview? review;
  const ReviewSaved(this.review);
}

Future<ReviewEdit?> showReviewEditor(BuildContext context, Game game) => showModalBottomSheet<ReviewEdit>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1E2A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => ReviewEditorSheet(game: game),
    );

class ReviewEditorSheet extends StatefulWidget {
  final Game game;

  const ReviewEditorSheet({super.key, required this.game});

  @override
  State<ReviewEditorSheet> createState() => _ReviewEditorSheetState();
}

class _ReviewEditorSheetState extends State<ReviewEditorSheet> {
  late final ReviewDraft _draft = ReviewDraft(widget.game.review);

  @override
  void dispose() {
    _draft.dispose();
    super.dispose();
  }

  void _save() {
    final review = _draft.toReview();
    Navigator.pop(context, ReviewSaved(review.isEmpty ? null : review));
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(context).viewInsets.bottom + 24),
        child: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Análise de ${widget.game.title}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            ReviewCriteriaFields(draft: _draft, onChanged: () => setState(() {})),
            const SizedBox(height: 16),
            ReviewSummaryField(draft: _draft),
            const SizedBox(height: 16),
            Row(children: [
              TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancelar')),
              const Spacer(),
              ElevatedButton(onPressed: _save, child: const Text('Salvar')),
            ]),
          ]),
        ),
      );
}
