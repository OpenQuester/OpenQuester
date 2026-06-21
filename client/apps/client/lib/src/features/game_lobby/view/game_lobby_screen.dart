import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:openquester/common_imports.dart';

@RoutePage()
class GameLobbyScreen extends WatchingStatefulWidget {
  const GameLobbyScreen({@PathParam() required this.gameId, super.key});
  final String gameId;

  @override
  State<GameLobbyScreen> createState() => _GameLobbyScreenState();
}

class _GameLobbyScreenState extends State<GameLobbyScreen> {
  @override
  void initState() {
    super.initState();
    unawaited(getIt<GameLobbyController>().join(gameId: widget.gameId));
  }

  @override
  void deactivate() {
    unawaited(getIt<GameLobbyController>().leave());
    super.deactivate();
  }

  Future<void> _onExit() async {
    final exit = await ConfirmDialog(
      title: LocaleKeys.leave_game_confirmation.tr(),
    ).show(context);
    if (exit && mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final showChat = watchValue((GameLobbyController e) => e.showChat);
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final lobbyEditorMode = watchValue(
      (GameLobbyController e) => e.lobbyEditorMode,
    );
    final gameStarted = gameData?.gameStarted ?? false;
    final pregameLobbyVisible = gameData != null && !gameStarted;
    final showLobbyActionButton = shouldShowLobbyActionButton(gameData);
    final showAppBarTitle = !(lobbyEditorMode && !gameStarted);
    final settings = watchPropertyValue<SettingsController, AppSettings>(
      (e) => e.settings,
    );

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final controller = getIt<GameLobbyController>();
        if (controller.showChat.value) {
          controller.showChat.value = false;
          return;
        }
        await _onExit();
      },
      child: ColoredBox(
        color: context.theme.colorScheme.surface,
        child: MaxSizeContainer(
          enabled: settings.limitDesktopWidth,
          maxWidth: UiModeUtils.extraLarge,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final layout = LobbyLayoutResolver.resolve(
                availableWidth: constraints.maxWidth,
                chatOpen: showChat,
              );
              final showBottomActionArea = shouldShowLobbyBottomActionArea(
                pregameLobbyVisible: pregameLobbyVisible,
                showLobbyActionButton: showLobbyActionButton,
                layout: layout,
              );

              return LobbyLayoutScope(
                layout: layout,
                child: Scaffold(
                  appBar: AppBar(
                    title: showAppBarTitle ? const GameLobbyTitle() : null,
                    leading: IconButton(
                      tooltip: LocaleKeys.leave_game.tr(),
                      onPressed: _onExit,
                      icon: const Icon(Icons.exit_to_app),
                    ),
                    actions: [
                      const GameLobbyMenu(),
                      _ChatButton(show: showChat),
                    ],
                    elevation: 0,
                    scrolledUnderElevation: 0,
                    notificationPredicate: (_) => false,
                  ),
                  bottomNavigationBar: showBottomActionArea
                      ? _DimmedLobbyBottomAction(
                          dimmed: shouldDimLobbyBottomActionArea(layout),
                          child: const LobbyActionButton(),
                        )
                      : null,
                  body: SafeArea(
                    bottom: false,
                    child: _LobbyBodyShell(
                      layout: layout,
                      showChat: showChat,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _LobbyBodyShell extends StatelessWidget {
  const _LobbyBodyShell({
    required this.layout,
    required this.showChat,
  });

  final LobbyLayout layout;
  final bool showChat;

  @override
  Widget build(BuildContext context) {
    final showPersistentChat =
        showChat && layout.chatPresentation == LobbyChatPresentation.persistent;
    final showOverlayChat =
        showChat && layout.chatPresentation == LobbyChatPresentation.overlay;

    return Stack(
      fit: StackFit.expand,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const _BodyLayoutBuilder().expand(),
            AppAnimatedSwitcher(
              visible: showPersistentChat,
              child: SizedBox(
                width: layout.reservedChatWidth,
                child: const _Chat().paddingBottom(16),
              ),
            ),
          ],
        ),
        AppAnimatedSwitcher(
          visible: showOverlayChat,
          disableSizeTransition: true,
          child: _ChatOverlay(
            maxWidth: layout.availableWidth >= _sideOverlayChatMinWidth
                ? 420
                : double.infinity,
          ),
        ),
      ],
    );
  }
}

const double _sideOverlayChatMinWidth = 700;

bool shouldShowLobbyBottomActionArea({
  required bool pregameLobbyVisible,
  required bool showLobbyActionButton,
  required LobbyLayout layout,
}) {
  final fullWidthOverlayChat =
      layout.usesOverlayChat &&
      layout.availableWidth < _sideOverlayChatMinWidth;

  return pregameLobbyVisible && showLobbyActionButton && !fullWidthOverlayChat;
}

bool shouldDimLobbyBottomActionArea(LobbyLayout layout) {
  return layout.usesOverlayChat &&
      layout.availableWidth >= _sideOverlayChatMinWidth;
}

class _DimmedLobbyBottomAction extends StatelessWidget {
  const _DimmedLobbyBottomAction({
    required this.dimmed,
    required this.child,
  });

  final bool dimmed;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!dimmed) return child;

    return Stack(
      children: [
        child,
        Positioned.fill(
          child: IgnorePointer(
            child: ColoredBox(
              color: context.theme.colorScheme.scrim.withValues(alpha: .28),
            ),
          ),
        ),
      ],
    );
  }
}

class _BodyBuilder extends WatchingWidget {
  const _BodyBuilder({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final lobbyEditorMode = watchValue(
      (GameLobbyController e) => e.lobbyEditorMode,
    );
    final showSpectatorStatus =
        !lobbyEditorMode && (gameData?.me.isSpectator ?? false);

    return Column(
      children: [
        if (!lobbyEditorMode)
          SizedBox(
            height: 32,
            child: Center(
              child: AnimatedOpacity(
                opacity: showSpectatorStatus ? 1 : 0,
                duration: Durations.short2,
                child: Text(
                  LocaleKeys.you_are_spectator.tr(),
                  style: context.textTheme.bodySmall?.copyWith(
                    color: context.theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
            ),
          ),
        GameStateBuilder(
          builder: (state) {
            Widget body;
            switch (state) {
              case GameLobbyState.editorMode:
                body = const GameLobbyEditor();
              case GameLobbyState.reviewingFinalAnswers:
                body = const GameFinalReviewBody();
              case GameLobbyState.answeringFinal:
                body = const GameFinalAnswerBody();
              case GameLobbyState.bidding:
              case GameLobbyState.biddingPhaseFromState:
                body = const GameStakeQuestionBody();
              case GameLobbyState.pickingTheme:
                body = const GameFinalRoundBody();
              case GameLobbyState.pickingPlayer:
                body = const GameLobbyPlayerPicker();
              case GameLobbyState.loading:
                body = const CircularProgressIndicator().center();
              case GameLobbyState.finished:
                body = const GameFinishedScreen();
              case GameLobbyState.questionActive:
                body = const GameQuestionScreen();
              case GameLobbyState.showingThemes:
                body = const GameLobbyThemes();
            }
            return body.fadeIn(key: Key(body.runtimeType.toString()));
          },
        ).expand(),
      ],
    );
  }
}

class _GamePausedScreen extends WatchingWidget {
  const _GamePausedScreen();

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final imShowman = gameData?.me.isShowman ?? false;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.pause, size: 54),
        Text(
          LocaleKeys.game_is_paused.tr(),
          style: context.textTheme.displaySmall,
          textAlign: TextAlign.center,
        ),
        if (imShowman)
          TextButton(
            onPressed: () =>
                getIt<GameLobbyController>().setPause(pauseState: false),
            style: ButtonStyle(
              foregroundColor: WidgetStatePropertyAll(
                context.theme.colorScheme.onSurface,
              ),
            ),
            child: Text(LocaleKeys.resume_game.tr()),
          ).paddingTop(16),
      ],
    ).paddingAll(16).paddingBottom(32).center();
  }
}

class _BodyLayoutBuilder extends WatchingWidget {
  const _BodyLayoutBuilder();

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final playersOnLeft = GameLobbyStyles.playersOnLeft(context);
    final lobbyEditorMode = watchValue(
      (GameLobbyController e) => e.lobbyEditorMode,
    );

    Widget playersList({required Axis axis}) {
      if (lobbyEditorMode) {
        return GameLobbyEditorPlayers(axis: axis);
      }
      return GameLobbyPlayers(axis: axis);
    }

    Widget child;
    final body = const _BodyBuilder(key: Key('GameBody')).expand();

    if (playersOnLeft) {
      child = Row(
        spacing: 8,
        children: [
          if (!lobbyEditorMode)
            playersList(axis: Axis.vertical)
                .withWidth(GameLobbyStyles.players.width)
                .paddingSymmetric(horizontal: 8)
                .paddingTop(16)
                .paddingLeft(16),
          body,
        ],
      );
    } else {
      child = Column(
        children: [
          if (!lobbyEditorMode)
            playersList(
              axis: Axis.horizontal,
            ).withHeight(GameLobbyStyles.playersMobile.height),
          const Divider(height: 0, thickness: .4).paddingTop(8),
          body,
        ],
      );
    }

    final isPaused = gameData?.gameState.isPaused ?? false;
    if (isPaused && !lobbyEditorMode) {
      child = Stack(
        alignment: Alignment.center,
        children: [
          // disables mouse/touch events
          IgnorePointer(
            child: Container(
              foregroundDecoration: BoxDecoration(
                color: Colors.black.withValues(alpha: .4),
              ),
              child: child,
            ),
          ),
          BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 4, sigmaY: 4),
            child: const _GamePausedScreen(),
          ).fadeIn(),
        ],
      );
    }

    return child;
  }
}

class _ChatButton extends StatelessWidget {
  const _ChatButton({required this.show});
  final bool show;

  @override
  Widget build(BuildContext context) {
    final tooltip = show
        ? LocaleKeys.close_chat.tr()
        : LocaleKeys.open_chat.tr();
    final icon = Icon(show ? Icons.chat_bubble : Icons.chat_bubble_outline);
    final onPressed = getIt<GameLobbyController>().toggleDesktopChat;

    if (show) {
      return IconButton.filledTonal(
        tooltip: tooltip,
        onPressed: onPressed,
        icon: icon,
      );
    }

    return IconButton(
      tooltip: tooltip,
      onPressed: onPressed,
      icon: icon,
    );
  }
}

class _Chat extends StatelessWidget {
  const _Chat();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Card(
        clipBehavior: Clip.antiAlias,
        color: context.theme.colorScheme.surfaceContainer,
        child: const ChatScreen(),
      ),
    );
  }
}

class _ChatOverlay extends StatelessWidget {
  const _ChatOverlay({required this.maxWidth});

  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return CallbackShortcuts(
      bindings: <ShortcutActivator, VoidCallback>{
        const SingleActivator(LogicalKeyboardKey.escape): _closeChat,
      },
      child: Focus(
        autofocus: true,
        child: ColoredBox(
          color: context.theme.colorScheme.scrim.withValues(alpha: .28),
          child: Align(
            alignment: AlignmentDirectional.centerEnd,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxWidth),
              child: const _Chat().paddingAll(16),
            ),
          ),
        ),
      ),
    );
  }

  void _closeChat() {
    getIt<GameLobbyController>().showChat.value = false;
  }
}
