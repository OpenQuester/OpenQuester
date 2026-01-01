import 'dart:async';
import 'dart:ui';

import 'package:animate_do/animate_do.dart';
import 'package:flutter/material.dart';
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
    final chatWideModeOn = GameLobbyStyles.desktopChat(context);
    final showDesktopChat = chatWideModeOn && showChat;
    final settings = watchPropertyValue<SettingsController, AppSettings>(
      (e) => e.settings,
    );

    callOnce((context) {
      // Set init value for showing chat to [false] for mobile
      if (chatWideModeOn) {
        getIt<GameLobbyController>().showChat.value = true;
      }
    });

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        await _onExit();
      },
      child: ColoredBox(
        color: context.theme.colorScheme.surface,
        child: MaxSizeContainer(
          enabled: settings.limitDesktopWidth,
          maxWidth: UiModeUtils.extraLarge,
          child: Scaffold(
            extendBody: true,
            appBar: AppBar(
              title: const GameLobbyTitle(),
              leading: IconButton(
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
            floatingActionButton: const LobbyActionButton(),
            floatingActionButtonLocation:
                FloatingActionButtonLocation.centerFloat,
            body: SafeArea(
              bottom: false,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _BodyLayoutBuilder().expand(),
                      AppAnimatedSwitcher(
                        visible: showDesktopChat,
                        child: const _Chat()
                            .withWidth(GameLobbyStyles.desktopChatWidth)
                            .paddingBottom(16),
                      ),
                    ],
                  ),
                  AppAnimatedSwitcher(
                    visible: !chatWideModeOn && showChat,
                    disableSizeTransition: true,
                    child: const _Chat().paddingAll(16),
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

class _BodyBuilder extends WatchingWidget {
  const _BodyBuilder();

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    final isPickingPlayer = watchPropertyValue(
      (GameLobbyPlayerPickerController e) => e.isPicking,
    );
    final isBidding = watchPropertyValue(
      (GameLobbyPlayerStakesController e) => e.isBidding,
    );
    final lobbyEditorMode = watchValue(
      (GameLobbyController e) => e.lobbyEditorMode,
    );
    final currentQuestion = watchValue(
      (GameQuestionController e) => e.questionData,
    );
    final isPickingTheme = watchPropertyValue(
      (GameLobbyThemePickerController e) => e.isPicking,
    );
    final gameFinished = watchValue((GameLobbyController e) => e.gameFinished);

    Widget body;
    if (lobbyEditorMode) {
      body = const GameLobbyEditor().fadeIn();
    } else if (isBidding) {
      body = const GameStakeQuestionBody();
    } else if (isPickingTheme) {
      body = const GameFinalRoundBody();
    } else if (isPickingPlayer) {
      body = const GameLobbyPlayerPicker();
    } else if (gameData?.gameState.currentRound == null) {
      body = const CircularProgressIndicator().fadeIn().center();
    } else if (gameFinished) {
      body = const _GameFinishedScreen().fadeIn();
    } else if (gameData?.gameState.stakeQuestionData?.biddingPhase ?? false) {
      body = const GameStakeQuestionBody().fadeIn();
    } else if (currentQuestion != null) {
      body = const GameQuestionScreen().fadeIn();
    } else {
      body = const GameLobbyThemes().fadeIn();
    }

    return Column(
      children: [
        if (gameData?.me.isSpectator ?? false)
          Text(
            LocaleKeys.you_are_spectator.tr(),
            style: context.textTheme.bodySmall?.copyWith(
              color: context.theme.colorScheme.onSurfaceVariant,
            ),
          ).paddingAll(8),
        body.expand(),
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

class _GameFinishedScreen extends StatelessWidget {
  const _GameFinishedScreen();

  @override
  Widget build(BuildContext context) {
    return Text(
      LocaleKeys.game_is_finished.tr(),
      style: context.textTheme.displaySmall,
      textAlign: TextAlign.center,
    ).paddingAll(16).center();
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
    final body = const _BodyBuilder().expand();

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
    return IconButton(
      onPressed: getIt<GameLobbyController>().toggleDesktopChat,
      icon: Icon(show ? Icons.chat_bubble_outline : Icons.chat),
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
