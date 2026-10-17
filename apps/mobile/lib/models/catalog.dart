/// Franquia, plataforma ou gênero: `franchiseSchema`/`platformSchema`/`genreSchema`
/// compartilham a forma `{ id, name }`.
class CatalogItem {
  final String id;
  final String name;

  const CatalogItem({required this.id, required this.name});

  factory CatalogItem.fromJson(Map<String, dynamic> json) =>
      CatalogItem(id: json['id'] as String, name: json['name'] as String);
}
