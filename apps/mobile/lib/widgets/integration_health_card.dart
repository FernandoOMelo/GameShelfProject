import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/missions_api.dart';
import '../models/integration_health.dart';
import '../providers/missions_provider.dart';

String _stamp(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')} '
    '${value.hour.toString().padLeft(2, '0')}:${value.minute.toString().padLeft(2, '0')}';

/// Saúde do IGDB, da RAWG e do Achievist: configurada ou não, resultado da
/// última chamada e um teste sob demanda — sem abrir o .env (ADR-040).
class IntegrationHealthCard extends ConsumerStatefulWidget {
  const IntegrationHealthCard({super.key});

  @override
  ConsumerState<IntegrationHealthCard> createState() => _IntegrationHealthCardState();
}

class _IntegrationHealthCardState extends ConsumerState<IntegrationHealthCard> {
  final Map<String, IntegrationHealth> _tested = {};
  String? _testing;

  Future<void> _test(IntegrationHealth item) async {
    setState(() => _testing = item.key);
    try {
      final updated = await IntegrationHealthApi.test(item.key);
      if (mounted) setState(() => _tested[item.key] = updated);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Não foi possível testar a integração.')));
      }
    } finally {
      if (mounted) setState(() => _testing = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(integrationHealthProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(child: Text('Saúde das integrações', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
            IconButton(
              tooltip: 'Atualizar',
              onPressed: () => ref.invalidate(integrationHealthProvider),
              icon: const Icon(Icons.refresh_rounded, size: 20),
            ),
          ],
        ),
        async.when(
          loading: () => const Padding(padding: EdgeInsets.all(12), child: Center(child: CircularProgressIndicator())),
          error: (_, _) => const Text('Não foi possível consultar a API.', style: TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
          data: (items) => Column(
            children: [
              for (final loaded in items)
                Builder(builder: (context) {
                  final item = _tested[loaded.key] ?? loaded;
                  final color = !item.configured
                      ? const Color(0xFF8888A0)
                      : item.lastOk == false
                          ? const Color(0xFFE53E3E)
                          : const Color(0xFF48BB78);
                  return Container(
                    margin: const EdgeInsets.only(top: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: const Color(0xFF1E1E2A), borderRadius: BorderRadius.circular(12)),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.circle, size: 10, color: color),
                            const SizedBox(width: 8),
                            Expanded(child: Text(item.name, style: const TextStyle(fontWeight: FontWeight.w600))),
                            Text(item.statusLabel, style: TextStyle(color: color, fontSize: 12)),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          [
                            item.configured ? 'Credenciais presentes no servidor.' : 'Defina ${item.envVars.join(', ')} no .env do servidor.',
                            if (item.lastCheckedAt != null)
                              'Última chamada em ${_stamp(item.lastCheckedAt!)}: ${item.lastMessage ?? ''}'
                            else
                              'Nenhuma chamada desde que a API subiu.',
                            if (item.lastOk == false && item.lastSuccessAt != null) 'Último sucesso em ${_stamp(item.lastSuccessAt!)}.',
                          ].join(' '),
                          style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12),
                        ),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: _testing == null ? () => _test(item) : null,
                            child: Text(_testing == item.key ? 'Testando…' : 'Testar agora'),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
            ],
          ),
        ),
      ],
    );
  }
}
