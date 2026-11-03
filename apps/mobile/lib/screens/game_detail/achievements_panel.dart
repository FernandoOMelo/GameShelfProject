import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/game_extras.dart';
import '../../providers/game_extras_provider.dart';
import '../../widgets/game_cover.dart';
import '../../widgets/section.dart';

const _card = Color(0xFF1E1E2A);
const _muted = Color(0xFF8888A0);
const _pageSize = 30;

enum _Filter { all, unlocked, locked }

/// Conquistas do jogo no estilo Trophies Hunter: busca, filtro, secretas
/// ocultas por padrão, raridade e data de desbloqueio. A lista é a do
/// Achievist quando existe; a RAWG só completa ícone, descrição e raridade.
class GameAchievementsPanel extends ConsumerStatefulWidget {
  final String gameId;

  const GameAchievementsPanel({super.key, required this.gameId});

  @override
  ConsumerState<GameAchievementsPanel> createState() => _GameAchievementsPanelState();
}

class _GameAchievementsPanelState extends ConsumerState<GameAchievementsPanel> {
  final _search = TextEditingController();
  _Filter _filter = _Filter.all;
  bool _showSecrets = false;
  int _visible = _pageSize;
  String? _groupId;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Color _tierColor(String tier) => switch (tier) {
        'ULTRA_RARE' => const Color(0xFFE5A100),
        'RARE' => const Color(0xFF9E97FF),
        'UNCOMMON' => const Color(0xFF7FB0FF),
        _ => _muted,
      };

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(gameAchievementsProvider(widget.gameId));
    return async.when(
      loading: () => const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
      error: (_, _) => MessageState(
        icon: Icons.cloud_off_rounded,
        message: 'Não foi possível carregar as conquistas.',
        actionLabel: 'Tentar de novo',
        onAction: () => ref.invalidate(gameAchievementsProvider(widget.gameId)),
      ),
      data: (data) {
        if (!data.catalogAvailable) {
          return const MessageState(
            icon: Icons.emoji_events_outlined,
            message: 'Ainda sem catálogo vinculado. A API busca na RAWG ao abrir esta aba '
                '(confira a chave RAWG_API_KEY) ou a plataforma pode ser sincronizada pelo Achievist.',
          );
        }
        final query = _search.text.trim().toLowerCase();
        final groups = data.platformGroups;
        final group = groups.where((item) => item.id == _groupId).firstOrNull ?? (groups.isEmpty ? null : groups.first);
        final achievements = group?.achievements ?? const <MergedAchievement>[];
        final secretCount = achievements.where((item) => item.secret).length;
        final filtered = achievements.where((item) {
          if (item.secret && !_showSecrets) return false;
          if (_filter == _Filter.unlocked && !item.unlocked) return false;
          if (_filter == _Filter.locked && item.unlocked) return false;
          return query.isEmpty || (item.name ?? '').toLowerCase().contains(query);
        }).toList();
        final shown = filtered.take(_visible).toList();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (groups.length > 1) ...[
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  for (final item in groups)
                    ChoiceChip(
                      label: Text('${item.name} · ${item.unlockedCount}/${item.total}'),
                      selected: item.id == group?.id,
                      onSelected: (_) => setState(() {
                        _groupId = item.id;
                        _visible = _pageSize;
                      }),
                    ),
                ],
              ),
              const SizedBox(height: 12),
            ],
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(14)),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${group?.unlockedCount ?? 0}/${group?.total ?? 0} · ${(group?.percent ?? 0).round()}%',
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: ((group?.percent ?? 0) / 100).clamp(0.0, 1.0),
                            minHeight: 6,
                            backgroundColor: const Color(0xFF2A2A3A),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _search,
              decoration: const InputDecoration(
                hintText: 'Buscar conquista',
                prefixIcon: Icon(Icons.search_rounded),
              ),
              onChanged: (_) => setState(() => _visible = _pageSize),
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              children: [
                for (final (filter, label) in const [
                  (_Filter.all, 'Todas'),
                  (_Filter.unlocked, 'Desbloqueadas'),
                  (_Filter.locked, 'Bloqueadas'),
                ])
                  ChoiceChip(
                    label: Text(label),
                    selected: _filter == filter,
                    onSelected: (_) => setState(() {
                      _filter = filter;
                      _visible = _pageSize;
                    }),
                  ),
              ],
            ),
            if (secretCount > 0)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Mostrar conquistas secretas', style: TextStyle(fontSize: 13)),
                subtitle: Text('$secretCount ${secretCount == 1 ? 'oculta' : 'ocultas'}', style: const TextStyle(fontSize: 11)),
                value: _showSecrets,
                onChanged: (value) => setState(() {
                  _showSecrets = value;
                  _visible = _pageSize;
                }),
              ),
            const SizedBox(height: 6),
            if (filtered.isEmpty)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: Text('Nenhuma conquista corresponde ao filtro.', style: TextStyle(color: _muted))),
              )
            else ...[
              for (final item in shown) _AchievementRow(item: item, tierColor: _tierColor(item.rarityTier)),
              if (filtered.length > shown.length)
                Center(
                  child: TextButton(
                    onPressed: () => setState(() => _visible += _pageSize),
                    child: Text('Mostrar mais (${filtered.length - shown.length})'),
                  ),
                ),
            ],
          ],
        );
      },
    );
  }
}

class _AchievementRow extends StatelessWidget {
  final MergedAchievement item;
  final Color tierColor;

  const _AchievementRow({required this.item, required this.tierColor});

  @override
  Widget build(BuildContext context) {
    final secret = item.secret;
    return Opacity(
      opacity: item.unlocked ? 1 : 0.72,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: _card, borderRadius: BorderRadius.circular(12)),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            secret
                ? Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(color: const Color(0xFF2A2A3A), borderRadius: BorderRadius.circular(8)),
                    child: const Icon(Icons.visibility_off_rounded, color: _muted),
                  )
                : GameCover(coverUrl: item.iconUrl, width: 48, height: 48, borderRadius: BorderRadius.circular(8)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(secret ? 'Conquista secreta' : (item.name ?? 'Conquista'),
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 2),
                  Text(
                    secret
                        ? 'Os detalhes desta conquista serão revelados quando desbloqueada'
                        : (item.description ?? ''),
                    style: const TextStyle(color: _muted, fontSize: 12),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(color: tierColor.withValues(alpha: 0.6)),
                        ),
                        child: Text(rarityTierLabels[item.rarityTier] ?? item.rarityTier,
                            style: TextStyle(color: tierColor, fontSize: 10)),
                      ),
                      if (item.rarityPercent != null)
                        Text('${item.rarityPercent!.toStringAsFixed(1).replaceAll('.', ',')}%',
                            style: const TextStyle(color: _muted, fontSize: 11)),
                      if (item.unlocked)
                        Text(
                          item.unlockedAt == null ? 'Desbloqueada' : 'Desbloqueada em ${_date(item.unlockedAt!)}',
                          style: const TextStyle(color: Color(0xFF5FD18D), fontSize: 11),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _date(DateTime value) =>
      '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}/${value.year}';
}
