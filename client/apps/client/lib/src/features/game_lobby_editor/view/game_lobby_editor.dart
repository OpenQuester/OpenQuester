import 'dart:async';

import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GameLobbyEditor extends WatchingWidget {
  const GameLobbyEditor({super.key});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final layout =
            LobbyLayoutScope.maybeOf(context) ??
            LobbyLayoutResolver.resolve(
              availableWidth: constraints.maxWidth,
              chatOpen: false,
            );
        final desktopWaitingRoom = layout.usesTwoMainColumns;

        if (desktopWaitingRoom) {
          return Column(
            children: [
              const _WaitingRoomHeader().paddingOnly(
                left: layout.pagePadding,
                right: layout.pagePadding,
                top: 16,
                bottom: 12,
              ),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(
                    layout.pagePadding,
                    0,
                    layout.pagePadding,
                    16,
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    spacing: layout.gap,
                    children: [
                      const _LobbyPanel(
                        child: _RoleList(
                          showHeading: true,
                          compactPlayers: true,
                        ),
                      ).withWidth(layout.participantPanelWidth),
                      const Expanded(
                        child: _LobbyPackageOverview(scrollable: true),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        }

        return Column(
          children: [
            const _WaitingRoomHeader().paddingOnly(
              left: layout.pagePadding,
              right: layout.pagePadding,
              top: 16,
              bottom: 12,
            ),
            Expanded(
              child: ListView(
                key: const PageStorageKey<String>('lobby_waiting_room_scroll'),
                padding:
                    EdgeInsets.symmetric(horizontal: layout.pagePadding) +
                    EdgeInsets.only(
                      bottom: 24 + MediaQuery.viewPaddingOf(context).bottom,
                    ),
                children: const [
                  _LobbyPanel(
                    child: _RoleList(
                      showHeading: true,
                      compactPlayers: true,
                    ),
                  ),
                  SizedBox(height: 16),
                  _LobbyPackageOverview(),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _RoleList extends StatelessWidget {
  const _RoleList({required this.showHeading, required this.compactPlayers});

  final bool showHeading;
  final bool compactPlayers;

  static const _compactPlayerRowHeight = 50.0;
  static const double _compactSpectatorsMaxHeight =
      (_compactPlayerRowHeight * 2) + _RolePlayersWrapContent._spacing;

  @override
  Widget build(BuildContext context) {
    final showmanGroup = _RoleGroup(
      PlayerRole.showman,
      showDisconnected: false,
      compactPlayers: compactPlayers,
      fixedPlayersHeight: compactPlayers ? _compactPlayerRowHeight : null,
    );
    final playersGroup = _RoleGroup(
      PlayerRole.player,
      showDisconnected: false,
      compactPlayers: compactPlayers,
    );
    final spectatorsGroup = _RoleGroup(
      PlayerRole.spectator,
      showDisconnected: false,
      compactPlayers: compactPlayers,
      scrollablePlayers: true,
      maxUnboundedPlayersHeight: compactPlayers
          ? _compactSpectatorsMaxHeight
          : null,
      fixedPlayersHeight: compactPlayers ? _compactSpectatorsMaxHeight : null,
    );

    final contentChildren = <Widget>[
      if (showHeading) const _RoleListHeader().paddingBottom(14),
      showmanGroup,
      const _RoleSectionDivider(),
      playersGroup,
      const _RoleSectionDivider(),
      spectatorsGroup,
    ];

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: contentChildren,
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        if (!constraints.hasBoundedHeight || !compactPlayers) return content;

        return ListView(
          children: [
            if (showHeading) const _RoleListHeader().paddingBottom(14),
            showmanGroup,
            const _RoleSectionDivider(),
            Expanded(child: playersGroup),
            const _RoleSectionDivider(),
            spectatorsGroup,
          ],
        );
      },
    );
  }
}

class _FadingScrollView extends StatefulWidget {
  const _FadingScrollView({
    required this.child,
    this.bottomPadding = 12,
  });

  final Widget child;
  final double bottomPadding;

  @override
  State<_FadingScrollView> createState() => _FadingScrollViewState();
}

class _FadingScrollViewState extends State<_FadingScrollView> {
  static const _fadeHeight = 48.0;

  final _controller = ScrollController();
  bool _showTopFade = false;
  bool _showBottomFade = false;

  @override
  void initState() {
    super.initState();
    _controller.addListener(_updateFadeVisibility);
  }

  @override
  void dispose() {
    _controller
      ..removeListener(_updateFadeVisibility)
      ..dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _updateFadeVisibility();
    });

    return NotificationListener<SizeChangedLayoutNotification>(
      onNotification: (_) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _updateFadeVisibility();
        });
        return false;
      },
      child: NotificationListener<ScrollNotification>(
        onNotification: (_) {
          _updateFadeVisibility();
          return false;
        },
        child: Stack(
          children: [
            Scrollbar(
              controller: _controller,
              child: SingleChildScrollView(
                controller: _controller,
                primary: false,
                padding: EdgeInsets.only(bottom: widget.bottomPadding),
                child: SizeChangedLayoutNotifier(child: widget.child),
              ),
            ),
            if (_showTopFade)
              const _ScrollEdgeFade(
                alignment: Alignment.topCenter,
                height: _fadeHeight,
              ),
            if (_showBottomFade)
              const _ScrollEdgeFade(
                alignment: Alignment.bottomCenter,
                height: _fadeHeight,
              ),
          ],
        ),
      ),
    );
  }

  void _updateFadeVisibility() {
    if (!_controller.hasClients) return;

    final position = _controller.position;
    final showTopFade = position.pixels > .5;
    final meaningfulMaxScrollExtent =
        position.maxScrollExtent - widget.bottomPadding;
    final showBottomFade = meaningfulMaxScrollExtent - position.pixels > .5;

    if (showTopFade == _showTopFade && showBottomFade == _showBottomFade) {
      return;
    }

    setState(() {
      _showTopFade = showTopFade;
      _showBottomFade = showBottomFade;
    });
  }
}

class _ScrollEdgeFade extends StatelessWidget {
  const _ScrollEdgeFade({required this.alignment, required this.height});

  final Alignment alignment;
  final double height;

  @override
  Widget build(BuildContext context) {
    final isTop = alignment == Alignment.topCenter;
    final color = context.theme.colorScheme.surfaceContainerLow;

    return Positioned(
      left: 0,
      right: 0,
      top: isTop ? 0 : null,
      bottom: isTop ? null : 0,
      child: IgnorePointer(
        child: Container(
          height: height,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: isTop ? Alignment.topCenter : Alignment.bottomCenter,
              end: isTop ? Alignment.bottomCenter : Alignment.topCenter,
              colors: [
                color,
                color.withValues(alpha: 0),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _RoleListHeader extends WatchingWidget {
  const _RoleListHeader();

  @override
  Widget build(BuildContext context) {
    return Column(
      spacing: 12,
      children: [
        Row(
          spacing: 12,
          children: [
            Expanded(
              child: Text(
                LocaleKeys.participants.tr(),
                style: context.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const _ReadySummaryChip(),
          ],
        ),
      ],
    );
  }
}

class _ReadySummaryChip extends WatchingWidget {
  const _ReadySummaryChip();

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final players =
        gameData?.players.where(
          (player) => player.role == PlayerRole.player && player.isActive,
        ) ??
        [];
    final playerCount = players.length;

    if (playerCount == 0) return const SizedBox.shrink();

    final readyCount = players
        .where(
          (player) =>
              gameData?.gameState.readyPlayers?.contains(player.meta.id) ??
              false,
        )
        .length;

    return _StatusChip(
      icon: Icons.check_circle_outline,
      color: readyCount == playerCount ? ExtraColors.of(context).success : null,
      text:
          '$readyCount/$playerCount ${LocaleKeys.game_lobby_editor_ready.tr()}',
    );
  }
}

class _RoleSectionDivider extends StatelessWidget {
  const _RoleSectionDivider();

  @override
  Widget build(BuildContext context) {
    final color = context.theme.colorScheme.outline.withValues(alpha: .32);

    return Divider(height: 22, thickness: 1, color: color);
  }
}

class _LobbyPanel extends StatelessWidget {
  const _LobbyPanel({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.theme.colorScheme.surfaceContainerLow,
        borderRadius: 8.circular,
        border: Border.all(
          color: context.theme.colorScheme.outlineVariant,
        ),
      ),
      child: child.paddingAll(16),
    );
  }
}

class _WaitingRoomHeader extends WatchingWidget {
  const _WaitingRoomHeader();

  static const _minimumInlineTitleWidth = 140.0;
  static const _titleActionGap = 12.0;

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final gameList = watchValue((GameLobbyController e) => e.gameListData);
    final title = gameData?.meta.title ?? gameList?.title;

    if (title == null) return const SizedBox.shrink();

    return LayoutBuilder(
      builder: (context, constraints) {
        final textScale = MediaQuery.textScalerOf(context).scale(1);
        final scaledMinimumTitleWidth = _minimumInlineTitleWidth * textScale;
        final inlineAction =
            constraints.maxWidth >=
            _CopyInviteLinkButton.minWidth +
                _titleActionGap +
                scaledMinimumTitleWidth;
        final titleWidget = Tooltip(
          message: title,
          child: Semantics(
            header: true,
            label: title,
            child: Text(
              title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: context.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        );
        const action = _CopyInviteLinkButton();

        if (inlineAction) {
          return Row(
            spacing: _titleActionGap,
            children: [
              Expanded(child: titleWidget),
              action,
            ],
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 12,
          children: [
            titleWidget,
            const Align(
              alignment: AlignmentDirectional.centerStart,
              child: action,
            ),
          ],
        );
      },
    );
  }
}

class _CopyInviteLinkButton extends StatefulWidget {
  const _CopyInviteLinkButton();

  static const minWidth = 168.0;

  @override
  State<_CopyInviteLinkButton> createState() => _CopyInviteLinkButtonState();
}

class _CopyInviteLinkButtonState extends State<_CopyInviteLinkButton> {
  static const _copiedDuration = Duration(seconds: 3);

  Timer? _resetTimer;
  bool _copied = false;

  @override
  void dispose() {
    _resetTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final label = _copied
        ? LocaleKeys.link_copied_short.tr()
        : LocaleKeys.copy_invite_link.tr();

    return Semantics(
      liveRegion: true,
      label: label,
      child: ConstrainedBox(
        constraints: const BoxConstraints(
          minWidth: _CopyInviteLinkButton.minWidth,
        ),
        child: FilledButton.tonalIcon(
          onPressed: _copyInviteLink,
          icon: Icon(_copied ? Icons.check : Icons.link),
          label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
        ),
      ),
    );
  }

  Future<void> _copyInviteLink() async {
    final copied = await copyGameInviteLinkToClipboard(
      context,
      gameId: getIt<GameLobbyController>().gameId,
    );
    if (!copied || !mounted) return;

    _resetTimer?.cancel();
    setState(() => _copied = true);
    _resetTimer = Timer(_copiedDuration, () {
      if (!mounted) return;
      setState(() => _copied = false);
    });
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.icon,
    required this.color,
    required this.text,
  });

  final IconData icon;
  final Color? color;
  final String text;

  @override
  Widget build(BuildContext context) {
    final backgroundAlpha = context.theme.brightness == Brightness.light
        ? .16
        : .12;
    final colorScheme = context.theme.colorScheme;
    final foreground = color ?? colorScheme.onSurfaceVariant;
    final background = color == null
        ? colorScheme.surfaceContainerHighest
        : color!.withValues(alpha: backgroundAlpha);
    final borderColor = color == null
        ? colorScheme.outlineVariant
        : color!.withValues(alpha: .34);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: 999.circular,
        border: Border.all(color: borderColor),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: 5,
        children: [
          Icon(icon, size: 14, color: foreground),
          Text(
            text,
            style: context.textTheme.labelSmall?.copyWith(
              color: foreground,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _LobbyPackageOverview extends WatchingStatefulWidget {
  const _LobbyPackageOverview({this.scrollable = false});

  final bool scrollable;

  @override
  State<_LobbyPackageOverview> createState() => _LobbyPackageOverviewState();
}

class _LobbyPackageOverviewState extends State<_LobbyPackageOverview> {
  int? _packageId;
  Future<OqPackage>? _packageFuture;
  OqPackage? _package;

  @override
  Widget build(BuildContext context) {
    final gameList = watchValue((GameLobbyController e) => e.gameListData);
    final packageId = gameList?.package.id;

    if (packageId == null) return const SizedBox.shrink();

    _syncPackage(packageId);

    return FutureBuilder<OqPackage>(
      future: _packageFuture,
      initialData: _package,
      builder: (context, snapshot) {
        final package = snapshot.data ?? _package;

        if (package != null) {
          _package = package;
          return _LobbyPanel(
            key: const Key('lobby_package_overview_panel'),
            child: widget.scrollable
                ? _FadingScrollView(
                    child: PackagePublicOverview(package: package),
                  )
                : PackagePublicOverview(package: package),
          );
        }

        if (snapshot.connectionState == ConnectionState.waiting) {
          return const SizedBox.shrink();
        }

        if (snapshot.hasError) {
          return _LobbyPanel(
            key: const Key('lobby_package_overview_panel'),
            child: Text(
              LocaleKeys.something_went_wrong.tr(),
              style: context.textTheme.bodyMedium?.copyWith(
                color: context.theme.colorScheme.error,
              ),
            ),
          );
        }

        return const SizedBox.shrink();
      },
    );
  }

  void _syncPackage(int packageId) {
    final packageController = getIt<PackageController>();

    if (_packageId == packageId) {
      _package ??= packageController.getCachedPackage(packageId);
      return;
    }

    _packageId = packageId;
    _package = packageController.getCachedPackage(packageId);
    _packageFuture = packageController.getPackage(packageId);
  }
}

class _RoleGroup extends WatchingWidget {
  const _RoleGroup(
    this.role, {
    required this.compactPlayers,
    this.showDisconnected = true,
    this.scrollablePlayers = false,
    this.maxUnboundedPlayersHeight,
    this.fixedPlayersHeight,
  });

  final PlayerRole role;
  final bool showDisconnected;
  final bool compactPlayers;
  final bool scrollablePlayers;
  final double? maxUnboundedPlayersHeight;
  final double? fixedPlayersHeight;

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final gameList = watchValue((GameLobbyController e) => e.gameListData);
    final gameStarted = gameData?.gameStarted ?? false;
    final groupPlayers =
        gameData?.players.where(_playerVisibleInGroup).sortedBy(_playerSlot) ??
        [];
    final joinOption = _joinOptionForRole(
      gameData: gameData,
      gameList: gameList,
      role: role,
    );

    final showmanDropTargetAvailable =
        role != PlayerRole.showman || groupPlayers.isEmpty;
    final targetKeepsPlayerAsPlayer =
        role == PlayerRole.player && gameData?.me.role == PlayerRole.player;
    final canShowDropTarget =
        gameStarted && showmanDropTargetAvailable && !targetKeepsPlayerAsPlayer;

    return DragTarget<PlayerData>(
      onAcceptWithDetails: (details) => _playerRoleChange(details.data, role),
      onWillAcceptWithDetails: (details) => _playerCanMoveToRole(
        gameData: gameData,
        gameList: gameList,
        playerData: details.data,
        role: role,
      ),
      builder: (context, candidateData, rejectedData) {
        final draggingOver = candidateData.isNotEmpty;

        return AnimatedContainer(
          duration: Durations.short2,
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          decoration: BoxDecoration(
            color: draggingOver
                ? context.theme.colorScheme.primary.withValues(alpha: .07)
                : Colors.transparent,
            borderRadius: 8.circular,
            border: Border.all(
              color: draggingOver
                  ? context.theme.colorScheme.primary.withValues(alpha: .45)
                  : Colors.transparent,
            ),
          ),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final boundedArea = constraints.hasBoundedHeight;
              final shouldScrollPlayers = boundedArea || scrollablePlayers;
              final playersWrap = _RolePlayersWrap(
                allowScrolling:
                    shouldScrollPlayers && role != PlayerRole.showman,
                twoColumn: compactPlayers && role != PlayerRole.showman,
                maxUnboundedHeight: maxUnboundedPlayersHeight,
                visibleRowsBeforeScroll:
                    compactPlayers && role == PlayerRole.spectator ? 2 : null,
                children: [
                  if (canShowDropTarget)
                    _PlayerDragTarget(
                      onChange: (data) => _playerRoleChange(data, role),
                      role: role,
                    ),
                  for (final player in groupPlayers)
                    compactPlayers
                        ? _WaitingPlayerChip(player)
                        : _Player(player),
                ],
              );
              final playersArea = fixedPlayersHeight == null
                  ? playersWrap
                  : SizedBox(height: fixedPlayersHeight, child: playersWrap);

              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 10,
                children: [
                  _RoleHeader(
                    role: role,
                    joinOption: gameStarted ? null : joinOption,
                  ),
                  if (fixedPlayersHeight != null)
                    playersArea
                  else if (boundedArea)
                    Expanded(child: playersArea)
                  else
                    playersArea,
                ],
              );
            },
          ),
        );
      },
    );
  }

  bool _playerVisibleInGroup(PlayerData player) {
    final playerInRole = player.role == role;
    final shouldShowByStatus = showDisconnected || player.isActive;

    return playerInRole && shouldShowByStatus;
  }

  int _playerSlot(PlayerData player) => player.slot ?? 0;

  void _playerRoleChange(
    PlayerData data,
    PlayerRole newRole,
  ) {
    getIt<GameLobbyEditorController>().playerRoleChange(
      newRole,
      data.meta.id,
    );
  }
}

class _WaitingPlayerChip extends WatchingWidget {
  const _WaitingPlayerChip(this.player);

  final PlayerData player;

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final canChange = _playerAvailableToChange(gameData, player);
    final isMe = _isCurrentPlayer(gameData, player);
    final canEdit = canChange && !isMe;
    final showReady = player.role == PlayerRole.player;
    final ready = showReady && _playerReady(gameData, player);

    Widget pill({bool feedback = false}) => _WaitingPlayerPill(
      player: player,
      canChange: canChange,
      feedback: feedback,
      isMe: isMe,
      ready: ready,
      showReady: showReady,
      onTap: !feedback && canEdit
          ? () => PlayerEditBtn.showEditMenu(context: context, player: player)
          : null,
    );

    if (!canChange) return pill();

    return Draggable<PlayerData>(
      data: player,
      feedback: RepaintBoundary(
        child: SizedBox(
          width: _RolePlayersWrapContent._maxNaturalTileWidth,
          child: Material(
            type: MaterialType.transparency,
            child: pill(feedback: true),
          ),
        ),
      ),
      childWhenDragging: Opacity(opacity: .45, child: pill()),
      child: MouseRegion(
        cursor: SystemMouseCursors.grab,
        child: pill(),
      ),
    );
  }
}

bool _isCurrentPlayer(
  SocketIoGameJoinEventPayload? gameData,
  PlayerData player,
) {
  return gameData?.me.meta.id == player.meta.id;
}

bool _playerReady(
  SocketIoGameJoinEventPayload? gameData,
  PlayerData player,
) {
  return gameData?.gameState.readyPlayers?.contains(player.meta.id) ?? false;
}

class _WaitingPlayerPill extends StatelessWidget {
  const _WaitingPlayerPill({
    required this.player,
    required this.canChange,
    required this.feedback,
    required this.isMe,
    required this.ready,
    required this.showReady,
    required this.onTap,
  });

  final PlayerData player;
  final bool canChange;
  final bool feedback;
  final bool isMe;
  final bool ready;
  final bool showReady;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final username = player.meta.username;
    final initial = username.characters.isEmpty
        ? '?'
        : username.characters.first.toUpperCase();
    final colorScheme = context.theme.colorScheme;
    final successColor = ExtraColors.of(context).success;
    final borderRadius = 8.circular;
    final borderColor = isMe
        ? colorScheme.primary
        : ready
        ? successColor.withValues(alpha: .65)
        : colorScheme.outline.withValues(alpha: .24);

    return Tooltip(
      message: username,
      child: Semantics(
        label: username,
        selected: isMe,
        child: Material(
          color: feedback
              ? colorScheme.surfaceContainerHighest
              : isMe
              ? colorScheme.primary.withValues(alpha: .08)
              : colorScheme.surfaceContainer,
          borderRadius: borderRadius,
          child: InkWell(
            borderRadius: borderRadius,
            onTap: onTap,
            onSecondaryTap: onTap,
            child: Container(
              constraints: const BoxConstraints(minHeight: 50),
              padding: const EdgeInsetsDirectional.only(
                start: 9,
                top: 7,
                end: 6,
                bottom: 7,
              ),
              decoration: BoxDecoration(
                borderRadius: borderRadius,
                border: Border.all(
                  color: borderColor,
                  width: isMe ? 1.5 : 1,
                ),
              ),
              child: Row(
                spacing: 6,
                children: [
                  ImageWidget(
                    url: player.meta.avatar,
                    avatarRadius: 18,
                    placeholder: Text(
                      initial,
                      style: context.textTheme.labelLarge?.copyWith(
                        color: colorScheme.onPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      spacing: 2,
                      children: [
                        Text(
                          username,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: context.textTheme.bodyMedium?.copyWith(
                            fontWeight: isMe ? FontWeight.w700 : null,
                          ),
                        ),
                        if (showReady)
                          _InlineReadyStatus(ready: ready)
                        else if (player.isShowman)
                          _InlineRoleStatus(text: LocaleKeys.showman.tr()),
                      ],
                    ),
                  ),
                  if (canChange)
                    Tooltip(
                      message: LocaleKeys.drag_to_change_role.tr(),
                      child: Semantics(
                        label: LocaleKeys.drag_to_change_role.tr(),
                        child: SizedBox.square(
                          dimension: 40,
                          child: Icon(
                            Icons.drag_indicator,
                            size: 18,
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _InlineReadyStatus extends StatelessWidget {
  const _InlineReadyStatus({required this.ready});

  final bool ready;

  @override
  Widget build(BuildContext context) {
    final color = ready
        ? ExtraColors.of(context).success
        : context.theme.colorScheme.onSurfaceVariant;

    return Row(
      mainAxisSize: MainAxisSize.min,
      spacing: 4,
      children: [
        Icon(
          ready ? Icons.check_circle : Icons.radio_button_unchecked,
          size: 12,
          color: color,
        ),
        Text(
          ready
              ? LocaleKeys.game_lobby_editor_ready.tr()
              : LocaleKeys.game_lobby_editor_not_ready.tr(),
          maxLines: 1,
          style: context.textTheme.labelSmall?.copyWith(color: color),
        ),
      ],
    );
  }
}

class _InlineRoleStatus extends StatelessWidget {
  const _InlineRoleStatus({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: context.textTheme.labelSmall?.copyWith(
        color: context.theme.colorScheme.onSurfaceVariant,
      ),
    );
  }
}

class _RoleHeader extends StatelessWidget {
  const _RoleHeader({required this.role, required this.joinOption});

  final PlayerRole role;
  final JoinRoleOption? joinOption;

  @override
  Widget build(BuildContext context) {
    final button = joinOption == null
        ? null
        : _RoleJoinButton(role: joinOption!.role);

    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 8,
      runSpacing: 8,
      children: [
        _RoleTitle(role),
        ?button,
      ],
    );
  }
}

class _RoleJoinButton extends WatchingWidget {
  const _RoleJoinButton({required this.role});

  final PlayerRole role;

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final labelPrefix = gameData?.me.role == PlayerRole.$unknown
        ? LocaleKeys.join_as.tr()
        : LocaleKeys.switch_to.tr();

    return OutlinedButton.icon(
      onPressed: gameData == null ? null : () => _changeRole(gameData.me),
      style: const ButtonStyle(
        minimumSize: WidgetStatePropertyAll(Size(0, 36)),
        padding: WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        ),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        visualDensity: VisualDensity.compact,
      ),
      icon: Icon(_roleIcon(role), size: 18),
      label: Text(
        '$labelPrefix ${_roleLabel(role)}',
        overflow: TextOverflow.ellipsis,
      ),
    );
  }

  void _changeRole(PlayerData player) {
    getIt<GameLobbyEditorController>().playerRoleChange(role, player.meta.id);
  }
}

class _Player extends WatchingWidget {
  const _Player(this.player);
  final PlayerData player;

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final playerAvailableToChange = _playerAvailableToChange(gameData, player);
    final playerBoxConstraints = BoxConstraints.expand(
      width: GameLobbyStyles.playersInEditor.width,
      height: GameLobbyStyles.playersInEditor.height,
    );

    Widget child() {
      return GameLobbyPlayer(
        player: player,
        settings: const PlayerTileSettings.empty(),
        constraints: playerBoxConstraints,
        playerTextStyle: GameLobbyStyles.playerTextStyleDesktop(context),
        actionButton:
            playerAvailableToChange && gameData?.me.meta.id != player.meta.id
            ? PlayerEditBtn(player: player)
            : null,
        customIcon: playerAvailableToChange
            ? Tooltip(
                message: LocaleKeys.drag_to_change_role.tr(),
                child: Semantics(
                  label: LocaleKeys.drag_to_change_role.tr(),
                  child: const Icon(Icons.drag_handle, size: 28),
                ),
              )
            : null,
      );
    }

    if (!playerAvailableToChange) return child();

    return Draggable<PlayerData>(
      data: player,
      feedback: _PlayerDragFeedback(player: player),
      childWhenDragging: Opacity(
        opacity: .45,
        child: child(),
      ),
      child: MouseRegion(
        cursor: SystemMouseCursors.grab,
        child: child(),
      ),
    );
  }
}

class _PlayerDragFeedback extends StatelessWidget {
  const _PlayerDragFeedback({required this.player});

  final PlayerData player;

  @override
  Widget build(BuildContext context) {
    final colorScheme = context.theme.colorScheme;
    final foreground = colorScheme.onSurface;
    final username = player.meta.username;
    final initial = username.characters.isEmpty
        ? '?'
        : username.characters.first.toUpperCase();

    final subtitle = switch (player.role) {
      PlayerRole.showman => LocaleKeys.showman.tr(),
      PlayerRole.player => player.score.toString(),
      PlayerRole.spectator => LocaleKeys.spectator.tr(),
      PlayerRole.$unknown => '',
    };

    return RepaintBoundary(
      child: Material(
        color: Colors.transparent,
        child: SizedBox.fromSize(
          size: GameLobbyStyles.playersInEditor,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: colorScheme.surfaceContainerHighest,
              borderRadius: GameLobbyStyles.playerTileRadius.circular,
              border: Border.all(
                color: colorScheme.primary.withValues(alpha: .45),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: .18),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              spacing: 10,
              children: [
                CircleAvatar(
                  radius: 18,
                  backgroundColor: colorScheme.primary,
                  foregroundColor: colorScheme.onPrimary,
                  child: Text(initial),
                ),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 2,
                    children: [
                      Text(
                        username,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: context.textTheme.bodyMedium?.copyWith(
                          color: foreground,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (subtitle.isNotEmpty)
                        Text(
                          subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: context.textTheme.labelSmall?.copyWith(
                            color: colorScheme.onSurfaceVariant,
                          ),
                        ),
                    ],
                  ),
                ),
                Icon(
                  Icons.drag_handle,
                  color: colorScheme.onSurfaceVariant,
                ),
              ],
            ).paddingAll(12),
          ),
        ),
      ),
    );
  }
}

class _PlayerDragTarget extends WatchingWidget {
  const _PlayerDragTarget({
    required this.role,
    required this.onChange,
  });
  final PlayerRole role;
  final void Function(PlayerData data) onChange;

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final gameList = watchValue((GameLobbyController e) => e.gameListData);

    final toDoText = _setAsRoleText(role);

    final playerBoxConstraints = BoxConstraints.expand(
      width: GameLobbyStyles.playersInEditor.width,
      height: GameLobbyStyles.playersInEditor.height,
    );

    return ConstrainedBox(
      constraints: playerBoxConstraints,
      child: DragTarget<PlayerData>(
        onAcceptWithDetails: (details) => onChange(details.data),
        onWillAcceptWithDetails: (details) => _playerCanMoveToRole(
          gameData: gameData,
          gameList: gameList,
          playerData: details.data,
          role: role,
        ),
        builder: (context, candidateData, rejectedData) {
          final dragging = candidateData.isNotEmpty;
          final myRole = role == gameData?.me.role;

          return InkWell(
            borderRadius: GameLobbyStyles.playerTileRadius.circular,
            onTap: myRole ? null : () => onChange(gameData!.me),
            child: DottedBorderWidget(
              radius: GameLobbyStyles.playerTileRadius,
              color: context.theme.colorScheme.onSurface,
              padding: 8.all,
              gap: dragging ? 0 : 5,
              child: Text(
                dragging
                    ? LocaleKeys.release_to.tr(args: [toDoText])
                    : LocaleKeys.drag_or_tap_to.tr(args: [toDoText]),
                textAlign: TextAlign.center,
                style: context.textTheme.labelSmall,
              ).center(),
            ),
          );
        },
      ),
    );
  }
}

bool _playerAvailableToChange(
  SocketIoGameJoinEventPayload? gameData,
  PlayerData playerData,
) {
  final me = gameData?.me;
  if (me.isShowman) return true;
  if (playerData.meta.id == me?.meta.id) return true;
  return false;
}

bool _playerCanMoveToRole({
  required SocketIoGameJoinEventPayload? gameData,
  required GameListItem? gameList,
  required PlayerData playerData,
  required PlayerRole role,
}) {
  final playerAlreadyInRole = role == playerData.role;
  if (playerAlreadyInRole) return false;

  if (!_playerAvailableToChange(gameData, playerData)) return false;

  if (role == PlayerRole.showman) {
    return !_hasAnotherActiveShowman(gameData, playerData.meta.id);
  }

  final movingIntoPlayerRole = role == PlayerRole.player;
  final movingFromAnotherRole = playerData.role != PlayerRole.player;
  if (movingIntoPlayerRole && movingFromAnotherRole) {
    return !_playerSeatsFull(gameData, gameList);
  }

  return true;
}

class _RolePlayersWrap extends StatelessWidget {
  const _RolePlayersWrap({
    required this.children,
    required this.allowScrolling,
    required this.twoColumn,
    this.maxUnboundedHeight,
    this.visibleRowsBeforeScroll,
  });

  final List<Widget> children;
  final bool allowScrolling;
  final bool twoColumn;
  final double? maxUnboundedHeight;
  final int? visibleRowsBeforeScroll;

  @override
  Widget build(BuildContext context) {
    final content = _RolePlayersWrapContent(
      twoColumn: twoColumn,
      children: children,
    );
    if (!allowScrolling || children.length <= 1) return content;

    return LayoutBuilder(
      builder: (context, constraints) {
        if (!_contentExceedsVisibleRows(constraints)) return content;

        final scrollView = _FadingScrollView(
          bottomPadding: 8,
          child: content,
        );

        if (constraints.hasBoundedHeight) return scrollView;

        return ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxUnboundedHeight ?? 220),
          child: scrollView,
        );
      },
    );
  }

  bool _contentExceedsVisibleRows(BoxConstraints constraints) {
    final columns = _columnCount(constraints);
    final visibleRows = visibleRowsBeforeScroll;

    if (visibleRows != null) return children.length > columns * visibleRows;

    return children.length > columns;
  }

  int _columnCount(BoxConstraints constraints) {
    if (!twoColumn || !constraints.hasBoundedWidth) return 1;
    final canUseTwoColumns =
        constraints.maxWidth >=
        (_RolePlayersWrapContent._minTwoColumnTileWidth * 2) +
            _RolePlayersWrapContent._spacing;
    return canUseTwoColumns ? 2 : 1;
  }
}

class _RolePlayersWrapContent extends StatelessWidget {
  const _RolePlayersWrapContent({
    required this.children,
    required this.twoColumn,
  });

  final List<Widget> children;
  final bool twoColumn;

  static const _spacing = 8.0;
  static const _maxNaturalTileWidth = 260.0;
  static const _minTwoColumnTileWidth = 280.0;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final availableWidth = constraints.maxWidth;
        final canUseTwoColumns =
            twoColumn &&
            constraints.hasBoundedWidth &&
            availableWidth >= (_minTwoColumnTileWidth * 2) + _spacing;
        final tileWidth = canUseTwoColumns
            ? (availableWidth - _spacing) / 2
            : null;

        return Wrap(
          spacing: _spacing,
          runSpacing: _spacing,
          children: [
            for (final child in children)
              if (tileWidth == null)
                SizedBox(
                  width: constraints.hasBoundedWidth
                      ? availableWidth
                      : _maxNaturalTileWidth,
                  child: child,
                )
              else
                SizedBox(width: tileWidth, child: child),
          ],
        );
      },
    );
  }
}

class _RoleTitle extends WatchingWidget {
  const _RoleTitle(this.role);
  final PlayerRole role;

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final gameList = watchValue((GameLobbyController e) => e.gameListData);

    final roleName = switch (role) {
      PlayerRole.showman => LocaleKeys.showman.tr(),
      PlayerRole.player => LocaleKeys.players.tr(),
      PlayerRole.spectator => LocaleKeys.spectators.tr(),
      PlayerRole.$unknown => '',
    };

    int getPlayerCount() {
      return gameData?.players
              .where((e) => e.role == role && e.isActive)
              .length ??
          0;
    }

    final count = switch (role) {
      PlayerRole.player =>
        '(${getPlayerCount()} / ${gameList?.maxPlayers ?? ''})',
      PlayerRole.spectator => '(${getPlayerCount()})',
      _ => null,
    };

    return Text(
      [roleName, count].nonNulls.join(' '),
      style: context.textTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

JoinRoleOption? _joinOptionForRole({
  required SocketIoGameJoinEventPayload? gameData,
  required GameListItem? gameList,
  required PlayerRole role,
}) {
  final me = gameData?.me;
  if (me == null) return null;

  final options = buildJoinRoleSwitchOptions(
    currentRole: me.role,
    showmanTaken: _showmanTaken(gameData),
    playerSeatsFull: _playerSeatsFull(gameData, gameList),
  );

  return options.firstWhereOrNull((option) => option.role == role);
}

bool _showmanTaken(SocketIoGameJoinEventPayload? gameData) {
  final meId = gameData?.me.meta.id;

  return _hasAnotherActiveShowman(gameData, meId);
}

bool _hasAnotherActiveShowman(
  SocketIoGameJoinEventPayload? gameData,
  int? currentPlayerId,
) {
  return gameData?.players.any(
        (player) {
          final belongsToAnotherPlayer = player.meta.id != currentPlayerId;
          final isShowman = player.role == PlayerRole.showman;
          final isConnected = player.status != PlayerDataStatus.disconnected;

          return belongsToAnotherPlayer && isShowman && isConnected;
        },
      ) ??
      false;
}

bool _playerSeatsFull(
  SocketIoGameJoinEventPayload? gameData,
  GameListItem? gameList,
) {
  if (gameData == null || gameList == null) return false;
  if (gameData.me.role == PlayerRole.player) return false;

  final connectedPlayerCount = gameData.players.where(
    (player) {
      final isPlayer = player.role == PlayerRole.player;
      final isConnected = player.status != PlayerDataStatus.disconnected;

      return isPlayer && isConnected;
    },
  ).length;

  return connectedPlayerCount >= gameList.maxPlayers;
}

String _roleLabel(PlayerRole role) {
  return switch (role) {
    PlayerRole.showman => LocaleKeys.showman.tr(),
    PlayerRole.player => LocaleKeys.player.tr(),
    PlayerRole.spectator => LocaleKeys.spectator.tr(),
    PlayerRole.$unknown => '',
  };
}

String _setAsRoleText(PlayerRole role) {
  return switch (role) {
    PlayerRole.showman => LocaleKeys.game_lobby_editor_set_as_showman.tr(),
    PlayerRole.player => LocaleKeys.game_lobby_editor_set_as_player.tr(),
    PlayerRole.spectator => LocaleKeys.game_lobby_editor_set_as_spectator.tr(),
    PlayerRole.$unknown => '',
  };
}

IconData _roleIcon(PlayerRole role) {
  return switch (role) {
    PlayerRole.showman => Icons.record_voice_over_outlined,
    PlayerRole.player => Icons.person_outline,
    PlayerRole.spectator => Icons.visibility_outlined,
    PlayerRole.$unknown => Icons.help_outline,
  };
}

class _ClosePlayerEditButton extends WatchingWidget {
  const _ClosePlayerEditButton();

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final gameStarted = gameData?.gameStarted ?? false;

    if (!gameStarted) return const SizedBox();

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        FilledButton.tonal(
          style: const ButtonStyle(
            minimumSize: WidgetStatePropertyAll(Size(60, 50)),
          ),
          onPressed: () {
            final controller = getIt<GameLobbyController>();
            controller.lobbyEditorMode.value = false;
          },
          child: Text(LocaleKeys.game_lobby_editor_close_player_editor.tr()),
        ),
      ],
    );
  }
}
