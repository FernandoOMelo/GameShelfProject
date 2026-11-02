import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'platform_brand_paths.dart';

/// Cor da marca a partir de `#RRGGBB`; `null` quando ausente ou inválida.
Color? hexColor(String? hex) {
  if (hex == null) return null;
  final match = RegExp(r'^#([0-9A-Fa-f]{6})$').firstMatch(hex);
  if (match == null) return null;
  return Color(0xFF000000 | int.parse(match.group(1)!, radix: 16));
}

const _fallbackColor = Color(0xFF5B6573);

/// Ícones sem logo oficial (e o genérico) usam Material, na mesma cor de marca.
IconData _fallbackIcon(String? iconKey) => switch (iconKey) {
      'pc' => Icons.computer_rounded,
      'retro' => Icons.sports_esports_rounded,
      'mobile' => Icons.smartphone_rounded,
      _ => Icons.videogame_asset_rounded,
    };

/// Logo da plataforma em branco, sem fundo. O mesmo ícone da web, vindo do
/// `iconKey` que o catálogo da API grava.
class PlatformGlyph extends StatelessWidget {
  final String? iconKey;
  final double size;
  final Color color;

  const PlatformGlyph({super.key, required this.iconKey, this.size = 20, this.color = Colors.white});

  @override
  Widget build(BuildContext context) {
    final path = iconKey == null ? null : platformBrandPaths[iconKey];
    if (path == null) return Icon(_fallbackIcon(iconKey), size: size, color: color);
    return SvgPicture.string(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="$path"/></svg>',
      width: size,
      height: size,
      colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
    );
  }
}

/// Quadrado com a cor da marca e o logo em branco, como nos cartões de conta
/// do Trophies Hunter e na web.
class PlatformLogo extends StatelessWidget {
  final String? iconKey;
  final String? color;
  final double size;

  const PlatformLogo({super.key, required this.iconKey, this.color, this.size = 44});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: hexColor(color) ?? _fallbackColor,
        borderRadius: BorderRadius.circular(size * 0.25),
        border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
      ),
      child: PlatformGlyph(iconKey: iconKey, size: size * 0.55),
    );
  }
}
