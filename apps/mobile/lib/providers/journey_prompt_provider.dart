import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Preferência local: perguntar sobre a jornada ao iniciar uma sessão ou nunca (ADR-042).
/// Não existe modo automático: a jornada só muda por uma ação explícita.
class JourneyPromptNotifier extends Notifier<bool> {
  static const _key = 'journey_prompt_ask';

  @override
  bool build() {
    SharedPreferences.getInstance().then((prefs) {
      final stored = prefs.getBool(_key);
      if (stored != null && stored != state) state = stored;
    });
    return true;
  }

  Future<void> setAsk(bool ask) async {
    state = ask;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_key, ask);
  }

  /// Lê o valor gravado agora (o `build` carrega de forma assíncrona).
  static Future<bool> readAsk() async => (await SharedPreferences.getInstance()).getBool(_key) ?? true;
}

final journeyPromptProvider = NotifierProvider<JourneyPromptNotifier, bool>(JourneyPromptNotifier.new);
