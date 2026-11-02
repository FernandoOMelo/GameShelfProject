import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../core/achievist_api.dart';
import '../core/platforms_api.dart';
import '../models/catalog.dart';
import '../models/external_match.dart';
import '../models/game.dart';
import '../models/platform_summary.dart';
import '../providers/achievist_provider.dart';
import '../providers/catalog_provider.dart';
import '../providers/games_provider.dart';
import '../widgets/game_cover.dart';
import '../widgets/platform_logo.dart';
import '../widgets/section.dart';
import '../widgets/status.dart';

const _card = Color(0xFF1E1E2A);
const _muted = Color(0xFF8888A0);
const _amber = Color(0xFFE8C872);

String _normalize(String value) => value.trim().toLowerCase();

/// Integração com o Achievist: conexão, sincronização manual e a fila de
/// entradas importadas a revisar. As sugestões são só sugestões: nada é
/// vinculado sem o seu toque, e ambiguidade não é resolvida sozinha. A
/// sincronização nunca cria sessão, jornada ou replay.
class AchievistScreen extends ConsumerStatefulWidget {
  const AchievistScreen({super.key});

  @override
  ConsumerState<AchievistScreen> createState() => _AchievistScreenState();
}

enum _Filter { all, suggested, ambiguous }

class _AchievistScreenState extends ConsumerState<AchievistScreen> {
  final _search = TextEditingController();
  _Filter _filter = _Filter.all;
  bool _busy = false;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _refreshAll() async {
    ref.invalidate(achievistStatusProvider);
    ref.invalidate(achievistSyncStateProvider);
    ref.invalidate(achievistPendingProvider);
    await ref.read(achievistPendingProvider.future);
  }

  Future<void> _guard(Future<void> Function() action, String fallback) async {
    setState(() => _busy = true);
    try {
      await action();
    } catch (error) {
      _toast(PlatformsApi.errorMessage(error, fallback));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sync() => _guard(() async {
    final started = await AchievistApi.startSync();
    if (!started) _toast('Já existe uma sincronização em andamento.');
    await _refreshAll();
  }, 'Não foi possível iniciar a sincronização.');

  Future<bool> _confirm(String title, String message, String action) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(action),
          ),
        ],
      ),
    );
    return result == true;
  }

  Future<void> _link(
    ExternalPendingMatch match,
    String gameId,
    String? platformId,
  ) => _guard(() async {
    await AchievistApi.confirm(
      match.id,
      gameId: gameId,
      platformId: platformId,
    );
    _toast('"${match.title}" vinculado. Nenhuma sessão ou jornada foi criada.');
    await _refreshAll();
    await ref.read(gamesProvider.notifier).reload();
  }, 'Não foi possível confirmar a correspondência.');

  Future<void> _create(
    ExternalPendingMatch match,
    String title,
    String status,
    bool owned,
    String? platformId,
  ) => _guard(() async {
    await AchievistApi.createGame(
      match.id,
      title: title,
      status: status,
      owned: owned,
      platformId: platformId,
    );
    _toast(
      '"$title" cadastrado e vinculado. Nenhuma sessão ou jornada foi criada.',
    );
    await _refreshAll();
    await ref.read(gamesProvider.notifier).reload();
  }, 'Não foi possível cadastrar o jogo.');

  Future<void> _ignore(ExternalPendingMatch match) async {
    final ok = await _confirm(
      'Ignorar entrada',
      '"${match.title}" não será mais proposta nas próximas sincronizações.',
      'Ignorar',
    );
    if (!ok) return;
    await _guard(() async {
      await AchievistApi.ignore(match.id);
      _toast('"${match.title}" não será mais proposto.');
      await _refreshAll();
    }, 'Não foi possível ignorar a entrada.');
  }

  /// Vincula, uma a uma, as entradas com sugestão única; para no primeiro erro.
  Future<void> _linkBatch(
    List<ExternalPendingMatch> batch,
    List<CatalogItem> platforms,
  ) async {
    final ok = await _confirm(
      'Vincular com sugestão única',
      'Vincular ${batch.length} entradas a cada jogo sugerido '
          '(${batch.take(4).map((m) => '"${m.title}"').join(', ')}${batch.length > 4 ? '…' : ''})? '
          'Nenhuma sessão ou jornada será criada.',
      'Vincular todos',
    );
    if (!ok) return;
    setState(() => _busy = true);
    var done = 0;
    try {
      for (final match in batch) {
        final platform = platforms
            .where(
              (item) => _normalize(item.name) == _normalize(match.platformName),
            )
            .firstOrNull;
        await AchievistApi.confirm(
          match.id,
          gameId: match.suggestions.first.gameId,
          platformId: platform?.id,
        );
        done += 1;
      }
      _toast(
        '$done ${done == 1 ? 'entrada vinculada' : 'entradas vinculadas'}. Nenhuma sessão ou jornada foi criada.',
      );
    } catch (error) {
      _toast(
        '$done vinculado${done == 1 ? '' : 's'}. ${PlatformsApi.errorMessage(error, 'Parou ao vincular uma entrada.')}',
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    await _refreshAll();
    await ref.read(gamesProvider.notifier).reload();
  }

  @override
  Widget build(BuildContext context) {
    final status = ref.watch(achievistStatusProvider).valueOrNull;
    final sync = ref.watch(achievistSyncStateProvider).valueOrNull;
    final pendingAsync = ref.watch(achievistPendingProvider);
    final games = ref.watch(gamesProvider).valueOrNull ?? const <Game>[];
    final platforms =
        ref.watch(platformsProvider).valueOrNull ?? const <CatalogItem>[];
    final pending = pendingAsync.valueOrNull ?? const <ExternalPendingMatch>[];
    final disabled = sync?.disabled ?? false;
    final batch = pending.where((match) => match.singleSuggestion).toList();
    final query = _normalize(_search.text);
    final visible = pending.where((match) {
      if (_filter == _Filter.suggested && match.suggestions.isEmpty) {
        return false;
      }
      if (_filter == _Filter.ambiguous && !match.ambiguous) return false;
      return query.isEmpty || _normalize(match.title).contains(query);
    }).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Achievist'),
        actions: [
          IconButton(
            tooltip: 'Atualizar',
            icon: const Icon(Icons.refresh_rounded),
            onPressed: _busy ? null : _refreshAll,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refreshAll,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            _ConnectionCard(
              status: status,
              sync: sync,
              disabled: disabled,
              busy: _busy,
              onTest: () async {
                ref.invalidate(achievistStatusProvider);
                await ref.read(achievistStatusProvider.future);
              },
              onSync: _sync,
            ),
            if (!disabled) ...[
              const SizedBox(height: 20),
              Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Importados para revisar',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 9,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1B2230),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '${pending.length}',
                      style: const TextStyle(
                        color: Color(0xFF9FB6DC),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              if (batch.length > 1) ...[
                const SizedBox(height: 10),
                OutlinedButton(
                  onPressed: _busy ? null : () => _linkBatch(batch, platforms),
                  child: Text(
                    'Vincular todos com sugestão única (${batch.length})',
                  ),
                ),
              ],
              if (pending.isNotEmpty) ...[
                const SizedBox(height: 12),
                TextField(
                  controller: _search,
                  decoration: const InputDecoration(
                    hintText: 'Buscar pelo título',
                    prefixIcon: Icon(Icons.search_rounded),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  children: [
                    for (final (filter, label) in const [
                      (_Filter.all, 'Todos'),
                      (_Filter.suggested, 'Com sugestão'),
                      (_Filter.ambiguous, 'Ambíguos'),
                    ])
                      ChoiceChip(
                        label: Text(label),
                        selected: _filter == filter,
                        onSelected: (_) => setState(() => _filter = filter),
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 12),
              if (pendingAsync.isLoading && pending.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (pending.isEmpty)
                _EmptyBox(
                  'Tudo vinculado.${sync?.lastAt == null ? '' : ' Última sincronização ${formatRelative(sync!.lastAt!)}.'}',
                )
              else if (visible.isEmpty)
                const _EmptyBox('Nenhuma entrada corresponde ao filtro.')
              else
                for (final match in visible)
                  PendingCard(
                    key: ValueKey(match.id),
                    match: match,
                    games: games,
                    platforms: platforms,
                    busy: _busy,
                    onLink: (gameId, platformId) =>
                        _link(match, gameId, platformId),
                    onCreate: (title, status, owned, platformId) =>
                        _create(match, title, status, owned, platformId),
                    onIgnore: () => _ignore(match),
                  ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EmptyBox extends StatelessWidget {
  final String text;

  const _EmptyBox(this.text);

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(22),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: const Color(0xFF2A2A3A)),
    ),
    child: Text(
      text,
      textAlign: TextAlign.center,
      style: const TextStyle(color: _muted, fontSize: 13),
    ),
  );
}

/// Conexão e sincronização: chip de status, testar conexão e sincronizar.
class _ConnectionCard extends StatelessWidget {
  final IntegrationStatus? status;
  final SyncState? sync;
  final bool disabled;
  final bool busy;
  final Future<void> Function() onTest;
  final VoidCallback onSync;

  const _ConnectionCard({
    required this.status,
    required this.sync,
    required this.disabled,
    required this.busy,
    required this.onTest,
    required this.onSync,
  });

  @override
  Widget build(BuildContext context) {
    if (disabled) {
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF2A2412),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF6B5420)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Integração desligada',
              style: TextStyle(color: _amber, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              sync?.error ??
                  'Configure ACHIEVIST_BASE_URL, ACHIEVIST_USERNAME e ACHIEVIST_PASSWORD no servidor.',
              style: const TextStyle(color: _amber, fontSize: 12),
            ),
          ],
        ),
      );
    }

    final (label, fg, bg) = status == null
        ? (
            'Verificando conexão…',
            const Color(0xFF8B949E),
            const Color(0xFF171B22),
          )
        : status!.reachable == true
        ? (
            'Conexão confirmada${status!.accounts == null ? '' : ' · ${status!.accounts} ${status!.accounts == 1 ? 'conta conectada' : 'contas conectadas'}'}',
            const Color(0xFF5FD18D),
            const Color(0xFF12301F),
          )
        : status!.reachable == false
        ? (
            status!.error ?? 'Sem conexão',
            const Color(0xFFF08A7E),
            const Color(0xFF3A1A18),
          )
        : (
            status!.configured
                ? 'Conexão ainda não testada'
                : 'Não configurada',
            const Color(0xFF8B949E),
            const Color(0xFF171B22),
          );

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _card,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'O Achievist informa a biblioteca e o tempo acumulado por plataforma. A sincronização nunca cria '
            'sessão, jornada ou replay, e o tempo externo não é somado às suas horas.',
            style: TextStyle(color: _muted, fontSize: 12, height: 1.4),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  label,
                  style: TextStyle(
                    color: fg,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              OutlinedButton(
                onPressed: onTest,
                child: const Text('Testar conexão'),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(height: 1),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: busy || (sync?.running ?? false) ? null : onSync,
              icon: const Icon(Icons.sync_rounded),
              label: Text(
                sync?.running == true ? 'Sincronizando…' : 'Sincronizar agora',
              ),
            ),
          ),
          if (sync != null) ...[
            const SizedBox(height: 8),
            Text(
              _describe(sync!),
              style: const TextStyle(color: _muted, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }

  static String _describe(SyncState state) {
    final at = state.lastAt;
    final when = at == null ? '' : ' ${formatRelative(at)}';
    return switch (state.status) {
      'running' => 'Sincronização em andamento.',
      'failed' =>
        'A última sincronização falhou: ${state.error ?? 'fonte indisponível'}. A biblioteca e as sessões seguem normais.',
      'succeeded' =>
        state.fetched == null
            ? 'Última sincronização concluída.'
            : 'Última sincronização$when: ${state.fetched} entradas lidas, ${state.updated ?? 0} tempos atualizados, '
                  '${state.pending ?? 0} aguardando confirmação.',
      _ => 'Nenhuma sincronização nesta execução da API.',
    };
  }
}

/// Cartão de uma entrada importada: escolher o jogo (sugestões e busca), a
/// plataforma e vincular, ou cadastrar como jogo novo.
class PendingCard extends StatefulWidget {
  final ExternalPendingMatch match;
  final List<Game> games;
  final List<CatalogItem> platforms;
  final bool busy;
  final void Function(String gameId, String? platformId) onLink;
  final void Function(
    String title,
    String status,
    bool owned,
    String? platformId,
  )
  onCreate;
  final VoidCallback onIgnore;

  const PendingCard({
    super.key,
    required this.match,
    required this.games,
    required this.platforms,
    required this.busy,
    required this.onLink,
    required this.onCreate,
    required this.onIgnore,
  });

  @override
  State<PendingCard> createState() => _PendingCardState();
}

class _PendingCardState extends State<PendingCard> {
  final _search = TextEditingController();
  late final TextEditingController _newTitle = TextEditingController(
    text: widget.match.title,
  );
  // A sugestão só preenche a escolha quando é única: com mais de um candidato a
  // seleção começa vazia, para que a decisão seja sua.
  late String? _gameId = widget.match.suggestions.length == 1
      ? widget.match.suggestions.first.gameId
      : null;
  late String? _platformId = _matched?.id;
  bool _changingPlatform = false;
  bool _creating = false;
  String _newStatus = 'BACKLOG';
  bool _newOwned = true;

  CatalogItem? get _matched => widget.platforms
      .where(
        (item) =>
            _normalize(item.name) == _normalize(widget.match.platformName),
      )
      .firstOrNull;

  @override
  void dispose() {
    _search.dispose();
    _newTitle.dispose();
    super.dispose();
  }

  Game? _game(String id) =>
      widget.games.where((game) => game.id == id).firstOrNull;

  Widget _gameChip(String id, String title, {required bool suggested}) {
    final game = _game(id);
    final selected = _gameId == id;
    return ChoiceChip(
      selected: selected,
      avatar: game?.coverUrl == null
          ? null
          : GameCover(
              coverUrl: game!.coverUrl,
              width: 22,
              height: 22,
              borderRadius: BorderRadius.circular(4),
            ),
      label: Text(
        '$title${game?.releaseYear == null ? '' : ' · ${game!.releaseYear}'}${suggested ? ' · sugerido' : ''}',
      ),
      onSelected: (_) => setState(() => _gameId = id),
    );
  }

  @override
  Widget build(BuildContext context) {
    final match = widget.match;
    final matched = _matched;
    final chosen =
        widget.platforms.where((item) => item.id == _platformId).firstOrNull ??
        matched;
    final suggestedIds = match.suggestions.map((item) => item.gameId).toSet();
    final query = _normalize(_search.text);
    final results = query.isEmpty
        ? const <Game>[]
        : widget.games
              .where(
                (game) =>
                    !suggestedIds.contains(game.id) &&
                    _normalize(game.title).contains(query),
              )
              .take(6)
              .toList();
    final selected = _gameId == null ? null : _game(_gameId!);
    final sortedPlatforms = [...widget.platforms]
      ..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));

    // Material (e não DecoratedBox) para o SwitchListTile pintar o toque sobre o cartão.
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: _card,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  PlatformLogo(
                    iconKey: chosen?.iconKey,
                    color: chosen?.color,
                    size: 44,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          match.title,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          '${match.platformName}${match.accountLabel == null ? '' : ' · ${match.accountLabel}'}',
                          style: const TextStyle(color: _muted, fontSize: 11.5),
                        ),
                        Text(
                          '${match.externalPlaytimeMinutes == null || match.externalPlaytimeMinutes == 0 ? 'Sem tempo informado pela plataforma' : 'Tempo informado pela plataforma: ${formatMinutes(match.externalPlaytimeMinutes)}'}'
                          '${match.externalLastPlayedAt == null ? '' : ' · última atividade em ${DateFormat("d 'de' MMM 'de' y", 'pt_BR').format(match.externalLastPlayedAt!)}'}',
                          style: const TextStyle(color: _muted, fontSize: 11.5),
                        ),
                      ],
                    ),
                  ),
                  PopupMenuButton<String>(
                    tooltip: 'Mais ações de ${match.title}',
                    onSelected: (_) => widget.onIgnore(),
                    itemBuilder: (_) => const [
                      PopupMenuItem(
                        value: 'ignore',
                        child: Text(
                          'Ignorar',
                          style: TextStyle(color: Color(0xFFE53E3E)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              if (match.ambiguous) ...[
                const SizedBox(height: 10),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF2A2412),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFF6B5420)),
                  ),
                  child: Text(
                    '${match.suggestions.length} jogos da sua biblioteca têm este título. Escolha qual é: a correspondência não é resolvida automaticamente.',
                    style: const TextStyle(color: _amber, fontSize: 12),
                  ),
                ),
              ],
              const SizedBox(height: 12),
              const Text(
                'JOGO CORRESPONDENTE',
                style: TextStyle(
                  color: _muted,
                  fontSize: 10.5,
                  letterSpacing: 0.4,
                ),
              ),
              if (match.suggestions.isNotEmpty) ...[
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    for (final item in match.suggestions)
                      _gameChip(item.gameId, item.title, suggested: true),
                  ],
                ),
              ],
              const SizedBox(height: 8),
              TextField(
                controller: _search,
                decoration: const InputDecoration(
                  hintText: 'Buscar outro jogo da biblioteca',
                  isDense: true,
                ),
                onChanged: (_) => setState(() {}),
              ),
              if (results.isNotEmpty) ...[
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    for (final game in results)
                      _gameChip(game.id, game.title, suggested: false),
                  ],
                ),
              ],
              if (selected != null && !suggestedIds.contains(selected.id))
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    'Selecionado: ${selected.title}',
                    style: const TextStyle(
                      color: Color(0xFF9AA3AD),
                      fontSize: 12,
                    ),
                  ),
                ),
              const SizedBox(height: 12),
              const Text(
                'PLATAFORMA',
                style: TextStyle(
                  color: _muted,
                  fontSize: 10.5,
                  letterSpacing: 0.4,
                ),
              ),
              const SizedBox(height: 6),
              if (matched != null && !_changingPlatform)
                Row(
                  children: [
                    Chip(
                      avatar: PlatformLogo(
                        iconKey: matched.iconKey,
                        color: matched.color,
                        size: 20,
                      ),
                      label: Text(matched.name),
                    ),
                    TextButton(
                      onPressed: () => setState(() => _changingPlatform = true),
                      child: const Text('Alterar'),
                    ),
                  ],
                )
              else
                DropdownButtonFormField<String?>(
                  initialValue: _platformId,
                  isExpanded: true,
                  decoration: const InputDecoration(isDense: true),
                  items: [
                    DropdownMenuItem<String?>(
                      value: null,
                      child: Text('Criar "${match.platformName}"'),
                    ),
                    for (final item in sortedPlatforms)
                      DropdownMenuItem<String?>(
                        value: item.id,
                        child: Text(item.name),
                      ),
                  ],
                  onChanged: (value) => setState(() => _platformId = value),
                ),
              const SizedBox(height: 14),
              const Divider(height: 1),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: FilledButton(
                      onPressed: widget.busy || _gameId == null
                          ? null
                          : () => widget.onLink(_gameId!, _platformId),
                      child: const Text('Vincular a um jogo'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: widget.busy
                          ? null
                          : () => setState(() => _creating = !_creating),
                      child: Text(
                        _creating ? 'Cancelar cadastro' : 'Cadastrar como novo',
                      ),
                    ),
                  ),
                ],
              ),
              if (_creating) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFF3A3A4E)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextField(
                        controller: _newTitle,
                        maxLength: 200,
                        decoration: const InputDecoration(
                          labelText: 'Título do novo jogo',
                          counterText: '',
                        ),
                      ),
                      const SizedBox(height: 10),
                      DropdownButtonFormField<String>(
                        initialValue: _newStatus,
                        decoration: const InputDecoration(labelText: 'Estado'),
                        items: [
                          for (final key in const [
                            'BACKLOG',
                            'DESIRED',
                            'PLAYING',
                            'PAUSED',
                          ])
                            DropdownMenuItem(
                              value: key,
                              child: Text(statusLabels[key] ?? key),
                            ),
                        ],
                        onChanged: (value) =>
                            setState(() => _newStatus = value ?? 'BACKLOG'),
                      ),
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        title: const Text('Possuo este jogo'),
                        value: _newOwned,
                        onChanged: (value) => setState(() => _newOwned = value),
                      ),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed:
                              widget.busy || _newTitle.text.trim().isEmpty
                              ? null
                              : () => widget.onCreate(
                                  _newTitle.text.trim(),
                                  _newStatus,
                                  _newOwned,
                                  _platformId,
                                ),
                          child: const Text('Cadastrar e vincular'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
