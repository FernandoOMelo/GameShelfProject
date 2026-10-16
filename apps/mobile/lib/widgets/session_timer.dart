import 'dart:async';
import 'package:flutter/material.dart';

class SessionTimer extends StatefulWidget {
  final DateTime startedAt;
  final TextStyle? style;

  const SessionTimer({super.key, required this.startedAt, this.style});

  @override
  State<SessionTimer> createState() => _SessionTimerState();
}

class _SessionTimerState extends State<SessionTimer> {
  late Timer _timer;
  late Duration _elapsed;

  @override
  void initState() {
    super.initState();
    _elapsed = DateTime.now().difference(widget.startedAt);
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {
          _elapsed = DateTime.now().difference(widget.startedAt);
        });
      }
    });
  }

  @override
  void dispose() {
    _timer.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final h = _elapsed.inHours;
    final m = _elapsed.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = _elapsed.inSeconds.remainder(60).toString().padLeft(2, '0');
    final label = h > 0 ? '$h:$m:$s' : '$m:$s';
    return Text(label, style: widget.style ?? Theme.of(context).textTheme.headlineMedium);
  }
}
