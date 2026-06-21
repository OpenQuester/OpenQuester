import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_chat_core/flutter_chat_core.dart';
import 'package:openquester/common_imports.dart';

class SimpleTextMessage extends StatelessWidget {
  const SimpleTextMessage({
    required this.message,
    required this.index,
    super.key,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
    this.borderRadius = _sentinelBorderRadius,
    this.onlyEmojiFontSize = 48,
    this.sentBackgroundColor = _sentinelColor,
    this.receivedBackgroundColor = _sentinelColor,
    this.sentTextStyle = _sentinelTextStyle,
    this.receivedTextStyle = _sentinelTextStyle,
    this.timeStyle = _sentinelTextStyle,
    this.showTime = true,
    this.showStatus = true,
    this.timeAndStatusPosition = TimeAndStatusPosition.end,
  });

  static const BorderRadiusGeometry _sentinelBorderRadius = BorderRadius.zero;
  static const Color _sentinelColor = Colors.transparent;
  static const TextStyle _sentinelTextStyle = TextStyle();

  final TextMessage message;
  final int index;
  final EdgeInsetsGeometry? padding;
  final BorderRadiusGeometry? borderRadius;
  final double? onlyEmojiFontSize;
  final Color? sentBackgroundColor;
  final Color? receivedBackgroundColor;
  final TextStyle? sentTextStyle;
  final TextStyle? receivedTextStyle;
  final TextStyle? timeStyle;
  final bool showTime;
  final bool showStatus;
  final TimeAndStatusPosition timeAndStatusPosition;

  bool get _isOnlyEmoji => message.metadata?['isOnlyEmoji'] == true;

  @override
  Widget build(BuildContext context) {
    final theme = ChatTheme.fromThemeData(context.theme);
    final isSentByMe =
        getIt<SocketChatController>().user?.id == message.authorId;
    final backgroundColor = _resolveBackgroundColor(isSentByMe, theme);
    final textStyle = _resolveTextStyle(isSentByMe, theme);
    final timeStyle = _resolveTimeStyle(isSentByMe, theme);
    final messageCreatedAt = message.createdAt;

    final timeAndStatus = (showTime || showStatus) && messageCreatedAt != null
        ? TimeAndStatus(
            createdAt: messageCreatedAt,
            status: message.status,
            showTime: showTime,
            showStatus: showStatus,
            textStyle: timeStyle,
            userId: message.authorId,
          )
        : null;

    final textContent = SelectableText(
      message.text,
      selectionHeightStyle: BoxHeightStyle.max,
      selectionWidthStyle: BoxWidthStyle.max,
      style: _isOnlyEmoji
          ? textStyle?.copyWith(fontSize: onlyEmojiFontSize)
          : textStyle,
    );

    return Container(
      padding: _isOnlyEmoji
          ? EdgeInsets.symmetric(horizontal: (padding?.horizontal ?? 0) / 2)
          : padding,
      decoration: _isOnlyEmoji
          ? null
          : BoxDecoration(
              color: backgroundColor,
              borderRadius: borderRadius == _sentinelBorderRadius
                  ? theme.shape
                  : borderRadius,
            ),
      child: _buildContentBasedOnPosition(
        context: context,
        textContent: textContent,
        timeAndStatus: timeAndStatus,
        textStyle: textStyle,
      ),
    );
  }

  Widget _buildContentBasedOnPosition({
    required BuildContext context,
    required Widget textContent,
    Widget? timeAndStatus,
    TextStyle? textStyle,
  }) {
    if (timeAndStatus == null) {
      return textContent;
    }

    final textDirection = Directionality.of(context);

    switch (timeAndStatusPosition) {
      case TimeAndStatusPosition.start:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [textContent, timeAndStatus],
        );
      case TimeAndStatusPosition.inline:
        return Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Flexible(child: textContent),
            const SizedBox(width: 4),
            timeAndStatus,
          ],
        );
      case TimeAndStatusPosition.end:
        return Stack(
          children: [
            Padding(
              padding: EdgeInsets.only(bottom: textStyle?.lineHeight ?? 0),
              child: textContent,
            ),
            Opacity(opacity: 0, child: timeAndStatus),
            Positioned.directional(
              textDirection: textDirection,
              start: 0,
              bottom: 0,
              child: timeAndStatus,
            ),
          ],
        );
    }
  }

  Color? _resolveBackgroundColor(bool isSentByMe, ChatTheme theme) {
    if (isSentByMe) {
      return sentBackgroundColor == _sentinelColor
          ? theme.colors.primary
          : sentBackgroundColor;
    }
    return receivedBackgroundColor == _sentinelColor
        ? theme.colors.surfaceContainer
        : receivedBackgroundColor;
  }

  TextStyle? _resolveTextStyle(bool isSentByMe, ChatTheme theme) {
    if (isSentByMe) {
      return sentTextStyle == _sentinelTextStyle
          ? theme.typography.bodyMedium.copyWith(color: theme.colors.onPrimary)
          : sentTextStyle;
    }
    return receivedTextStyle == _sentinelTextStyle
        ? theme.typography.bodyMedium.copyWith(color: theme.colors.onSurface)
        : receivedTextStyle;
  }

  TextStyle? _resolveTimeStyle(bool isSentByMe, ChatTheme theme) {
    if (isSentByMe) {
      return timeStyle == _sentinelTextStyle
          ? theme.typography.labelSmall.copyWith(
              color: _isOnlyEmoji
                  ? theme.colors.onSurface
                  : theme.colors.onPrimary,
            )
          : timeStyle;
    }
    return timeStyle == _sentinelTextStyle
        ? theme.typography.labelSmall.copyWith(color: theme.colors.onSurface)
        : timeStyle;
  }
}

extension on TextStyle {
  double get lineHeight => (height ?? 1) * (fontSize ?? 0);
}

class TimeAndStatus extends StatelessWidget {
  const TimeAndStatus({
    required this.createdAt,
    required this.userId,
    super.key,
    this.status,
    this.showTime = true,
    this.showStatus = true,
    this.textStyle,
  });
  final DateTime createdAt;
  final MessageStatus? status;
  final bool showTime;
  final bool showStatus;
  final TextStyle? textStyle;
  final String userId;

  @override
  Widget build(BuildContext context) {
    final timeFormat = DateFormat.Hm();
    final socketChatController = getIt<SocketChatController>();
    final itsMe = userId == socketChatController.user?.id;

    return Row(
      spacing: 4,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (!itsMe)
          FutureBuilder(
            future: getIt<SocketChatController>().resolveUser(userId),
            builder: (context, snapshot) {
              final avatar = snapshot.data?.imageSource;
              final name = userId == SocketChatController.systemMessageId
                  ? LocaleKeys.system.tr()
                  : snapshot.data?.name ?? '-';
              return Row(
                mainAxisSize: MainAxisSize.min,
                spacing: 4,
                children: [
                  if (!avatar.isEmptyOrNull)
                    ImageWidget(url: avatar, avatarRadius: 10),
                  Text(name, style: textStyle),
                ],
              );
            },
          ),
        if (showTime)
          Text(timeFormat.format(createdAt.toLocal()), style: textStyle),
        if (showStatus && status != null)
          if (status == MessageStatus.sending)
            SizedBox(
              width: 6,
              height: 6,
              child: CircularProgressIndicator(
                color: textStyle?.color,
                strokeWidth: 2,
              ),
            )
          else
            Icon(getIconForStatus(status!), color: textStyle?.color, size: 12),
      ],
    );
  }
}
