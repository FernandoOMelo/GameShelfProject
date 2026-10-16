import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/active_session_provider.dart';
import '../widgets/offline_banner.dart';
import 'library_screen.dart';
import 'now_playing_screen.dart';
import 'queue_screen.dart';
import 'progress_screen.dart';
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

    return Scaffold(
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(child: _screens[_currentIndex]),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        items: [
          BottomNavigationBarItem(
            icon: Stack(
              children: [
                const Icon(Icons.sports_esports_rounded),
                if (sessionState.hasActive)
                  Positioned(
                    top: 0,
                    right: 0,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: Color(0xFF48BB78),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
              ],
            ),
            label: 'Jogando',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.video_library_rounded),
            label: 'Biblioteca',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.queue_rounded),
            label: 'Fila',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.bar_chart_rounded),
            label: 'Progresso',
          ),
        ],
      ),
      floatingActionButton: _currentIndex == 0
          ? FloatingActionButton.small(
              onPressed: () => _openSettings(context),
              backgroundColor: const Color(0xFF2A2A3A),
              child: const Icon(Icons.settings_rounded, color: Color(0xFF8888A0)),
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
}
