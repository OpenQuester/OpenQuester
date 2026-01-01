import 'package:flutter/material.dart';
import 'package:flutter_chat_core/flutter_chat_core.dart';
import 'package:openquester/common_imports.dart';
import 'package:socket_io_client/socket_io_client.dart' show Socket;

extension DurationX on Duration {
  String f({bool withSeconds = false}) {
    final out = <String>[];

    if (inHours > 0) {
      out.add([inHours, LocaleKeys.duration_h.tr()].join());
    }

    final minutes = inMinutes - inHours * 60;
    if (minutes > 0) {
      out.add([minutes, LocaleKeys.duration_m.tr()].join());
    }

    final seconds = inSeconds - inMinutes * 60;
    if (withSeconds && seconds > 0) {
      out.add([seconds, LocaleKeys.duration_s.tr()].join());
    }

    return out.join(' ');
  }
}

extension IPackageItemAgeRestrictionX on AgeRestriction {
  (String, Color)? format(BuildContext context) {
    final colors = Theme.of(context).extension<ExtraColors>()!;
    return {
      AgeRestriction.a12: ('12+', colors.success!),
      AgeRestriction.a16: ('16+', colors.warning!),
      AgeRestriction.a18: ('18+', context.theme.colorScheme.error),
    }[this];
  }
}

extension SocketX on Socket {
  void reconnect() {
    disconnect();
    connect();
  }
}

extension AgeRestrictionX on AgeRestriction {
  String f() {
    return switch (this) {
      AgeRestriction.a18 => '18+',
      AgeRestriction.a16 => '16+',
      AgeRestriction.a12 => '12+',
      _ => LocaleKeys.none.tr(),
    };
  }
}

extension PackageX on OqPackage {
  List<PackageRound> sortedRounds() {
    return rounds.sortedByCompare((e) => e.order, (a, b) => a.compareTo(b));
  }
}

extension PackageRoundX on PackageRound {
  List<PackageTheme> sortedThemes() {
    return themes.sortedByCompare((e) => e.order, (a, b) => a.compareTo(b));
  }
}

extension SocketIoGameStateThemeDataX on SocketIoGameStateThemeData {
  List<SocketIoGameStateQuestionData> sortedQuestions() {
    return questions.sortedByCompare((e) => e.order, (a, b) => a.compareTo(b));
  }
}

extension SocketIoGameStateRoundDataX on SocketIoGameStateRoundData {
  List<SocketIoGameStateThemeData> sortedThemes() {
    return themes.sortedByCompare((e) => e.order, (a, b) => a.compareTo(b));
  }

  SocketIoGameStateRoundData changeQuestion({
    required int? id,
    required SocketIoGameStateQuestionData Function(
      SocketIoGameStateQuestionData value,
    )
    onChange,
  }) {
    if (id == null) return this;

    final themes = List<SocketIoGameStateThemeData>.from(this.themes);
    for (var i = 0; i < themes.length; i++) {
      final theme = themes[i];
      final questions = List<SocketIoGameStateQuestionData>.from(
        theme.questions,
      );
      final questionIndex = questions.indexWhere((e) => e.id == id);
      if (questionIndex < 0) continue;
      questions[questionIndex] = onChange(questions[questionIndex]);
      themes[i] = themes[i].copyWith(questions: questions);
    }

    return copyWith(themes: themes);
  }
}

extension SocketIoGameJoinEventPayloadX on SocketIoGameJoinEventPayload {
  PlayerData get me => players.getById(ProfileController.getUser()!.id)!;

  SocketIoGameJoinEventPayload changePlayer({
    required int? id,
    required PlayerData? Function(PlayerData value) onChange,
  }) {
    if (id == null) return this;

    final players = List<PlayerData>.from(this.players);
    final playerIndex = players.indexWhere((e) => e.meta.id == id);

    if (playerIndex < 0) return this;
    final newPlayer = onChange(players[playerIndex]);

    if (newPlayer != null) {
      players[playerIndex] = newPlayer;
    } else {
      players.removeAt(playerIndex);
    }

    return copyWith(players: players);
  }

  bool get gameStarted => gameState.currentRound != null;
}

extension SocketIoChatMessageEventPayloadX on SocketIoChatMessageEventPayload {
  TextMessage toChatMessage() {
    return TextMessage(
      id: uuid,
      text: message,
      createdAt: timestamp,
      authorId: user.toString(),
    );
  }
}

extension PlayersX on List<PlayerData> {
  PlayerData? getById(int? id) {
    if (id == null) return null;
    return firstWhereOrNull((e) => e.meta.id == id);
  }
}

extension OqPackageX on OqPackage {
  PackageListItem toListItem() {
    return PackageListItem(
      id: id,
      title: title,
      description: description,
      createdAt: createdAt,
      author: author,
      ageRestriction: ageRestriction,
      language: language,
      tags: tags,
      logo: logo,
    );
  }
}

extension UserX on ResponseUser? {
  bool havePermission(PermissionName permissionName) =>
      this != null &&
      this!.permissions.any(
        (permission) => permission.name == permissionName,
      );
}

extension DateTimeX on DateTime {
  /// Convert DateTime to a relative time string (e.g., "5 minutes ago")
  String toRelativeString() {
    final now = DateTime.now();
    final difference = now.difference(this);

    if (difference.inSeconds < 60) {
      return LocaleKeys.just_now.tr();
    } else if (difference.inMinutes < 60) {
      return LocaleKeys.minutes_ago.tr(args: [difference.inMinutes.toString()]);
    } else if (difference.inHours < 24) {
      return LocaleKeys.hours_ago.tr(args: [difference.inHours.toString()]);
    } else {
      return LocaleKeys.days_ago.tr(args: [difference.inDays.toString()]);
    }
  }
}
