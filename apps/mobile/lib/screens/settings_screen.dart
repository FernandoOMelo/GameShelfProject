import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/settings_provider.dart';
import '../providers/dashboard_provider.dart';
import '../providers/queue_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late TextEditingController _urlController;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(text: ref.read(settingsProvider));
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) {
      setState(() => _error = 'Informe a URL do servidor');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    await ref.read(settingsProvider.notifier).setServerUrl(url);
    ref.invalidate(dashboardProvider);
    ref.invalidate(queueProvider);
    if (mounted) {
      setState(() => _saving = false);
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Configurações')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'URL do Servidor',
              style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
            ),
            const SizedBox(height: 8),
            const Text(
              'Endereço da API GameShelf na sua rede local.\nEx: http://192.168.1.100:3000',
              style: TextStyle(color: Color(0xFF8888A0), fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _urlController,
              keyboardType: TextInputType.url,
              autocorrect: false,
              decoration: InputDecoration(
                labelText: 'http://IP:3000',
                errorText: _error,
                prefixIcon: const Icon(Icons.dns_rounded),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Salvar'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
