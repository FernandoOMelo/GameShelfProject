import 'package:flutter/material.dart';

/// Título de seção em caixa alta — mesmo padrão das telas existentes.
class SectionTitle extends StatelessWidget {
  final String title;
  final Widget? trailing;

  const SectionTitle(this.title, {super.key, this.trailing});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title.toUpperCase(),
              style: const TextStyle(
                color: Color(0xFF6B6B7E),
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.6,
              ),
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

/// Linha rótulo/valor usada em blocos de detalhe.
class InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const InfoRow({super.key, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(label, style: const TextStyle(color: Color(0xFF8888A0), fontSize: 13)),
          ),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

/// Estado vazio/erro reutilizável.
class MessageState extends StatelessWidget {
  final IconData icon;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  const MessageState({
    super.key,
    required this.icon,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 44, color: const Color(0xFF4A4A5A)),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFF8888A0), fontSize: 14),
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 16),
              ElevatedButton(onPressed: onAction, child: Text(actionLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

/// Formata horas no padrão da web: minutos abaixo de 1 h ("42min"), "Xh Ymin"
/// até 100 h e só as horas (com separador de milhar) acima disso ("1.569h").
String formatHours(double? value) {
  if (value == null) return '—';
  return _compactDuration((value * 60).round());
}

/// Formata minutos no mesmo padrão de [formatHours]: "45min", "1h 30min".
String formatMinutes(int? minutes) {
  if (minutes == null) return 'Em andamento';
  return _compactDuration(minutes);
}

String _compactDuration(int totalMinutes) {
  final hours = totalMinutes ~/ 60;
  final minutes = totalMinutes % 60;
  if (hours == 0) return '${minutes}min';
  if (hours >= 100 || minutes == 0) return '${_thousands(hours)}h';
  return '${hours}h ${minutes}min';
}

String _thousands(int value) => value.toString().replaceAllMapped(
      RegExp(r'\B(?=(\d{3})+(?!\d))'),
      (_) => '.',
    );

/// "há 19 minutos", "há 2 horas", "há 3 dias" — para estados de sincronização.
String formatRelative(DateTime moment, {DateTime? now}) {
  final diff = (now ?? DateTime.now()).difference(moment);
  if (diff.inMinutes < 1) return 'agora há pouco';
  if (diff.inMinutes < 60) return 'há ${diff.inMinutes} ${diff.inMinutes == 1 ? 'minuto' : 'minutos'}';
  if (diff.inHours < 24) return 'há ${diff.inHours} ${diff.inHours == 1 ? 'hora' : 'horas'}';
  return 'há ${diff.inDays} ${diff.inDays == 1 ? 'dia' : 'dias'}';
}
