/// Curva acumulada de conquistas para o gráfico. Port de
/// `apps/web/src/pages/achievement-series.ts`: o acumulado antes da janela vira o
/// ponto de partida, para a curva não "zerar" ao recortar o período.
library;

class AchievementDay {
  final DateTime date;
  final int count;

  const AchievementDay(this.date, this.count);

  factory AchievementDay.fromJson(Map<String, dynamic> json) {
    final parts = (json['date'] as String).split('-').map(int.parse).toList();
    return AchievementDay(DateTime.utc(parts[0], parts[1], parts[2]), json['count'] as int);
  }
}

/// Resposta de `GET /stats/achievements`.
class AchievementSeries {
  final int total;
  final List<AchievementDay> days;

  const AchievementSeries({required this.total, required this.days});

  factory AchievementSeries.fromJson(Map<String, dynamic> json) => AchievementSeries(
        total: json['total'] as int? ?? 0,
        days: ((json['days'] as List<dynamic>?) ?? const [])
            .map((e) => AchievementDay.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

enum SeriesRange {
  all('Todo o período'),
  last12Months('Últimos 12 meses'),
  thisYear('Este ano');

  final String label;

  const SeriesRange(this.label);
}

class SeriesPoint {
  final DateTime time;
  final int value;

  const SeriesPoint(this.time, this.value);
}

class CumulativeSeries {
  final List<SeriesPoint> points;
  final DateTime start;
  final DateTime end;
  final int max;

  const CumulativeSeries({required this.points, required this.start, required this.end, required this.max});
}

CumulativeSeries buildCumulativeSeries(List<AchievementDay> days, SeriesRange range, {DateTime? now}) {
  final today = now ?? DateTime.now();
  final end = DateTime.utc(today.year, today.month, today.day);
  final first = days.isEmpty ? end : days.first.date;
  final start = switch (range) {
    SeriesRange.all => first,
    SeriesRange.last12Months => end.subtract(const Duration(days: 365)),
    SeriesRange.thisYear => DateTime.utc(today.year, 1, 1),
  };
  var running = 0;
  final points = <SeriesPoint>[];
  for (final day in days) {
    if (day.date.isBefore(start)) {
      running += day.count;
      continue;
    }
    if (points.isEmpty) points.add(SeriesPoint(start, running));
    // Degrau: o valor anterior vale até a véspera do dia do desbloqueio.
    points.add(SeriesPoint(day.date.subtract(const Duration(milliseconds: 1)), running));
    running += day.count;
    points.add(SeriesPoint(day.date, running));
  }
  if (points.isEmpty) points.add(SeriesPoint(start, running));
  final last = end.isAfter(start) ? end : start;
  points.add(SeriesPoint(last, running));
  final safeEnd = last.isAfter(start.add(const Duration(days: 1))) ? last : start.add(const Duration(days: 1));
  return CumulativeSeries(points: points, start: start, end: safeEnd, max: running < 1 ? 1 : running);
}

/// Teto "redondo" do eixo vertical, com 4 intervalos de escala legível.
int niceMax(int value) {
  final quarter = (value < 1 ? 1 : value) / 4;
  var magnitude = 1.0;
  while (magnitude * 10 <= quarter) {
    magnitude *= 10;
  }
  while (magnitude > quarter) {
    magnitude /= 10;
  }
  final step = [1.0, 2.0, 2.5, 5.0, 10.0].map((factor) => factor * magnitude).firstWhere(
        (candidate) => candidate >= quarter,
        orElse: () => 10 * magnitude,
      );
  return step.ceil() * 4;
}
