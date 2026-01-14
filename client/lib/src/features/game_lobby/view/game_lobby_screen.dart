import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

@RoutePage()
class GameLobbyScreen extends WatchingStatefulWidget {
  const GameLobbyScreen({
    @PathParam() required this.gameId,
    @QueryParam() this.password,
    super.key,
  });
  final String gameId;
  final String? password;

  @override
  State<GameLobbyScreen> createState() => _GameLobbyScreenState();
}

class _GameLobbyScreenState extends State<GameLobbyScreen> {
  @override
  void initState() {
    super.initState();
    unawaited(_joinGame());
  }

  Future<void> _joinGame() async {
    try {
      final controller = getIt<GameLobbyController>();
      
      // Get game info first to check if private
      final gameInfo = await Api.I.api.games.getV1GamesGameId(
        gameId: widget.gameId,
      );

      var password = widget.password;

      // If game is private and no password provided, prompt for it
      if (gameInfo.isPrivate && password == null && mounted) {
        password = await showDialog<String>(
          context: context,
          barrierDismissible: false,
          builder: (_) => PasswordPromptDialog(gameTitle: gameInfo.title),
        );

        if (password == null) {
          if (mounted) Navigator.of(context).pop();
          return;
        }
      }

      // First attempt to join
      final success = await controller.join(
        gameId: widget.gameId,
        password: password,
      );

      // If failed and game is private, check if it's a password error
      if (!success && gameInfo.isPrivate && mounted) {
        final lastError = controller.lastError?.toLowerCase() ?? '';
        final isPasswordError = lastError.contains('password') || 
                                lastError.contains('incorrect');

        // Only retry if error is password-related
        if (isPasswordError) {
          await getIt<ToastController>().show(
            LocaleKeys.incorrect_password.tr(),
          );

          // Prompt for new password
          password = await showDialog<String>(
            context: context,
            barrierDismissible: false,
            builder: (_) => PasswordPromptDialog(gameTitle: gameInfo.title),
          );

          if (password == null) {
            if (mounted) Navigator.of(context).pop();
            return;
          }

          // Retry with new password
          final retrySuccess = await controller.join(
            gameId: widget.gameId,
            password: password,
          );

          if (!retrySuccess && mounted) {
            Navigator.of(context).pop();
          }
        } else {
          // For non-password errors, just exit
          if (mounted) Navigator.of(context).pop();
        }
      } else if (!success && mounted) {
        Navigator.of(context).pop();
      }
    } catch (e) {
      logger.e('Error joining game', error: e);
      if (mounted) Navigator.of(context).pop();
    }
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
  const _BodyBuilder({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);

    return Column(
      children: [
        if (gameData?.me.isSpectator ?? false)
          Text(
            LocaleKeys.you_are_spectator.tr(),
            style: context.textTheme.bodySmall?.copyWith(
              color: context.theme.colorScheme.onSurfaceVariant,
            ),
          ).paddingAll(8),
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
