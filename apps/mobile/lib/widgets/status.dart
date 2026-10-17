import 'package:flutter/material.dart';

/// Rótulos e cores de status, prioridade e dificuldade.
///
/// Centralizados aqui para que biblioteca, detalhe, editor e estatísticas falem a
/// mesma língua visual. Os valores seguem os rótulos usados na web.
const statusLabels = {
  'DESIRED': 'Desejado',
  'BACKLOG': 'Na biblioteca',
  'PLAYING': 'Jogando',
  'PAUSED': 'Pausado',
  'COMPLETED': 'Zerado',
  'ABANDONED': 'Abandonado',
};

const statusColors = {
  'PLAYING': Color(0xFF48BB78),
  'PAUSED': Color(0xFFECC94B),
  'COMPLETED': Color(0xFF6C63FF),
  'ABANDONED': Color(0xFFE53E3E),
  'BACKLOG': Color(0xFF6B6B7E),
  'DESIRED': Color(0xFF8888A0),
};

const priorityLabels = {'LOW': 'Baixa', 'NORMAL': 'Normal', 'HIGH': 'Alta'};

const difficultyLabels = {
  'C': 'C · Fácil',
  'B': 'B · Médio',
  'A': 'A · Complicado',
  'AA': 'AA · Difícil',
  'AAA': 'AAA · Imperdoável',
};

class StatusPill extends StatelessWidget {
  final String status;

  const StatusPill({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final color = statusColors[status] ?? const Color(0xFF6B6B7E);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        statusLabels[status] ?? status,
        style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.w600),
      ),
    );
  }
}
