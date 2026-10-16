import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'core/api_client.dart';
import 'core/local_db.dart';
import 'core/sync_service.dart';
import 'core/theme.dart';
import 'screens/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  initializeDateFormatting('pt_BR');
  await ApiClient.instance.init();
  await LocalDb.instance.db;
  SyncService.instance.startListening();
  runApp(const ProviderScope(child: GameShelfApp()));
}

class GameShelfApp extends ConsumerWidget {
  const GameShelfApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp(
      title: 'GameShelf',
      theme: appTheme,
      debugShowCheckedModeBanner: false,
      home: const HomeScreen(),
    );
  }
}
