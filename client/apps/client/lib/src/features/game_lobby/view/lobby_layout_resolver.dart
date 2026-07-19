import 'package:flutter/widgets.dart';

enum LobbyMainColumns { one, two }

enum LobbyChatPresentation { hidden, overlay, persistent }

enum LobbyActionPlacement { bottom }

class LobbyLayout {
  const LobbyLayout({
    required this.availableWidth,
    required this.pagePadding,
    required this.gap,
    required this.mainContentWidth,
    required this.participantPanelWidth,
    required this.reservedChatWidth,
    required this.mainColumns,
    required this.chatPresentation,
    required this.actionPlacement,
  });

  final double availableWidth;
  final double pagePadding;
  final double gap;
  final double mainContentWidth;
  final double participantPanelWidth;
  final double reservedChatWidth;
  final LobbyMainColumns mainColumns;
  final LobbyChatPresentation chatPresentation;
  final LobbyActionPlacement actionPlacement;

  bool get usesTwoMainColumns => mainColumns == LobbyMainColumns.two;
  bool get usesPersistentChat =>
      chatPresentation == LobbyChatPresentation.persistent;
  bool get usesOverlayChat => chatPresentation == LobbyChatPresentation.overlay;
}

class LobbyLayoutResolver {
  const LobbyLayoutResolver._();

  static const double compactPagePadding = 16;
  static const double expandedPagePadding = 24;
  static const double expandedPagePaddingThreshold = 900;
  static const double compactGap = 16;
  static const double expandedGap = 24;
  static const double minimumParticipantPanelWidth = 320;
  static const double preferredParticipantPanelWidth = 360;
  static const double maximumParticipantPanelWidth = 400;
  static const double minimumPackagePanelWidth = 560;
  static const double minimumTwoColumnMainWidth = 900;
  static const double persistentChatWidth = 336;
  static const double minimumPersistentChatWidth = 300;
  static const double mobileActionMaxWidth = 420;
  static const double bottomActionHeight = 54;
  static const double bottomActionVerticalPadding = 16;

  static LobbyLayout resolve({
    required double availableWidth,
    required bool chatOpen,
  }) {
    final pagePadding = availableWidth >= expandedPagePaddingThreshold
        ? expandedPagePadding
        : compactPagePadding;
    final gap = availableWidth >= expandedPagePaddingThreshold
        ? expandedGap
        : compactGap;
    final contentWidth = _clampDouble(
      availableWidth - (pagePadding * 2),
      0,
      double.infinity,
    );
    final canUseTwoMainColumns = contentWidth >= minimumTwoColumnMainWidth;
    final canUsePersistentChat =
        chatOpen &&
        canUseTwoMainColumns &&
        contentWidth >= minimumTwoColumnMainWidth + gap + persistentChatWidth;
    final reservedChatWidth = canUsePersistentChat
        ? _clampDouble(
            persistentChatWidth,
            minimumPersistentChatWidth,
            contentWidth - minimumTwoColumnMainWidth - gap,
          )
        : 0.0;
    final mainContentWidth = canUsePersistentChat
        ? contentWidth - reservedChatWidth - gap
        : contentWidth;
    final mainColumns = mainContentWidth >= minimumTwoColumnMainWidth
        ? LobbyMainColumns.two
        : LobbyMainColumns.one;
    final chatPresentation = !chatOpen
        ? LobbyChatPresentation.hidden
        : canUsePersistentChat
        ? LobbyChatPresentation.persistent
        : LobbyChatPresentation.overlay;

    return LobbyLayout(
      availableWidth: availableWidth,
      pagePadding: pagePadding,
      gap: gap,
      mainContentWidth: mainContentWidth,
      participantPanelWidth: _participantPanelWidth(mainContentWidth),
      reservedChatWidth: reservedChatWidth,
      mainColumns: mainColumns,
      chatPresentation: chatPresentation,
      actionPlacement: LobbyActionPlacement.bottom,
    );
  }

  static double _participantPanelWidth(double mainContentWidth) {
    if (mainContentWidth < minimumTwoColumnMainWidth) {
      return mainContentWidth;
    }

    final proportionalWidth = mainContentWidth * .36;
    return _clampDouble(
      proportionalWidth,
      minimumParticipantPanelWidth,
      maximumParticipantPanelWidth,
    );
  }

  static double _clampDouble(
    double value,
    double lowerLimit,
    double upperLimit,
  ) {
    if (value < lowerLimit) return lowerLimit;
    if (value > upperLimit) return upperLimit;

    return value;
  }
}

class LobbyLayoutScope extends InheritedWidget {
  const LobbyLayoutScope({
    required this.layout,
    required super.child,
    super.key,
  });

  final LobbyLayout layout;

  static LobbyLayout of(BuildContext context) {
    final scope = context
        .dependOnInheritedWidgetOfExactType<LobbyLayoutScope>();
    assert(scope != null, 'No LobbyLayoutScope found in context.');
    return scope!.layout;
  }

  static LobbyLayout? maybeOf(BuildContext context) {
    return context
        .dependOnInheritedWidgetOfExactType<LobbyLayoutScope>()
        ?.layout;
  }

  @override
  bool updateShouldNotify(LobbyLayoutScope oldWidget) {
    return layout != oldWidget.layout;
  }
}
