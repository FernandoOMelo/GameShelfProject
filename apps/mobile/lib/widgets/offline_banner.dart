import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/connectivity_provider.dart';

class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final connectivity = ref.watch(connectivityProvider);
    return connectivity.when(
      data: (online) {
        if (online) return const SizedBox.shrink();
        return Container(
          width: double.infinity,
          color: const Color(0xFFE53E3E),
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.wifi_off, size: 14, color: Colors.white),
              SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Offline — dados podem estar defasados; sessões sincronizam ao reconectar',
                  style: TextStyle(color: Colors.white, fontSize: 12),
                ),
              ),
            ],
          ),
        );
      },
      loading: () => const SizedBox.shrink(),
      error: (_, s) => const SizedBox.shrink(),
    );
  }
}
