import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/suggestions_api.dart';
import '../models/suggestion.dart';

final suggestionsProvider =
    FutureProvider<List<Suggestion>>((ref) => SuggestionsApi.list());
