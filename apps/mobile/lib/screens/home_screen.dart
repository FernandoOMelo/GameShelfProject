import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/active_session_provider.dart';
import '../widgets/offline_banner.dart';
import '../widgets/session_timer.dart';
import 'end_session_sheet.dart';
import 'library_screen.dart';
import 'now_playing_screen.dart';
import 'progress_screen.dart';
import 'queue_screen.dart';
import 'settings_screen.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _currentIndex = 0;

  static const _screens = [
    NowPlayingScreen(),
    LibraryScreen(),
    QueueScreen(),
    ProgressScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final sessionState = ref.watch(activeSessionProvider);
    final hasActive = sessionState.hasActive;

    return Scaffold(
      body: Column(
        children: [
          const OfflineBanner(),
          // Barra de sessão rápida: fica visível em qualquer aba e permite
          // encerrar a sessão sem navegar até "Jogando".
          if (hasActive && _currentIndex != 0)
            _ActiveSessionBar(
              onOpen: () => setState(() => _currentIndex = 0),
              onEnd: () => _endSession(context),
            ),
          Expanded(child: _screens[_currentIndex]),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: [
          NavigationDestination(
            icon: _ActiveSessionAwareIcon(
              active: hasActive,
              icon: Icons.sports_esports_outlined,
            ),
            selectedIcon: _ActiveSessionAwareIcon(
              active: hasActive,
              icon: Icons.sports_esports_rounded,
            ),
            label: 'Jogando',
          ),
          const NavigationDestination(
            icon: Icon(Icons.video_library_outlined),
            selectedIcon: Icon(Icons.video_library_rounded),
            label: 'Biblioteca',
          ),
          const NavigationDestination(
            icon: Icon(Icons.queue_outlined),
            selectedIcon: Icon(Icons.queue_rounded),
            label: 'Fila',
          ),
          const NavigationDestination(
            icon: Icon(Icons.bar_chart_outlined),
            selectedIcon: Icon(Icons.bar_chart_rounded),
            label: 'Progresso',
          ),
        ],
      ),
      floatingActionButton: _currentIndex == 0 && !hasActive
          ? FloatingActionButton.small(
              onPressed: () => _openSettings(context),
              tooltip: 'Configurações',
              child: const Icon(Icons.settings_rounded),
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.endTop,
    );
  }

  void _openSettings(BuildContext context) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const SettingsScreen()),
    );
  }

  Future<void> _endSession(BuildContext context) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E1E2A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const EndSessionSheet(),
    );
  }
}

/// Ícone da aba "Jogando" com um ponto verde quando há sessão em andamento.
class _ActiveSessionAwareIcon extends StatelessWidget {
  final bool active;
  final IconData icon;

  const _ActiveSessionAwareIcon({required this.active, required this.icon});

  @override
  Widget build(BuildContext context) {
    if (!active) return Icon(icon);
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Icon(icon),
        Positioned(
          top: -2,
          right: -2,
          child: Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(
              color: const Color(0xFF48BB78),
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFF14141C), width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}

class _ActiveSessionBar extends ConsumerWidget {
  final VoidCallback onOpen;
  final VoidCallback onEnd;

  const _ActiveSessionBar({required this.onOpen, required this.onEnd});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(activeSessionProvider);
    if (!state.hasActive) return const SizedBox.shrink();

    return Material(
      color: const Color(0xFF1E1E2A),
      child: InkWell(
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 8, 10),
          child: Row(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: const BoxDecoration(
                  color: Color(0xFF48BB78),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      state.game!.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    SessionTimer(
                      startedAt: state.session!.startedAt,
                      style: const TextStyle(
                        color: Color(0xFF8888A0),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: onEnd,
                tooltip: 'Encerrar sessão',
                icon: const Icon(
                  Icons.stop_circle_outlined,
                  color: Color(0xFFE53E3E),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
