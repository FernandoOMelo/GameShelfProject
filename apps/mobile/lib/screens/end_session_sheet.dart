import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/active_session_provider.dart';
import '../providers/dashboard_provider.dart';
import '../widgets/session_timer.dart';

class EndSessionSheet extends ConsumerStatefulWidget {
  const EndSessionSheet({super.key});

  @override
  ConsumerState<EndSessionSheet> createState() => _EndSessionSheetState();
}

class _EndSessionSheetState extends ConsumerState<EndSessionSheet> {
  final _locationController = TextEditingController();
  final _notesController = TextEditingController();
  final _decisionsController = TextEditingController();
  final _tipsController = TextEditingController();
  double _progress = 0;
  bool _ending = false;

  @override
  void initState() {
    super.initState();
    final session = ref.read(activeSessionProvider);
    _progress = (session.session?.progress ?? 0).toDouble();
  }

  @override
  void dispose() {
    _locationController.dispose();
    _notesController.dispose();
    _decisionsController.dispose();
    _tipsController.dispose();
    super.dispose();
  }

  Future<void> _end() async {
    setState(() => _ending = true);
    await ref
        .read(activeSessionProvider.notifier)
        .end(
          progress: _progress.round(),
          location: _locationController.text.trim(),
          notes: _notesController.text.trim(),
          keyDecisions: _decisionsController.text.trim(),
          tips: _tipsController.text.trim(),
        );
    ref.invalidate(dashboardProvider);
    if (mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final sessionState = ref.watch(activeSessionProvider);

    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Encerrar Sessão',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                  ),
                ),
                if (sessionState.session != null)
                  SessionTimer(
                    startedAt: sessionState.session!.startedAt,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF6C63FF),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 24),
            Text(
              'Progresso: ${_progress.round()}%',
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
            Slider(
              value: _progress,
              min: 0,
              max: 100,
              divisions: 100,
              activeColor: const Color(0xFF6C63FF),
              onChanged: (v) => setState(() => _progress = v),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _locationController,
              maxLength: 200,
              decoration: const InputDecoration(
                labelText: 'Onde parei (opcional)',
                helperText: 'A missão, capítulo ou ponto exato em que você parou.',
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notesController,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Resumo da história (opcional)',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _decisionsController,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Decisões importantes (opcional)',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _tipsController,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Dicas e lembretes (opcional)',
                alignLabelWithHint: true,
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _ending ? null : _end,
                icon: _ending
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.stop_circle_outlined),
                label: const Text('Encerrar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
