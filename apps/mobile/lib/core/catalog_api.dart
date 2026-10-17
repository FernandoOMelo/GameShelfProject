import '../models/catalog.dart';
import 'api_client.dart';

/// Franquias, plataformas e gêneros: os três catálogos que o formulário de jogo usa.
class CatalogApi {
  static Future<List<CatalogItem>> _list(String path) async {
    final data = await ApiClient.instance.getCached<List<dynamic>>(path);
    return data.map((e) => CatalogItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  static Future<List<CatalogItem>> franchises() => _list('/franchises');
  static Future<List<CatalogItem>> platforms() => _list('/platforms');
  static Future<List<CatalogItem>> genres() => _list('/genres');

  /// Cria uma franquia (usada quando a metadata traz uma franquia inexistente).
  static Future<CatalogItem> createFranchise(String name) async {
    final response = await ApiClient.instance.post<Map<String, dynamic>>(
      '/franchises',
      data: {'name': name},
    );
    return CatalogItem.fromJson(response.data!);
  }
}
