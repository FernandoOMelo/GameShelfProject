import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../core/achievement_series.dart';
import '../providers/stats_provider.dart';

const _card = Color(0xFF1E1E2A);
const _line = Color(0xFF5B8DEF);

/// Conquistas desbloqueadas ao longo do tempo, acumuladas, a partir das datas
/// que o Achievist informa. Só conta os jogos vinculados à biblioteca e mostra
/// atividade, não horas jogadas. Toque ou arraste para ver o valor de um dia.
/// Fica oculto quando não há conquistas com data.
class AchievementsChart extends ConsumerStatefulWidget {
  const AchievementsChart({super.key});

  @override
  ConsumerState<AchievementsChart> createState() => _AchievementsChartState();
}

class _AchievementsChartState extends ConsumerState<AchievementsChart> {
  SeriesRange _range = SeriesRange.all;
  double? _hoverRatio;

  @override
  Widget build(BuildContext context) {
    final series = ref.watch(achievementSeriesProvider).valueOrNull;
    if (series == null || series.total == 0) return const SizedBox.shrink();

    final data = buildCumulativeSeries(series.days, _range);
    final integer = NumberFormat.decimalPattern('pt_BR');

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('Conquistas ao longo do tempo', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
              ),
              PopupMenuButton<SeriesRange>(
                tooltip: 'Período do gráfico de conquistas',
                initialValue: _range,
                onSelected: (value) => setState(() {
                  _range = value;
                  _hoverRatio = null;
                }),
                itemBuilder: (_) => [
                  for (final range in SeriesRange.values) PopupMenuItem(value: range, child: Text(range.label)),
                ],
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_range.label, style: const TextStyle(fontSize: 12, color: Color(0xFF9FC0FF))),
                    const Icon(Icons.arrow_drop_down_rounded, color: Color(0xFF9FC0FF)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          LayoutBuilder(
            builder: (context, constraints) {
              void hover(Offset position) =>
                  setState(() => _hoverRatio = (position.dx / constraints.maxWidth).clamp(0.0, 1.0));
              return GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTapDown: (details) => hover(details.localPosition),
                onHorizontalDragStart: (details) => hover(details.localPosition),
                onHorizontalDragUpdate: (details) => hover(details.localPosition),
                child: Semantics(
                  label: '${integer.format(data.points.last.value)} conquistas acumuladas no período',
                  child: CustomPaint(
                    size: Size(constraints.maxWidth, 190),
                    painter: AchievementsChartPainter(data: data, hoverRatio: _hoverRatio),
                  ),
                ),
              );
            },
          ),
          const SizedBox(height: 4),
          Text(
            '${integer.format(series.total)} conquistas com data, dos jogos vinculados da biblioteca. '
            'Mostra atividade, não horas jogadas.',
            style: const TextStyle(color: Color(0xFF737771), fontSize: 11),
          ),
        ],
      ),
    );
  }
}

/// Pinta a curva acumulada, a grade, os rótulos e o cursor com o valor do dia.
class AchievementsChartPainter extends CustomPainter {
  final CumulativeSeries data;
  final double? hoverRatio;

  AchievementsChartPainter({required this.data, required this.hoverRatio});

  static const _left = 40.0;
  static const _right = 10.0;
  static const _top = 10.0;
  static const _bottom = 24.0;

  @override
  void paint(Canvas canvas, Size size) {
    final plotWidth = size.width - _left - _right;
    final plotHeight = size.height - _top - _bottom;
    final top = niceMax(data.max);
    final spanMs = data.end.difference(data.start).inMilliseconds.clamp(1, 1 << 62);

    double x(DateTime time) => _left + time.difference(data.start).inMilliseconds / spanMs * plotWidth;
    double y(num value) => _top + (1 - value / top) * plotHeight;

    final grid = Paint()
      ..color = Colors.white.withValues(alpha: 0.08)
      ..strokeWidth = 1;
    final integer = NumberFormat.decimalPattern('pt_BR');
    for (var step = 0; step <= 4; step++) {
      final value = top / 4 * step;
      canvas.drawLine(Offset(_left, y(value)), Offset(size.width - _right, y(value)), grid);
      _label(canvas, integer.format(value.round()), Offset(_left - 6, y(value)), alignRight: true);
    }
    final dateFormat = DateFormat('MMM/yy', 'pt_BR');
    for (var tick = 0; tick < 6; tick++) {
      final time = data.start.add(Duration(milliseconds: (spanMs / 5 * tick).round()));
      _label(canvas, dateFormat.format(time).replaceAll('.', ''), Offset(x(time), size.height - 6), center: true);
    }

    final path = Path();
    for (var i = 0; i < data.points.length; i++) {
      final point = data.points[i];
      final offset = Offset(x(point.time), y(point.value));
      i == 0 ? path.moveTo(offset.dx, offset.dy) : path.lineTo(offset.dx, offset.dy);
    }
    final area = Path.from(path)
      ..lineTo(x(data.points.last.time), y(0))
      ..lineTo(x(data.points.first.time), y(0))
      ..close();
    canvas.drawPath(
      area,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [const Color(0xFF3B82F6).withValues(alpha: 0.35), const Color(0xFF3B82F6).withValues(alpha: 0.02)],
        ).createShader(Rect.fromLTWH(0, _top, size.width, plotHeight)),
    );
    canvas.drawPath(
      path,
      Paint()
        ..color = _line
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeJoin = StrokeJoin.round,
    );

    if (hoverRatio != null) _paintHover(canvas, size, x, y, plotWidth, spanMs);
  }

  void _paintHover(Canvas canvas, Size size, double Function(DateTime) x, double Function(num) y, double plotWidth, int spanMs) {
    final hoverX = (hoverRatio! * size.width).clamp(_left, size.width - _right);
    final time = data.start.add(Duration(milliseconds: ((hoverX - _left) / plotWidth * spanMs).round()));
    final value = valueAt(time);

    canvas.drawLine(
      Offset(hoverX, _top),
      Offset(hoverX, size.height - _bottom),
      Paint()
        ..color = const Color(0xFFC9D1E0)
        ..strokeWidth = 1,
    );
    final center = Offset(hoverX, y(value));
    canvas.drawCircle(center, 4.5, Paint()..color = Colors.white);
    canvas.drawCircle(
      center,
      4.5,
      Paint()
        ..color = _line
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );

    final date = DateFormat('dd/MM/yyyy').format(time);
    final title = _painter(date, const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700));
    final body = _painter('conquistas : ${NumberFormat.decimalPattern('pt_BR').format(value)}',
        const TextStyle(color: Color(0xFF7FB0FF), fontSize: 12));
    final boxWidth = (title.width > body.width ? title.width : body.width) + 20;
    const boxHeight = 46.0;
    var left = hoverX + 12;
    if (left + boxWidth > size.width) left = hoverX - 12 - boxWidth;
    final boxTop = (center.dy - boxHeight / 2).clamp(0.0, size.height - _bottom - boxHeight);
    final box = RRect.fromRectAndRadius(Rect.fromLTWH(left, boxTop, boxWidth, boxHeight), const Radius.circular(8));
    canvas.drawRRect(box, Paint()..color = const Color(0xFF141824));
    canvas.drawRRect(
      box,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.18)
        ..style = PaintingStyle.stroke,
    );
    title.paint(canvas, Offset(left + 10, boxTop + 8));
    body.paint(canvas, Offset(left + 10, boxTop + 25));
  }

  /// Acumulado no dia: o valor do último ponto que não passa do instante.
  int valueAt(DateTime time) {
    var value = data.points.first.value;
    for (final point in data.points) {
      if (point.time.isAfter(time)) break;
      value = point.value;
    }
    return value;
  }

  TextPainter _painter(String text, TextStyle style) =>
      TextPainter(text: TextSpan(text: text, style: style), textDirection: ui.TextDirection.ltr)..layout();

  void _label(Canvas canvas, String text, Offset anchor, {bool alignRight = false, bool center = false}) {
    final painter = _painter(text, const TextStyle(color: Color(0xFF737B86), fontSize: 10));
    final dx = alignRight ? anchor.dx - painter.width : (center ? anchor.dx - painter.width / 2 : anchor.dx);
    painter.paint(canvas, Offset(dx, anchor.dy - painter.height / 2));
  }

  @override
  bool shouldRepaint(covariant AchievementsChartPainter oldDelegate) =>
      oldDelegate.data != data || oldDelegate.hoverRatio != hoverRatio;
}
