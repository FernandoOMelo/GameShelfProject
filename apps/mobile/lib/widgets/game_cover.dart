import 'package:flutter/material.dart';
import '../core/api_client.dart';

class GameCover extends StatelessWidget {
  final String? coverUrl;
  final double width;
  final double height;
  final BorderRadius borderRadius;

  const GameCover({
    super.key,
    this.coverUrl,
    this.width = 56,
    this.height = 72,
    this.borderRadius = const BorderRadius.all(Radius.circular(10)),
  });

  @override
  Widget build(BuildContext context) {
    if (coverUrl == null) {
      return _placeholder();
    }

    final fullUrl = coverUrl!.startsWith('http')
        ? coverUrl!
        : '${ApiClient.instance.baseUrl}$coverUrl';

    return ClipRRect(
      borderRadius: borderRadius,
      child: Image.network(
        fullUrl,
        width: width,
        height: height,
        fit: BoxFit.cover,
        errorBuilder: (_, __, e) => _placeholder(),
        loadingBuilder: (_, child, progress) {
          if (progress == null) return child;
          return _placeholder();
        },
      ),
    );
  }

  Widget _placeholder() => Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: const Color(0xFF2A2A3A),
          borderRadius: borderRadius,
        ),
        child: const Icon(Icons.videogame_asset_rounded, color: Color(0xFF4A4A5A), size: 28),
      );
}
