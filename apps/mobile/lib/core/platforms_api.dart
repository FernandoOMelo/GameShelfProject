import 'package:dio/dio.dart';
import '../models/platform_summary.dart';
import 'api_client.dart';

/// Cadastro e resumos de plataformas, e o estado da sincronização do Achievist.
class PlatformsApi {
  static Future<List<PlatformSummary>> summaries() async {
    final data = await ApiClient.instance.getCached<List<dynamic>>('/platforms/summaries');
    return data.map((e) => PlatformSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<List<PlatformCatalogEntry>> catalog() async {
    final data = await ApiClient.instance.getCached<List<dynamic>>('/platforms/catalog');
    return data.map((e) => PlatformCatalogEntry.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Só envia `iconKey` e `color` quando o usuário escolheu: sem escolha, a API
  /// reconhece o nome no catálogo e preenche sozinha.
  static Future<void> create({
    required String name,
    String? parentId,
    String? iconKey,
    String? color,
  }) async {
    await ApiClient.instance.post<dynamic>('/platforms', data: {
      'name': name,
      'parentId': parentId,
      'iconKey': ?iconKey,
      'color': ?color,
    });
  }

  static Future<void> update(String id, Map<String, dynamic> changes) async {
    await ApiClient.instance.patch<dynamic>('/platforms/$id', data: changes);
  }

  static Future<void> remove(String id) async {
    await ApiClient.instance.delete<dynamic>('/platforms/$id');
  }

  /// Estado da última rodada. Sem cache: o chip precisa refletir o servidor agora.
  static Future<SyncState> syncState() async {
    final response = await ApiClient.instance.get<Map<String, dynamic>>('/integrations/achievist/sync');
    return SyncState.fromJson(response.data!);
  }

  /// Dispara a rodada. `false` quando já existe uma em andamento (409).
  static Future<bool> startSync() async {
    try {
      await ApiClient.instance.post<dynamic>('/integrations/achievist/sync');
      return true;
    } on DioException catch (error) {
      if (error.response?.statusCode == 409) return false;
      rethrow;
    }
  }

  /// Mensagem de erro da API (`{ error }`) ou [fallback].
  static String errorMessage(Object error, String fallback) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['error'] is String) return data['error'] as String;
    }
    return fallback;
  }
}
