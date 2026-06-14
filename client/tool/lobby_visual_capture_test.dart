import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:openquester/common_imports.dart';

const Key _rolePanelKey = ValueKey('lobby-visual-role-panel');
const Key _showmanAreaKey = ValueKey('lobby-visual-showman-area');
const Key _playersAreaKey = ValueKey('lobby-visual-players-area');
const Key _spectatorsAreaKey = ValueKey('lobby-visual-spectators-area');
const Key _packageBottomFadeKey = ValueKey('lobby-visual-package-bottom-fade');
const Key _showmanBottomFadeKey = ValueKey(
  'lobby-visual-showman-bottom-fade',
);
const Key _playersBottomFadeKey = ValueKey(
  'lobby-visual-players-bottom-fade',
);
const Key _spectatorsBottomFadeKey = ValueKey(
  'lobby-visual-spectators-bottom-fade',
);
const Key _packagePanelKey = ValueKey('lobby-visual-package-panel');
const Key _currentPlayerCardKey = ValueKey('lobby-visual-current-player-card');
const Key _currentPlayerDragIconKey = ValueKey(
  'lobby-visual-current-player-drag-icon',
);
const Key _actionBottomAreaKey = ValueKey('lobby-visual-action-bottom-area');
const Key _actionFloatingAreaKey = ValueKey(
  'lobby-visual-action-floating-area',
);

void main() {
  final binding = TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    // This visual harness is run with flutter_test from tool/, outside Dart's
    // normal test directory convention.
    // ignore: invalid_use_of_visible_for_testing_member
    SharedPreferences.setMockInitialValues({});
    await EasyLocalization.ensureInitialized();
    await _loadVisualFonts();
    _registerVisualServices();
  });

  const matrix = [
    _VisualCase(_VisualState.populated, 'light_standard', 390, 844),
    _VisualCase(_VisualState.populated, 'light_standard', 820, 1180),
    _VisualCase(_VisualState.populated, 'light_standard', 1280, 720),
    _VisualCase(_VisualState.populated, 'light_standard', 1920, 1080),
    _VisualCase(_VisualState.populated, 'dark_standard', 390, 844),
    _VisualCase(_VisualState.populated, 'dark_standard', 820, 1180),
    _VisualCase(_VisualState.populated, 'dark_standard', 1280, 720),
    _VisualCase(_VisualState.populated, 'dark_standard', 1920, 1080),
    _VisualCase(_VisualState.empty, 'light_standard', 390, 844),
    _VisualCase(_VisualState.empty, 'light_standard', 1280, 720),
    _VisualCase(_VisualState.empty, 'dark_standard', 390, 844),
    _VisualCase(_VisualState.empty, 'dark_standard', 1280, 720),
    _VisualCase(_VisualState.chatOpen, 'light_standard', 1280, 720),
    _VisualCase(_VisualState.chatOpen, 'light_standard', 1920, 1080),
    _VisualCase(_VisualState.chatOpen, 'dark_standard', 1280, 720),
    _VisualCase(_VisualState.chatOpen, 'dark_standard', 1920, 1080),
  ];

  testWidgets('capture lobby visual matrix', (tester) async {
    for (var index = 0; index < matrix.length; index += 1) {
      final visualCase = matrix[index];
      try {
        await binding.setSurfaceSize(
          Size(visualCase.width.toDouble(), visualCase.height.toDouble()),
        );
        tester.view.devicePixelRatio = 1;

        final captureKey = GlobalKey();
        await tester.pumpWidget(
          _LocalizedVisualApp(captureKey: captureKey, visualCase: visualCase),
        );
        for (var attempt = 0; attempt < 30; attempt += 1) {
          await tester.pump(const Duration(milliseconds: 100));
          if (captureKey.currentContext != null) break;
        }
        expect(captureKey.currentContext, isNotNull);
        await tester.pump(const Duration(seconds: 2));

        expect(find.text(LocaleKeys.you_are_spectator.tr()), findsNothing);
        expect(find.byIcon(Icons.person_pin_circle_outlined), findsNothing);
        await tester.pump();
        if (visualCase.width >= UiModeUtils.large) {
          final rolePanelHeight = tester
              .renderObject<RenderBox>(find.byKey(_rolePanelKey))
              .size
              .height;
          final rolePanelWidth = tester
              .renderObject<RenderBox>(find.byKey(_rolePanelKey))
              .size
              .width;
          final showmanHeight = tester
              .renderObject<RenderBox>(find.byKey(_showmanAreaKey))
              .size
              .height;
          final playersHeight = tester
              .renderObject<RenderBox>(find.byKey(_playersAreaKey))
              .size
              .height;
          final spectatorsHeight = tester
              .renderObject<RenderBox>(find.byKey(_spectatorsAreaKey))
              .size
              .height;

          expect(rolePanelWidth, greaterThanOrEqualTo(432));
          expect(showmanHeight, greaterThan(90));
          expect(playersHeight, greaterThan(spectatorsHeight));
          expect(
            playersHeight / spectatorsHeight,
            moreOrLessEquals(1.5, epsilon: .15),
          );
          expect(
            showmanHeight + playersHeight + spectatorsHeight,
            lessThan(rolePanelHeight),
          );
          if (visualCase.state == _VisualState.populated) {
            final currentPlayerCardRect = tester.getRect(
              find.byKey(_currentPlayerCardKey),
            );
            final currentPlayerDragIconRect = tester.getRect(
              find.byKey(_currentPlayerDragIconKey),
            );

            expect(
              currentPlayerCardRect.right - currentPlayerDragIconRect.right,
              inInclusiveRange(8, 14),
            );
          }
          if (visualCase.height <= 720) {
            final packageBottomFadeHeight = tester
                .renderObject<RenderBox>(find.byKey(_packageBottomFadeKey))
                .size
                .height;

            expect(packageBottomFadeHeight, 48);
          }
          expect(find.byKey(_showmanBottomFadeKey), findsNothing);
          expect(find.byKey(_playersBottomFadeKey), findsNothing);
          expect(
            find.byKey(_spectatorsBottomFadeKey),
            visualCase.state == _VisualState.empty
                ? findsNothing
                : findsOneWidget,
          );
        }
        if (visualCase.state == _VisualState.populated &&
            visualCase.width == 390) {
          final packagePanelTop = tester
              .getTopLeft(find.byKey(_packagePanelKey))
              .dy;

          expect(packagePanelTop, lessThanOrEqualTo(708));
        }
        final mobileActionLayout = visualCase.width <= UiModeUtils.medium;
        final showActionButton = visualCase.state != _VisualState.empty;
        final showBottomActionArea = !mobileActionLayout;
        final showFloatingActionArea = mobileActionLayout && showActionButton;

        expect(
          find.byKey(_actionBottomAreaKey),
          showBottomActionArea ? findsOneWidget : findsNothing,
        );
        expect(
          find.byKey(_actionFloatingAreaKey),
          showFloatingActionArea ? findsOneWidget : findsNothing,
        );
        if (showFloatingActionArea) {
          final actionFloatingFinder = find.byKey(_actionFloatingAreaKey);
          final actionFloatingRect = tester.getRect(actionFloatingFinder);
          final mobileContentRect = tester.getRect(find.byType(ListView).first);

          expect(
            visualCase.width - actionFloatingRect.right,
            inInclusiveRange(12, 32),
          );
          expect(mobileContentRect.bottom, greaterThan(actionFloatingRect.top));
        }

        final boundary =
            captureKey.currentContext!.findRenderObject()!
                as RenderRepaintBoundary;
        await tester.runAsync(() async {
          final image = await boundary.toImage();
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          final outFile = File(
            '.codex/visual_debug/${visualCase.fileName(index)}',
          );
          await outFile.parent.create(recursive: true);
          await outFile.writeAsBytes(bytes!.buffer.asUint8List());
        });
      } finally {
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump();
        await binding.setSurfaceSize(null);
      }
    }
  });
}

enum _VisualState { populated, empty, chatOpen }

class _VisualCase {
  const _VisualCase(this.state, this.theme, this.width, this.height);

  final _VisualState state;
  final String theme;
  final int width;
  final int height;

  bool get dark => theme.startsWith('dark');
  bool get showChat => state == _VisualState.chatOpen;

  _LobbyScenario get scenario {
    return switch (state) {
      _VisualState.populated => _LobbyScenario.populated,
      _VisualState.empty => _LobbyScenario.empty,
      _VisualState.chatOpen => _LobbyScenario.populated,
    };
  }

  String get stateName {
    return switch (state) {
      _VisualState.populated => 'populated',
      _VisualState.empty => 'empty',
      _VisualState.chatOpen => 'chat_open',
    };
  }

  String fileName(int index) {
    return 'step_${(index + 1).toString().padLeft(2, '0')}_'
        '${stateName}_${theme}_${width}x$height.png';
  }
}

class _LocalizedVisualApp extends StatelessWidget {
  const _LocalizedVisualApp({
    required this.captureKey,
    required this.visualCase,
  });

  final GlobalKey captureKey;
  final _VisualCase visualCase;

  @override
  Widget build(BuildContext context) {
    getIt<SettingsController>().settings = AppSettings(
      themeMode: visualCase.dark ? AppThemeMode.dark : AppThemeMode.light,
    );

    return EasyLocalization(
      supportedLocales: const [Locale('en', 'US')],
      path: 'assets/localization',
      fallbackLocale: const Locale('en', 'US'),
      startLocale: const Locale('en', 'US'),
      child: Builder(
        builder: (context) => MaterialApp(
          theme: AppTheme.build(Colors.indigo, Brightness.light),
          darkTheme: AppTheme.build(Colors.indigo, Brightness.dark),
          themeMode: visualCase.dark ? ThemeMode.dark : ThemeMode.light,
          locale: context.locale,
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          debugShowCheckedModeBanner: false,
          home: RepaintBoundary(
            key: captureKey,
            child: AnimationConfigurationClass.synchronized(
              duration: Durations.short2,
              child: _LobbyVisualScreen(visualCase: visualCase),
            ),
          ),
        ),
      ),
    );
  }
}

class _LobbyVisualScreen extends StatelessWidget {
  const _LobbyVisualScreen({required this.visualCase});

  final _VisualCase visualCase;

  @override
  Widget build(BuildContext context) {
    final package = _package();
    final scenario = visualCase.scenario;
    final showActionButton = scenario.currentRole != PlayerRole.spectator;
    final useMobileActionButton = visualCase.width <= UiModeUtils.medium;
    final showFloatingActionButton = useMobileActionButton && showActionButton;
    final showBottomActionArea = !useMobileActionButton;
    final actionButtonLabel = scenario.currentRole == PlayerRole.showman
        ? LocaleKeys.start_game.tr()
        : LocaleKeys.game_lobby_editor_ready.tr();
    final actionButtonIcon = scenario.currentRole == PlayerRole.showman
        ? Icons.play_arrow_rounded
        : Icons.check_circle_outline;

    return Scaffold(
      appBar: AppBar(
        leading: const Icon(Icons.exit_to_app),
        actions: const [
          Icon(Icons.more_vert),
          SizedBox(width: 8),
          Icon(Icons.chat_bubble_outline),
          SizedBox(width: 16),
        ],
      ),
      bottomNavigationBar: showBottomActionArea
          ? _VisualLobbyActionButton(
              showButton: showActionButton,
              icon: actionButtonIcon,
              label: actionButtonLabel,
            )
          : null,
      floatingActionButton: showFloatingActionButton
          ? _VisualLobbyActionButton(
              showButton: showActionButton,
              icon: actionButtonIcon,
              label: actionButtonLabel,
              floating: true,
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      floatingActionButtonAnimator: FloatingActionButtonAnimator.noAnimation,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= UiModeUtils.large;
            final horizontalPadding = wide ? 24.0 : 16.0;
            final roleContent = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _RolePanelHeader(scenario: scenario),
                const SizedBox(height: 16),
                if (wide)
                  Expanded(
                    child: _RoleBoard(
                      players: scenario.players,
                      currentRole: scenario.currentRole,
                      currentPlayerName: scenario.currentPlayerName,
                      maxPlayers: scenario.maxPlayers,
                    ),
                  )
                else
                  _RoleBoard(
                    players: scenario.players,
                    currentRole: scenario.currentRole,
                    currentPlayerName: scenario.currentPlayerName,
                    maxPlayers: scenario.maxPlayers,
                  ),
              ],
            );
            final rolePanel = _SurfacePanel(
              key: _rolePanelKey,
              child: roleContent,
            );
            final packagePanel = _SurfacePanel(
              key: _packagePanelKey,
              child: wide
                  ? _MockFadingScrollView(
                      bottomFadeKey: _packageBottomFadeKey,
                      child: PackagePublicOverview(package: package),
                    )
                  : PackagePublicOverview(package: package),
            );

            if (wide) {
              return Column(
                children: [
                  const _LobbyHeader().paddingOnly(
                    left: horizontalPadding,
                    right: horizontalPadding,
                    top: 16,
                    bottom: 12,
                  ),
                  Expanded(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(
                        horizontalPadding,
                        0,
                        horizontalPadding,
                        16,
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        spacing: 24,
                        children: [
                          Expanded(
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              spacing: 24,
                              children: [
                                SizedBox(width: 440, child: rolePanel),
                                Expanded(child: packagePanel),
                              ],
                            ),
                          ),
                          if (visualCase.showChat)
                            const _MockChatPanel().withWidth(350),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            }

            return Column(
              children: [
                const _LobbyHeader().paddingOnly(
                  left: horizontalPadding,
                  right: horizontalPadding,
                  top: 16,
                  bottom: 12,
                ),
                Expanded(
                  child: ListView(
                    padding: EdgeInsets.fromLTRB(
                      horizontalPadding,
                      0,
                      horizontalPadding,
                      16,
                    ),
                    children: [
                      rolePanel,
                      const SizedBox(height: 16),
                      packagePanel,
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _VisualLobbyActionButton extends StatelessWidget {
  const _VisualLobbyActionButton({
    required this.showButton,
    required this.icon,
    required this.label,
    this.floating = false,
  });

  final bool showButton;
  final IconData icon;
  final String label;
  final bool floating;

  static const double _buttonHeight = 54;

  @override
  Widget build(BuildContext context) {
    final actionButton = showButton
        ? _VisualLobbyActionButtonContent(
            icon: icon,
            label: label,
            floating: floating,
          )
        : null;

    if (floating) {
      if (actionButton == null) return const SizedBox.shrink();

      return Padding(
        key: _actionFloatingAreaKey,
        padding: 16.horizontal,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: actionButton,
        ),
      );
    }

    return Material(
      key: _actionBottomAreaKey,
      type: MaterialType.transparency,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: 16.all,
          child: SizedBox(
            height: _buttonHeight,
            width: double.infinity,
            child: Center(child: actionButton ?? const SizedBox.shrink()),
          ),
        ),
      ),
    );
  }
}

class _VisualLobbyActionButtonContent extends StatelessWidget {
  const _VisualLobbyActionButtonContent({
    required this.icon,
    required this.label,
    required this.floating,
  });

  final IconData icon;
  final String label;
  final bool floating;

  @override
  Widget build(BuildContext context) {
    final button = FilledButton.icon(
      onPressed: () {},
      style: ButtonStyle(
        minimumSize: const WidgetStatePropertyAll(
          Size(240, _VisualLobbyActionButton._buttonHeight),
        ),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        ),
        elevation: WidgetStatePropertyAll(floating ? 6 : 0),
        shadowColor: WidgetStatePropertyAll(
          context.theme.colorScheme.shadow.withValues(alpha: .24),
        ),
      ),
      icon: Icon(icon),
      label: Text(label),
    );

    return button;
  }
}

class _RolePanelHeader extends StatelessWidget {
  const _RolePanelHeader({required this.scenario});

  final _LobbyScenario scenario;

  @override
  Widget build(BuildContext context) {
    final players = scenario.players.where(
      (player) => player.role == PlayerRole.player,
    );
    final playerCount = players.length;
    final readyCount = players.where((player) => player.ready).length;

    return Row(
      spacing: 12,
      children: [
        Expanded(
          child: Text(
            LocaleKeys.players.tr(),
            style: context.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        if (playerCount > 0)
          _StatusChip(
            icon: Icons.check_circle_outline,
            color: ExtraColors.of(context).success,
            text:
                '$readyCount/$playerCount '
                '${LocaleKeys.game_lobby_editor_ready.tr()}',
          ),
      ],
    );
  }
}

class _LobbyHeader extends StatelessWidget {
  const _LobbyHeader();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: Text(
        'Friday Quiz Night',
        style: context.textTheme.headlineSmall?.copyWith(
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({
    required this.icon,
    required this.color,
    required this.text,
  });

  final IconData icon;
  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    final backgroundAlpha = context.theme.brightness == Brightness.light
        ? .16
        : .12;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: backgroundAlpha),
        borderRadius: 999.circular,
        border: Border.all(color: color.withValues(alpha: .34)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: 5,
        children: [
          Icon(icon, size: 14, color: color),
          Text(
            text,
            style: context.textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _SurfacePanel extends StatelessWidget {
  const _SurfacePanel({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: context.theme.colorScheme.surfaceContainerLow,
        borderRadius: 8.circular,
        border: Border.all(
          color: context.theme.colorScheme.outline.withValues(alpha: .12),
        ),
      ),
      child: child.paddingAll(16),
    );
  }
}

class _MockChatPanel extends StatelessWidget {
  const _MockChatPanel();

  @override
  Widget build(BuildContext context) {
    final colorScheme = context.theme.colorScheme;

    return SafeArea(
      child: Card(
        clipBehavior: Clip.antiAlias,
        color: colorScheme.surfaceContainer,
        child: Column(
          children: [
            Row(
              spacing: 8,
              children: [
                const Icon(Icons.chat_bubble_outline, size: 18),
                Text(
                  'Chat',
                  style: context.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ).paddingAll(16),
            Divider(height: 1, color: colorScheme.outlineVariant),
            Expanded(
              child: ListView(
                padding: 16.all,
                children: const [
                  _MockChatBubble(author: 'Mira', text: 'Ready when you are.'),
                  _MockChatBubble(
                    author: 'Dan',
                    text: 'Can I stay as player two?',
                    sentByMe: true,
                  ),
                  _MockChatBubble(
                    author: 'System',
                    text: 'Ari joined as player.',
                  ),
                ],
              ),
            ),
            Container(
              height: 44,
              margin: 12.all,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: colorScheme.surfaceContainerHighest,
                borderRadius: 8.circular,
                border: Border.all(
                  color: colorScheme.outline.withValues(alpha: .18),
                ),
              ),
              alignment: Alignment.centerLeft,
              child: Text(
                'Message',
                style: context.textTheme.bodyMedium?.copyWith(
                  color: colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MockChatBubble extends StatelessWidget {
  const _MockChatBubble({
    required this.author,
    required this.text,
    this.sentByMe = false,
  });

  final String author;
  final String text;
  final bool sentByMe;

  @override
  Widget build(BuildContext context) {
    final colorScheme = context.theme.colorScheme;
    final background = sentByMe
        ? colorScheme.primaryContainer
        : colorScheme.surfaceContainerHighest;
    final foreground = sentByMe
        ? colorScheme.onPrimaryContainer
        : colorScheme.onSurface;

    return Align(
      alignment: sentByMe
          ? AlignmentDirectional.centerEnd
          : AlignmentDirectional.centerStart,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 250),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: background,
            borderRadius: 8.circular,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 4,
            children: [
              Text(
                author,
                style: context.textTheme.labelSmall?.copyWith(
                  color: foreground.withValues(alpha: .72),
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                text,
                style: context.textTheme.bodyMedium?.copyWith(
                  color: foreground,
                ),
              ),
            ],
          ).paddingAll(10),
        ),
      ),
    ).paddingBottom(10);
  }
}

class _RoleBoard extends StatelessWidget {
  const _RoleBoard({
    required this.players,
    required this.currentRole,
    required this.currentPlayerName,
    required this.maxPlayers,
  });

  final List<_LobbyPlayer> players;
  final PlayerRole currentRole;
  final String currentPlayerName;
  final int maxPlayers;

  static const _showmanAreaHeight = 116.0;
  static const _playersAreaWeight = 3;
  static const _spectatorsAreaWeight = 2;
  static const _roleSectionDividerHeight = 22.0;
  static const _minimumScrollableRoleAreaHeight = 110.0;
  static const _compactSpectatorsMaxHeight = 96.0;

  @override
  Widget build(BuildContext context) {
    final playerSeatsFull =
        players.where((player) => player.role == PlayerRole.player).length >=
        maxPlayers;
    final options = buildJoinRoleSwitchOptions(
      currentRole: currentRole,
      showmanTaken: players.any((player) => player.role == PlayerRole.showman),
      playerSeatsFull: playerSeatsFull,
    );

    final showmanPlayers = players.where(
      (player) => player.role == PlayerRole.showman,
    );
    final activePlayers = players.where(
      (player) => player.role == PlayerRole.player,
    );
    final spectators = players.where(
      (player) => player.role == PlayerRole.spectator,
    );

    final showmanGroup = _RoleGroup(
      key: _showmanAreaKey,
      title: LocaleKeys.showman.tr(),
      role: PlayerRole.showman,
      joinOption: options.firstWhereOrNull(
        (option) => option.role == PlayerRole.showman,
      ),
      players: showmanPlayers,
      currentPlayerName: currentPlayerName,
    );
    final playersGroup = _RoleGroup(
      key: _playersAreaKey,
      title: LocaleKeys.players.tr(),
      role: PlayerRole.player,
      joinOption: options.firstWhereOrNull(
        (option) => option.role == PlayerRole.player,
      ),
      players: activePlayers,
      currentPlayerName: currentPlayerName,
    );
    final spectatorsGroup = _RoleGroup(
      key: _spectatorsAreaKey,
      title: LocaleKeys.spectators.tr(),
      role: PlayerRole.spectator,
      joinOption: options.firstWhereOrNull(
        (option) => option.role == PlayerRole.spectator,
      ),
      players: spectators,
      currentPlayerName: currentPlayerName,
      scrollablePlayers: true,
      maxUnboundedPlayersHeight: _compactSpectatorsMaxHeight,
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        if (!constraints.hasBoundedHeight) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              showmanGroup,
              const _RoleSectionDivider(),
              playersGroup,
              const _RoleSectionDivider(),
              spectatorsGroup,
            ],
          );
        }

        final roleAreaHeights = _roleAreaHeights(constraints.maxHeight);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(height: _showmanAreaHeight, child: showmanGroup),
            const _RoleSectionDivider(),
            SizedBox(height: roleAreaHeights.players, child: playersGroup),
            const _RoleSectionDivider(),
            SizedBox(
              height: roleAreaHeights.spectators,
              child: spectatorsGroup,
            ),
          ],
        );
      },
    );
  }

  ({double players, double spectators}) _roleAreaHeights(
    double availableHeight,
  ) {
    const fixedHeight = _showmanAreaHeight + (_roleSectionDividerHeight * 2);
    final flexibleHeight = availableHeight > fixedHeight
        ? availableHeight - fixedHeight
        : 0.0;
    const totalWeight = _playersAreaWeight + _spectatorsAreaWeight;
    var playersHeight = flexibleHeight * _playersAreaWeight / totalWeight;
    var spectatorsHeight = flexibleHeight - playersHeight;
    final canPreserveMinimums =
        flexibleHeight >= _minimumScrollableRoleAreaHeight * 2;

    if (canPreserveMinimums &&
        spectatorsHeight < _minimumScrollableRoleAreaHeight) {
      spectatorsHeight = _minimumScrollableRoleAreaHeight;
      playersHeight = flexibleHeight - spectatorsHeight;
    }

    if (canPreserveMinimums &&
        playersHeight < _minimumScrollableRoleAreaHeight) {
      playersHeight = _minimumScrollableRoleAreaHeight;
      spectatorsHeight = flexibleHeight - playersHeight;
    }

    return (players: playersHeight, spectators: spectatorsHeight);
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

class _RoleGroup extends StatelessWidget {
  const _RoleGroup({
    required this.title,
    required this.role,
    required this.joinOption,
    required this.players,
    required this.currentPlayerName,
    this.scrollablePlayers = false,
    this.maxUnboundedPlayersHeight,
    super.key,
  });

  final String title;
  final PlayerRole role;
  final JoinRoleOption? joinOption;
  final Iterable<_LobbyPlayer> players;
  final String currentPlayerName;
  final bool scrollablePlayers;
  final double? maxUnboundedPlayersHeight;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
      decoration: BoxDecoration(
        borderRadius: 8.circular,
        border: Border.all(color: Colors.transparent),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final boundedArea = constraints.hasBoundedHeight;
          final playersWrap = _MockRolePlayersWrap(
            scrollable: boundedArea || scrollablePlayers,
            spacing: 8,
            twoColumn: role != PlayerRole.showman,
            maxUnboundedHeight: maxUnboundedPlayersHeight,
            bottomFadeKey: switch (role) {
              PlayerRole.showman => _showmanBottomFadeKey,
              PlayerRole.player => _playersBottomFadeKey,
              PlayerRole.spectator => _spectatorsBottomFadeKey,
              PlayerRole.$unknown => null,
            },
            children: [
              for (final player in players)
                _PlayerChip(
                  player: player,
                  current: player.name == currentPlayerName,
                ),
            ],
          );

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 10,
            children: [
              Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 8,
                runSpacing: 8,
                children: [
                  Text(
                    title,
                    style: context.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (joinOption != null) _RoleJoinButton(role: role),
                ],
              ),
              if (boundedArea) Expanded(child: playersWrap) else playersWrap,
            ],
          );
        },
      ),
    );
  }
}

class _MockRolePlayersWrap extends StatelessWidget {
  const _MockRolePlayersWrap({
    required this.children,
    required this.spacing,
    required this.scrollable,
    required this.twoColumn,
    this.maxUnboundedHeight,
    this.bottomFadeKey,
  });

  final List<Widget> children;
  final double spacing;
  final bool scrollable;
  final bool twoColumn;
  final double? maxUnboundedHeight;
  final Key? bottomFadeKey;

  @override
  Widget build(BuildContext context) {
    final content = LayoutBuilder(
      builder: (context, constraints) {
        const minTwoColumnTileWidth = 156.0;
        const maxNaturalTileWidth = 260.0;
        final canUseTwoColumns =
            twoColumn &&
            constraints.hasBoundedWidth &&
            constraints.maxWidth >= (minTwoColumnTileWidth * 2) + spacing;
        final tileWidth = canUseTwoColumns
            ? (constraints.maxWidth - spacing) / 2
            : null;

        return Wrap(
          spacing: spacing,
          runSpacing: spacing,
          children: [
            for (final child in children)
              if (tileWidth == null)
                ConstrainedBox(
                  constraints: const BoxConstraints(
                    maxWidth: maxNaturalTileWidth,
                  ),
                  child: child,
                )
              else
                SizedBox(width: tileWidth, child: child),
          ],
        );
      },
    );
    if (!scrollable) return content;

    return LayoutBuilder(
      builder: (context, constraints) {
        final scrollView = _MockFadingScrollView(
          bottomPadding: 8,
          bottomFadeKey: bottomFadeKey,
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
}

class _MockFadingScrollView extends StatefulWidget {
  const _MockFadingScrollView({
    required this.child,
    this.bottomPadding = 12,
    this.bottomFadeKey,
  });

  final Widget child;
  final double bottomPadding;
  final Key? bottomFadeKey;

  @override
  State<_MockFadingScrollView> createState() => _MockFadingScrollViewState();
}

class _MockFadingScrollViewState extends State<_MockFadingScrollView> {
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
              const _MockScrollEdgeFade(
                alignment: Alignment.topCenter,
                height: _fadeHeight,
              ),
            if (_showBottomFade)
              _MockScrollEdgeFade(
                key: widget.bottomFadeKey,
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

class _MockScrollEdgeFade extends StatelessWidget {
  const _MockScrollEdgeFade({
    required this.alignment,
    required this.height,
    super.key,
  });

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

class _RoleJoinButton extends StatelessWidget {
  const _RoleJoinButton({required this.role});

  final PlayerRole role;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: () {},
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
        '${LocaleKeys.join_as.tr()} ${_roleLabel(role)}',
        overflow: TextOverflow.ellipsis,
      ),
    );
  }
}

String _roleLabel(PlayerRole role) {
  return switch (role) {
    PlayerRole.showman => LocaleKeys.showman.tr(),
    PlayerRole.player => LocaleKeys.player.tr(),
    PlayerRole.spectator => LocaleKeys.spectator.tr(),
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

class _PlayerChip extends StatelessWidget {
  const _PlayerChip({required this.player, required this.current});

  final _LobbyPlayer player;
  final bool current;

  @override
  Widget build(BuildContext context) {
    final colorScheme = context.theme.colorScheme;
    final successColor = ExtraColors.of(context).success;
    final borderRadius = 8.circular;
    final borderColor = current
        ? colorScheme.primary
        : player.ready
        ? successColor.withValues(alpha: .65)
        : colorScheme.outline.withValues(alpha: .24);

    return Material(
      key: current ? _currentPlayerCardKey : null,
      color: current
          ? colorScheme.primary.withValues(alpha: .08)
          : colorScheme.surfaceContainer,
      borderRadius: borderRadius,
      child: Container(
        constraints: const BoxConstraints(minHeight: 50),
        padding: const EdgeInsetsDirectional.only(
          start: 9,
          top: 7,
          end: 10,
          bottom: 7,
        ),
        decoration: BoxDecoration(
          borderRadius: borderRadius,
          border: Border.all(
            color: borderColor,
            width: current ? 1.5 : 1,
          ),
        ),
        child: Row(
          spacing: 6,
          children: [
            CircleAvatar(
              radius: 18,
              child: Text(
                player.name.characters.first,
                style: context.textTheme.labelLarge?.copyWith(
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
                    player.name,
                    overflow: TextOverflow.ellipsis,
                    style: context.textTheme.bodyMedium?.copyWith(
                      fontWeight: current ? FontWeight.w700 : null,
                    ),
                  ),
                  if (player.role == PlayerRole.player)
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      spacing: 4,
                      children: [
                        Icon(
                          player.ready
                              ? Icons.check_circle
                              : Icons.radio_button_unchecked,
                          size: 12,
                          color: player.ready
                              ? successColor
                              : colorScheme.onSurfaceVariant,
                        ),
                        Text(
                          player.ready
                              ? LocaleKeys.game_lobby_editor_ready.tr()
                              : LocaleKeys.game_lobby_editor_not_ready.tr(),
                          style: context.textTheme.labelSmall?.copyWith(
                            color: player.ready
                                ? successColor
                                : colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    )
                  else if (player.role == PlayerRole.showman)
                    Text(
                      LocaleKeys.showman.tr(),
                      style: context.textTheme.labelSmall?.copyWith(
                        color: colorScheme.onSurfaceVariant,
                      ),
                    ),
                ],
              ),
            ),
            SizedBox.square(
              key: current ? _currentPlayerDragIconKey : null,
              dimension: 16,
              child: Icon(
                Icons.drag_indicator,
                size: 16,
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum _LobbyScenario {
  populated(
    players: [
      _LobbyPlayer(name: 'Mira', role: PlayerRole.showman),
      _LobbyPlayer(name: 'Ari With A Long Nickname', role: PlayerRole.player),
      _LobbyPlayer(
        name: 'Dan Ready Player',
        role: PlayerRole.player,
        ready: true,
      ),
      _LobbyPlayer(name: 'Noa Spectator Longname', role: PlayerRole.spectator),
      _LobbyPlayer(name: 'Eli', role: PlayerRole.spectator),
      _LobbyPlayer(name: 'Kai', role: PlayerRole.spectator),
      _LobbyPlayer(name: 'Uma', role: PlayerRole.spectator),
      _LobbyPlayer(name: 'Ira', role: PlayerRole.spectator),
      _LobbyPlayer(name: 'Max', role: PlayerRole.spectator),
      _LobbyPlayer(name: 'Sol', role: PlayerRole.spectator),
      _LobbyPlayer(name: 'Bea', role: PlayerRole.spectator),
      _LobbyPlayer(name: 'Lev', role: PlayerRole.spectator),
    ],
    currentRole: PlayerRole.player,
    currentPlayerName: 'Ari With A Long Nickname',
    maxPlayers: 3,
  ),
  empty(
    players: [
      _LobbyPlayer(name: 'Mira', role: PlayerRole.spectator),
    ],
    currentRole: PlayerRole.spectator,
    currentPlayerName: 'Mira',
    maxPlayers: 3,
  );

  const _LobbyScenario({
    required this.players,
    required this.currentRole,
    required this.currentPlayerName,
    required this.maxPlayers,
  });

  final List<_LobbyPlayer> players;
  final PlayerRole currentRole;
  final String currentPlayerName;
  final int maxPlayers;
}

class _LobbyPlayer {
  const _LobbyPlayer({
    required this.name,
    required this.role,
    this.ready = false,
  });

  final String name;
  final PlayerRole role;
  final bool ready;
}

void _registerVisualServices() {
  if (!getIt.isRegistered<SettingsController>()) {
    getIt.registerSingleton(
      SettingsController()..settings = const AppSettings(),
    );
  }

  if (!getIt.isRegistered<ProfileController>()) {
    final profile = ProfileController();
    profile.user.value = ResponseUser(
      id: 7,
      username: 'mira',
      createdAt: DateTime(2026),
      updatedAt: DateTime(2026),
      isDeleted: false,
      isBanned: false,
      isGuest: false,
      permissions: const [],
      name: 'Mira',
    );
    getIt.registerSingleton(profile);
  }
}

Future<void> _loadVisualFonts() async {
  Future<void> loadFont(String family, String path) async {
    final file = File(path);
    if (!file.existsSync()) return;

    final bytes = await file.readAsBytes();
    final loader = FontLoader(family)
      ..addFont(Future.value(ByteData.sublistView(Uint8List.fromList(bytes))));
    await loader.load();
  }

  await loadFont('Roboto', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');

  final flutterRoot = Platform.environment['FLUTTER_ROOT'];
  if (flutterRoot == null) return;

  await loadFont(
    'MaterialIcons',
    '$flutterRoot/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
  );
}

OqPackage _package() {
  return OqPackage(
    id: 1,
    title: 'Knowledge Pack With A Long Title That Must Stay On One Line',
    createdAt: DateTime(2026),
    author: const ShortUserInfo(id: 2, username: 'Author'),
    ageRestriction: AgeRestriction.a16,
    description:
        'A balanced set for a quick friendly game. It includes fast text '
        'questions, media prompts, and a few mixed rounds so the waiting room '
        'overview has enough detail to scan without exposing answers.',
    language: 'en',
    tags: const [PackageTag(id: 1, tag: 'classic')],
    rounds: const [
      PackageRound(
        order: 0,
        name: 'Warmup',
        type: PackageRoundType.simple,
        themes: [
          PackageTheme(
            order: 0,
            name: 'History',
            questions: [
              PackageQuestionUnion.simple(
                order: 0,
                price: 100,
                showAnswerDuration: 5000,
                text: 'Hidden prompt text',
              ),
            ],
          ),
          PackageTheme(
            order: 1,
            name: 'Science',
            questions: [
              PackageQuestionUnion.simple(
                order: 0,
                price: 200,
                showAnswerDuration: 5000,
                questionFiles: [
                  PackageQuestionFile(
                    order: 0,
                    file: FileItem(md5: 'audio', type: PackageFileType.audio),
                    displayTime: 5000,
                  ),
                ],
              ),
            ],
          ),
          PackageTheme(
            order: 2,
            name: 'Music',
            questions: [
              PackageQuestionUnion.simple(
                order: 0,
                price: 300,
                showAnswerDuration: 5000,
                text: 'Hidden mixed prompt',
                questionFiles: [
                  PackageQuestionFile(
                    order: 0,
                    file: FileItem(md5: 'image', type: PackageFileType.image),
                    displayTime: 5000,
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
      PackageRound(
        order: 1,
        name: 'Final',
        type: PackageRoundType.valueFinal,
        themes: [
          PackageTheme(order: 0, name: 'World Capitals', questions: []),
          PackageTheme(order: 1, name: 'Cinema', questions: []),
        ],
      ),
      PackageRound(
        order: 2,
        name: 'Archive',
        type: PackageRoundType.simple,
        themes: [
          PackageTheme(order: 0, name: 'Books', questions: []),
          PackageTheme(order: 1, name: 'Maps', questions: []),
        ],
      ),
      PackageRound(
        order: 3,
        name: 'Lightning',
        type: PackageRoundType.simple,
        themes: [
          PackageTheme(order: 0, name: 'Fast Facts', questions: []),
          PackageTheme(order: 1, name: 'Numbers', questions: []),
        ],
      ),
      PackageRound(
        order: 4,
        name: 'Visuals',
        type: PackageRoundType.simple,
        themes: [
          PackageTheme(order: 0, name: 'Paintings', questions: []),
          PackageTheme(order: 1, name: 'Posters', questions: []),
        ],
      ),
      PackageRound(
        order: 5,
        name: 'Audio',
        type: PackageRoundType.simple,
        themes: [
          PackageTheme(order: 0, name: 'Voices', questions: []),
          PackageTheme(order: 1, name: 'Signals', questions: []),
        ],
      ),
      PackageRound(
        order: 6,
        name: 'Teams',
        type: PackageRoundType.simple,
        themes: [
          PackageTheme(order: 0, name: 'Sports', questions: []),
          PackageTheme(order: 1, name: 'Clubs', questions: []),
        ],
      ),
      PackageRound(
        order: 7,
        name: 'Places',
        type: PackageRoundType.simple,
        themes: [
          PackageTheme(order: 0, name: 'Cities', questions: []),
          PackageTheme(order: 1, name: 'Islands', questions: []),
        ],
      ),
      PackageRound(
        order: 8,
        name: 'Final Mix',
        type: PackageRoundType.simple,
        themes: [
          PackageTheme(order: 0, name: 'Everything', questions: []),
          PackageTheme(order: 1, name: 'Tie Breakers', questions: []),
        ],
      ),
    ],
  );
}
