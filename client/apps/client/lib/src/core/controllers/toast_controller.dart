import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';
import 'package:toastification/toastification.dart';

enum ToastType {
  info,
  warning,
  error,
  success,
  chat;

  ToastificationType get toToastificationType {
    return switch (this) {
      ToastType.info => ToastificationType.info,
      ToastType.success => ToastificationType.success,
      ToastType.warning => ToastificationType.warning,
      ToastType.error => ToastificationType.error,
      ToastType.chat => ToastificationType.custom(
        name,
        Colors.cyan,
        Icons.message,
      ),
    };
  }
}

@singleton
class ToastController {
  Future<ToastificationItem> show(
    dynamic message, {
    Duration showFor = const Duration(seconds: 5),
    ToastType type = ToastType.error,
    String? title,
  }) async {
    final messageText = type == ToastType.error
        ? parseObject(message)
        : message.toString();

    final context = _context;
    final colorScheme = context?.theme.colorScheme;
    ExtraColors? extraColors;

    var wideMode = true;

    if (context != null) {
      wideMode = UiModeUtils.wideModeOn(context);
      extraColors = ExtraColors.of(context);
    }

    final primaryColor = switch (type) {
      ToastType.error => colorScheme?.error,
      ToastType.warning => extraColors?.warning,
      _ => colorScheme?.secondary,
    };

    return toastification.show(
      context: _context,
      title: Text(title ?? messageText),
      description: title != null ? Text(messageText) : null,
      type: type.toToastificationType,
      autoCloseDuration: showFor,
      alignment: wideMode ? Alignment.topRight : Alignment.topCenter,
      pauseOnHover: true,
      closeButton: const ToastCloseButton(
        showType: CloseButtonShowType.onHover,
      ),
      backgroundColor: colorScheme?.surfaceContainer,
      primaryColor: primaryColor,
      foregroundColor: colorScheme?.onSurface,
      borderSide: BorderSide(
        color: colorScheme?.onSurface ?? Colors.white,
        width: .5,
      ),
    );
  }

  String parseObject(dynamic object) {
    String? error;
    if (object is Map) {
      error = object['error']?.toString();
    } else if (object is DioException) {
      error = parseObject(object.response?.data ?? object.message);
    }
    return error ?? object.toString();
  }

  BuildContext? get _context => getIt<AppRouter>().navigatorKey.currentContext;

  ToastificationConfig config(BuildContext context) {
    final wideMode = UiModeUtils.wideModeOn(context);
    return ToastificationConfig(maxToastLimit: wideMode ? 3 : 1);
  }
}
