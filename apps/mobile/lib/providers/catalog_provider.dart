import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/catalog_api.dart';
import '../models/catalog.dart';

final platformsProvider = FutureProvider<List<CatalogItem>>((ref) => CatalogApi.platforms());
final genresProvider = FutureProvider<List<CatalogItem>>((ref) => CatalogApi.genres());
final franchisesProvider = FutureProvider<List<CatalogItem>>((ref) => CatalogApi.franchises());
