import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/catalog_api.dart';
import '../core/metadata_api.dart';
import '../models/game.dart';
import '../models/metadata.dart';
import '../providers/catalog_provider.dart';
import '../providers/games_provider.dart';
import '../widgets/section.dart';
import '../widgets/status.dart';

double? _numberOrNull(String value) {
  final text = value.trim().replaceAll(',', '.');
  if (text.isEmpty) return null;
  return double.tryParse(text);
}

/// Cadastro e edição de jogo. Espelha o formulário da web e usa as mesmas rotas
/// de metadata (IGDB) e tempos (HowLongToBeat).
class GameEditorScreen extends ConsumerStatefulWidget {
  final Game? game;

  const GameEditorScreen({super.key, this.game});

  @override
  ConsumerState<GameEditorScreen> createState() => _GameEditorScreenState();
}

class _GameEditorScreenState extends ConsumerState<GameEditorScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _coverUrl = TextEditingController();
  final _backgroundUrl = TextEditingController();
  final _releaseYear = TextEditingController();
  final _developer = TextEditingController();
  final _publisher = TextEditingController();
  final _franchiseName = TextEditingController();
  final _gameType = TextEditingController();
  final _completionCondition = TextEditingController();
  final _estimatedMainHours = TextEditingController();
  final _estimatedCompletionistHours = TextEditingController();
  final _personalEstimatedHours = TextEditingController();
  final _retroactiveHours = TextEditingController();
  final _notes = TextEditingController();

  String _status = 'BACKLOG';
  String _priority = 'NORMAL';
  String? _difficulty;
  String? _platformId;
  final Set<String> _genreIds = {};
  bool _favorite = false;
  bool _gameOfYear = false;
  bool _owned = false;
  bool _archived = false;
  bool _excludedFromSuggestions = false;
  String? _startedAt;
  String? _completedAt;
  int? _rating;

  bool _saving = false;
  bool _searching = false;
  String _feedback = '';
  List<GameMetadataCandidate> _metadataResults = [];
  List<GameTimeEstimate> _timeResults = [];

  bool get _isEditing => widget.game != null;

  @override
  void initState() {
    super.initState();
    final game = widget.game;
    if (game == null) return;
    _title.text = game.title;
    _description.text = game.description ?? '';
    _coverUrl.text = game.coverUrl ?? '';
    _backgroundUrl.text = game.backgroundUrl ?? '';
    _releaseYear.text = game.releaseYear?.toString() ?? '';
    _developer.text = game.developer ?? '';
    _publisher.text = game.publisher ?? '';
    _gameType.text = game.gameType ?? '';
    _completionCondition.text = game.completionCondition ?? '';
    _estimatedMainHours.text = _trim(game.estimatedMainHours);
    _estimatedCompletionistHours.text = _trim(game.estimatedCompletionistHours);
    _personalEstimatedHours.text = _trim(game.personalEstimatedHours);
    _notes.text = game.notes ?? '';
    _status = game.status;
    _priority = game.priority;
    _difficulty = game.difficulty;
    _platformId = game.platformId;
    _genreIds.addAll(game.genreIds);
    _favorite = game.favorite;
    _gameOfYear = game.gameOfYear;
    _owned = game.owned;
    _archived = game.archived;
    _excludedFromSuggestions = game.excludedFromSuggestions;
    _startedAt = game.startedAt;
    _completedAt = game.completedAt;
    _rating = game.rating;
  }

  static String _trim(double? value) {
    if (value == null) return '';
    return value == value.roundToDouble()
        ? value.toStringAsFixed(0)
        : value.toStringAsFixed(1);
  }

  @override
  void dispose() {
    for (final controller in [
      _title, _description, _coverUrl, _backgroundUrl, _releaseYear, _developer,
      _publisher, _franchiseName, _gameType, _completionCondition,
      _estimatedMainHours, _estimatedCompletionistHours, _personalEstimatedHours,
      _retroactiveHours, _notes,
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _search() async {
    final query = _title.text.trim();
    if (query.length < 3) {
      setState(() => _feedback = 'Digite ao menos 3 caracteres do título para pesquisar.');
      return;
    }
    setState(() {
      _searching = true;
      _feedback = '';
      _metadataResults = [];
      _timeResults = [];
    });
    final results = await Future.wait([
      MetadataApi.searchGames(query).then<Object?>((value) => value).catchError((_) => null),
      MetadataApi.searchTimeEstimates(query).then<Object?>((value) => value).catchError((_) => null),
    ]);
    if (!mounted) return;
    setState(() {
      _searching = false;
      _metadataResults = (results[0] as List<GameMetadataCandidate>?) ?? [];
      _timeResults = (results[1] as List<GameTimeEstimate>?) ?? [];
      if (_metadataResults.isEmpty && _timeResults.isEmpty) {
        _feedback = 'Nenhum resultado encontrado (verifique se a API tem IGDB/HowLongToBeat configurados).';
      }
    });
  }

  void _applyMetadata(GameMetadataCandidate candidate) {
    setState(() {
      _title.text = candidate.title;
      _description.text = candidate.description ?? _description.text;
      _coverUrl.text = candidate.coverUrl ?? _coverUrl.text;
      _backgroundUrl.text = candidate.backgroundUrl ?? _backgroundUrl.text;
      _releaseYear.text = candidate.releaseYear?.toString() ?? _releaseYear.text;
      _developer.text = candidate.developer ?? _developer.text;
      _publisher.text = candidate.publisher ?? _publisher.text;
      _franchiseName.text = candidate.franchise ?? _franchiseName.text;
      _metadataResults = [];
      _feedback = 'Metadata preenchida para revisão.';
    });
  }

  void _applyTimeEstimate(GameTimeEstimate estimate) {
    setState(() {
      _estimatedMainHours.text = _trim(estimate.mainHours);
      _personalEstimatedHours.text = _trim(estimate.mainExtraHours);
      _estimatedCompletionistHours.text = _trim(estimate.completionistHours);
      _timeResults = [];
      _feedback = 'Tempos preenchidos: principal, pessoal (principal + extras) e completista.';
    });
  }

  Future<void> _pickDate({required bool started}) async {
    final current = started ? _startedAt : _completedAt;
    final initial = current != null
        ? DateTime.parse(current)
        : DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1970),
      lastDate: DateTime(DateTime.now().year + 5),
    );
    if (picked == null) return;
    final value =
        '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    setState(() {
      if (started) {
        _startedAt = value;
      } else {
        _completedAt = value;
      }
    });
  }

  Future<void> _save() async {
    final title = _title.text.trim();
    if (title.isEmpty) {
      setState(() => _feedback = 'Informe o título do jogo.');
      return;
    }
    if (_startedAt != null && _completedAt != null && _completedAt!.compareTo(_startedAt!) < 0) {
      setState(() => _feedback = 'A data de conclusão não pode ser anterior ao início.');
      return;
    }
    if (_rating != null && _status != 'COMPLETED' && _status != 'ABANDONED') {
      setState(() => _feedback = 'A avaliação só vale para jogos zerados ou abandonados.');
      return;
    }
    if (_gameOfYear && _completedAt == null) {
      setState(() => _feedback = 'Informe a data de conclusão para marcar o jogo do ano.');
      return;
    }

    setState(() {
      _saving = true;
      _feedback = '';
    });

    try {
      final franchiseId = await _resolveFranchise();
      final game = Game(
        id: widget.game?.id ?? '',
        title: title,
        status: _status,
        description: _emptyToNull(_description.text),
        coverUrl: _emptyToNull(_coverUrl.text),
        backgroundUrl: _emptyToNull(_backgroundUrl.text),
        releaseYear: int.tryParse(_releaseYear.text.trim()),
        developer: _emptyToNull(_developer.text),
        publisher: _emptyToNull(_publisher.text),
        franchiseId: franchiseId,
        platformId: _platformId,
        genreIds: _genreIds.toList(),
        rating: _rating,
        difficulty: _difficulty,
        gameType: _emptyToNull(_gameType.text),
        completionCondition: _emptyToNull(_completionCondition.text),
        favorite: _favorite,
        gameOfYear: _gameOfYear,
        excludedFromSuggestions: _excludedFromSuggestions,
        owned: _owned,
        archived: _archived,
        startedAt: _startedAt,
        completedAt: _completedAt,
        priority: _priority,
        estimatedMainHours: _numberOrNull(_estimatedMainHours.text),
        estimatedCompletionistHours: _numberOrNull(_estimatedCompletionistHours.text),
        personalEstimatedHours: _numberOrNull(_personalEstimatedHours.text),
        retroactivePlayedHours: _numberOrNull(_retroactiveHours.text) ?? widget.game?.retroactivePlayedHours ?? 0,
        notes: _emptyToNull(_notes.text),
      );

      final saved = _isEditing
          ? await ref.read(gamesProvider.notifier).updateGame(widget.game!.id, game.toInputJson())
          : await ref.read(gamesProvider.notifier).create(game);

      if (mounted) Navigator.pop(context, saved);
    } catch (cause) {
      setState(() {
        _saving = false;
        _feedback = 'Não foi possível salvar o jogo. ${_reason(cause)}';
      });
    }
  }

  /// Resolve o nome da franquia para um id, criando-a se ainda não existir.
  Future<String?> _resolveFranchise() async {
    final name = _franchiseName.text.trim();
    if (name.isEmpty) return widget.game?.franchiseId;
    final franchises = ref.read(franchisesProvider).valueOrNull ?? const [];
    final existing = franchises.where(
      (item) => item.name.toLowerCase() == name.toLowerCase(),
    );
    if (existing.isNotEmpty) return existing.first.id;
    final created = await CatalogApi.createFranchise(name);
    ref.invalidate(franchisesProvider);
    return created.id;
  }

  static String? _emptyToNull(String value) => value.trim().isEmpty ? null : value.trim();

  static String _reason(Object cause) {
    final text = cause.toString();
    final match = RegExp(r'"error"\s*:\s*"([^"]+)"').firstMatch(text);
    return match?.group(1) ?? '';
  }

  @override
  Widget build(BuildContext context) {
    final platforms = ref.watch(platformsProvider);
    final genres = ref.watch(genresProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditing ? 'Editar jogo' : 'Novo jogo'),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 18, height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Salvar'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          if (_feedback.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                _feedback,
                style: const TextStyle(color: Color(0xFFECC94B), fontSize: 13),
              ),
            ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: _title,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(labelText: 'Título *'),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filledTonal(
                onPressed: _searching ? null : _search,
                tooltip: 'Buscar metadata e tempos',
                icon: _searching
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.travel_explore_rounded),
              ),
            ],
          ),
          for (final candidate in _metadataResults)
            _SuggestionCard(
              title: candidate.title,
              subtitle: [candidate.releaseYear, candidate.developer]
                  .where((part) => part != null)
                  .join(' · '),
              actionLabel: 'Usar metadata',
              onAction: () => _applyMetadata(candidate),
            ),
          for (final estimate in _timeResults)
            _SuggestionCard(
              title: estimate.title,
              subtitle:
                  'Principal ${formatHours(estimate.mainHours)} · Pessoal ${formatHours(estimate.mainExtraHours)} · Completista ${formatHours(estimate.completionistHours)}',
              actionLabel: 'Usar tempos',
              onAction: () => _applyTimeEstimate(estimate),
            ),
          const SizedBox(height: 16),
          const SectionTitle('Situação'),
          DropdownButtonFormField<String>(
            initialValue: _status,
            decoration: const InputDecoration(labelText: 'Status'),
            items: [
              for (final entry in statusLabels.entries)
                DropdownMenuItem(value: entry.key, child: Text(entry.value)),
            ],
            onChanged: (value) => setState(() => _status = value ?? 'BACKLOG'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _priority,
            decoration: const InputDecoration(labelText: 'Prioridade'),
            items: [
              for (final entry in priorityLabels.entries)
                DropdownMenuItem(value: entry.key, child: Text(entry.value)),
            ],
            onChanged: (value) => setState(() => _priority = value ?? 'NORMAL'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _dateField('Início', _startedAt, () => _pickDate(started: true), () => setState(() => _startedAt = null))),
              const SizedBox(width: 12),
              Expanded(child: _dateField('Conclusão', _completedAt, () => _pickDate(started: false), () => setState(() => _completedAt = null))),
            ],
          ),
          if (_status == 'COMPLETED' || _status == 'ABANDONED') ...[
            const SizedBox(height: 12),
            DropdownButtonFormField<int?>(
              initialValue: _rating,
              decoration: const InputDecoration(labelText: 'Avaliação (1–11)'),
              items: [
                const DropdownMenuItem(value: null, child: Text('Sem avaliação')),
                for (var value = 1; value <= 11; value++)
                  DropdownMenuItem(value: value, child: Text('$value')),
              ],
              onChanged: (value) => setState(() => _rating = value),
            ),
          ],
          const SizedBox(height: 20),
          const SectionTitle('Classificação'),
          platforms.when(
            data: (items) => DropdownButtonFormField<String?>(
              initialValue: _platformId != null && items.any((item) => item.id == _platformId)
                  ? _platformId
                  : null,
              decoration: const InputDecoration(labelText: 'Plataforma'),
              items: [
                const DropdownMenuItem(value: null, child: Text('—')),
                for (final item in items)
                  DropdownMenuItem(value: item.id, child: Text(item.name)),
              ],
              onChanged: (value) => setState(() => _platformId = value),
            ),
            loading: () => const LinearProgressIndicator(),
            error: (_, _) => const Text('Não foi possível carregar plataformas.'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _franchiseName,
            decoration: const InputDecoration(
              labelText: 'Franquia',
              helperText: 'Criada automaticamente se não existir.',
            ),
          ),
          const SizedBox(height: 12),
          TextField(controller: _developer, decoration: const InputDecoration(labelText: 'Desenvolvedora')),
          const SizedBox(height: 12),
          TextField(controller: _publisher, decoration: const InputDecoration(labelText: 'Publicadora')),
          const SizedBox(height: 12),
          TextField(
            controller: _releaseYear,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Ano de lançamento'),
          ),
          const SizedBox(height: 12),
          genres.when(
            data: (items) => items.isEmpty
                ? const SizedBox.shrink()
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.only(bottom: 8),
                        child: Text('Gêneros', style: TextStyle(color: Color(0xFF8888A0), fontSize: 13)),
                      ),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final item in items)
                            FilterChip(
                              label: Text(item.name),
                              selected: _genreIds.contains(item.id),
                              onSelected: (selected) => setState(() {
                                if (selected) {
                                  _genreIds.add(item.id);
                                } else {
                                  _genreIds.remove(item.id);
                                }
                              }),
                            ),
                        ],
                      ),
                    ],
                  ),
            loading: () => const LinearProgressIndicator(),
            error: (_, _) => const SizedBox.shrink(),
          ),
          const SizedBox(height: 12),
          TextField(controller: _gameType, decoration: const InputDecoration(labelText: 'Tipo de jogo')),
          const SizedBox(height: 12),
          DropdownButtonFormField<String?>(
            initialValue: _difficulty,
            decoration: const InputDecoration(labelText: 'Dificuldade'),
            items: [
              const DropdownMenuItem(value: null, child: Text('—')),
              for (final entry in difficultyLabels.entries)
                DropdownMenuItem(value: entry.key, child: Text(entry.value)),
            ],
            onChanged: (value) => setState(() => _difficulty = value),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _completionCondition,
            decoration: const InputDecoration(labelText: 'Condição de conclusão'),
          ),
          const SizedBox(height: 20),
          const SectionTitle('Estimativas'),
          Row(
            children: [
              Expanded(child: TextField(controller: _estimatedMainHours, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Principal (h)'))),
              const SizedBox(width: 12),
              Expanded(child: TextField(controller: _personalEstimatedHours, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Pessoal (h)'))),
            ],
          ),
          const SizedBox(height: 12),
          TextField(controller: _estimatedCompletionistHours, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: const InputDecoration(labelText: 'Completista (h)')),
          const SizedBox(height: 12),
          TextField(
            controller: _retroactiveHours,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: 'Horas jogadas sem sessão (h)',
              helperText: _isEditing
                  ? 'Substitui o total de horas lançadas manualmente.'
                  : 'Horas já jogadas antes de começar a registrar sessões.',
            ),
          ),
          const SizedBox(height: 20),
          const SectionTitle('Marcadores'),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _owned,
            onChanged: (value) => setState(() => _owned = value),
            title: const Text('Eu tenho este jogo'),
            subtitle: const Text('A fila só aceita jogos que você possui.'),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _favorite,
            onChanged: (value) => setState(() => _favorite = value),
            title: const Text('Favorito'),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _gameOfYear,
            onChanged: (value) => setState(() => _gameOfYear = value),
            title: const Text('Jogo do ano'),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _excludedFromSuggestions,
            onChanged: (value) => setState(() => _excludedFromSuggestions = value),
            title: const Text('Fora das sugestões'),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _archived,
            onChanged: (value) => setState(() => _archived = value),
            title: const Text('Arquivado'),
          ),
          const SizedBox(height: 20),
          const SectionTitle('Notas'),
          TextField(
            controller: _notes,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Notas gerais',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _description,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Descrição',
              alignLabelWithHint: true,
            ),
          ),
        ],
      ),
    );
  }

  Widget _dateField(
    String label,
    String? value,
    VoidCallback onPick,
    VoidCallback onClear,
  ) {
    return InkWell(
      onTap: onPick,
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          suffixIcon: value == null
              ? const Icon(Icons.calendar_today_rounded, size: 18)
              : IconButton(
                  icon: const Icon(Icons.clear, size: 18),
                  onPressed: onClear,
                ),
        ),
        child: Text(value ?? '—'),
      ),
    );
  }
}

class _SuggestionCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String actionLabel;
  final VoidCallback onAction;

  const _SuggestionCard({
    required this.title,
    required this.subtitle,
    required this.actionLabel,
    required this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E2A),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
                if (subtitle.isNotEmpty)
                  Text(subtitle, style: const TextStyle(color: Color(0xFF8888A0), fontSize: 12)),
              ],
            ),
          ),
          TextButton(onPressed: onAction, child: Text(actionLabel)),
        ],
      ),
    );
  }
}
