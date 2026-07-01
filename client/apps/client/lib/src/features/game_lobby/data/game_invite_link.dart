import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:openquester/common_imports.dart';

Uri buildGameInviteUri({
  required String gameId,
  Uri? clientAppUrl,
}) {
  final trimmedGameId = gameId.trim();
  if (trimmedGameId.isEmpty) {
    throw ArgumentError.value(gameId, 'gameId', 'Game id must not be empty.');
  }

  final baseUrl = clientAppUrl ?? Env.clientAppUrl;

  return Uri(
    scheme: baseUrl.scheme,
    userInfo: baseUrl.userInfo,
    host: baseUrl.host,
    port: baseUrl.hasPort ? baseUrl.port : null,
    pathSegments: ['games', trimmedGameId],
  );
}

Future<bool> copyGameInviteLinkToClipboard(
  BuildContext _, {
  required String? gameId,
}) async {
  try {
    if (gameId.isEmptyOrNull) {
      throw StateError('Cannot copy an invite link before the game id loads.');
    }

    final inviteUri = buildGameInviteUri(gameId: gameId!);
    await Clipboard.setData(ClipboardData(text: inviteUri.toString()));

    return true;
  } catch (error) {
    if (getIt.isRegistered<ToastController>()) {
      await getIt<ToastController>().show(
        error,
        title: LocaleKeys.invite_link_copy_failed.tr(),
      );
    }

    return false;
  }
}
