import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GameLobbyStyles {
  static const Size players = Size(180, 90);
  static const Size playersMobile = Size.square(80);
  static const double desktopChatWidth = 350;

  static Size questionSize(BuildContext context) {
    final wideMode = UiModeUtils.wideModeOn(context);
    return wideMode ? const Size(100, 64) : const Size(86, 64);
  }

  static TextStyle? playerTextStyle(BuildContext context) {
    final wideMode = playersOnLeft(context);
    final style = wideMode
        ? playerTextStyleDesktop(context)
        : playerTextStyleMobile(context);
    return style?.copyWith(color: Colors.white);
  }

  static TextStyle? playerTextStyleMobile(BuildContext context) =>
      context.textTheme.bodySmall?.copyWith(color: Colors.white);
  static TextStyle? playerTextStyleDesktop(BuildContext context) =>
      context.textTheme.bodyLarge?.copyWith(color: Colors.white);

  static bool desktopChat(BuildContext context) =>
      UiModeUtils.wideModeOn(context, UiModeUtils.large);

  static bool playersOnLeft(BuildContext context) =>
      UiModeUtils.landscapeScreenSize(context);

  static bool questionMediaOnLeft(BuildContext context) =>
      UiModeUtils.landscapeScreenSize(context) &&
      MediaQuery.sizeOf(context).height < 600;

  static const double maxTimerWidth = 400;

  static BoxConstraints playerTileConstrains(BuildContext context) =>
      BoxConstraints.loose(
        playersOnLeft(context) ? players : playersMobile,
      );

  static double get playerTileRadius => 12;
}
