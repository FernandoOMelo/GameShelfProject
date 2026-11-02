/// Franquia, plataforma ou gênero: `franchiseSchema`/`platformSchema`/`genreSchema`
/// compartilham a forma `{ id, name }`. A plataforma acrescenta a identidade
/// visual (`iconKey`, `color` em #RRGGBB) e o grupo (`parentId`).
class CatalogItem {
  final String id;
  final String name;
  final String? iconKey;
  final String? color;
  final String? parentId;

  const CatalogItem({required this.id, required this.name, this.iconKey, this.color, this.parentId});

  factory CatalogItem.fromJson(Map<String, dynamic> json) => CatalogItem(
        id: json['id'] as String,
        name: json['name'] as String,
        iconKey: json['iconKey'] as String?,
        color: json['color'] as String?,
        parentId: json['parentId'] as String?,
      );
}
