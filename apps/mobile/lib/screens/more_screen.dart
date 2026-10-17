import 'package:flutter/material.dart';
import 'settings_screen.dart';
import 'goals_screen.dart';
import 'lists_screen.dart';
import 'stats_screen.dart';
import 'timeline_screen.dart';

/// Aba "Mais": agrupa as seções que não cabem na barra inferior.
///
/// Espelha os destinos secundários da web (Listas, Estatísticas, Atividade e
/// Metas) e mantém as Configurações acessíveis sem poluir a navegação principal.
class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mais')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          _MoreTile(
            icon: Icons.bookmarks_rounded,
            title: 'Listas',
            subtitle: 'Organize a coleção e acompanhe missões',
            onTap: () => _push(context, const ListsScreen()),
          ),
          _MoreTile(
            icon: Icons.insights_rounded,
            title: 'Estatísticas',
            subtitle: 'Totais, replay do ano, notas e rankings',
            onTap: () => _push(context, const StatsScreen()),
          ),
          _MoreTile(
            icon: Icons.history_rounded,
            title: 'Atividade',
            subtitle: 'Linha do tempo do que aconteceu na biblioteca',
            onTap: () => _push(context, const TimelineScreen()),
          ),
          _MoreTile(
            icon: Icons.flag_rounded,
            title: 'Metas',
            subtitle: 'Jogos zerados ou horas jogadas por período',
            onTap: () => _push(context, const GoalsScreen()),
          ),
          _MoreTile(
            icon: Icons.settings_rounded,
            title: 'Configurações',
            subtitle: 'Endereço do servidor',
            onTap: () => _push(context, const SettingsScreen()),
          ),
        ],
      ),
    );
  }

  static void _push(BuildContext context, Widget screen) {
    Navigator.push(context, MaterialPageRoute(builder: (_) => screen));
  }
}

class _MoreTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _MoreTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: const Color(0xFF1E1E2A),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFF6C63FF).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: const Color(0xFF6C63FF), size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                      const SizedBox(height: 2),
                      Text(subtitle,
                          style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: Color(0xFF6B6B7E)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
