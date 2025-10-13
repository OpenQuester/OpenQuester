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

extension WidgetX on Widget {
  Widget shrink() =>
      Row(mainAxisSize: MainAxisSize.min, children: [flexible()]);

  Widget withTitle(
    String title, {
    CrossAxisAlignment crossAxisAlignment = CrossAxisAlignment.start,
  }) {
    return Column(
      spacing: 4,
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: crossAxisAlignment,
      children: [Text(title), this],
    );
  }

  Widget constrained(BoxConstraints constraints) {
    return ConstrainedBox(constraints: constraints, child: this);
  }

  SliverToBoxAdapter get sliver => SliverToBoxAdapter(child: this);
}

extension NumberPaddings on num {
  EdgeInsets get all => EdgeInsets.all(toDouble());
  EdgeInsets get left => EdgeInsets.only(left: toDouble());
  EdgeInsets get right => EdgeInsets.only(right: toDouble());
  EdgeInsets get top => EdgeInsets.only(top: toDouble());
  EdgeInsets get bottom => EdgeInsets.only(bottom: toDouble());
  EdgeInsets get vertical => EdgeInsets.symmetric(vertical: toDouble());
  EdgeInsets get horizontal => EdgeInsets.symmetric(horizontal: toDouble());
  BorderRadius get circular => BorderRadius.circular(toDouble());
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

extension PackageX on PackageResponse {
  List<PackageRound> sortedRounds() {
    return rounds.sortedByCompare((e) => e.order, (a, b) => a.compareTo(b));
  }
}

extension PackageRoundX on PackageRound {
  List<PackageTheme> sortedThemes() {
    return themes.sortedByCompare((e) => e.order, (a, b) => a.compareTo(b));
  }
}

extension SocketIOGameStateThemeDataX on SocketIOGameStateThemeData {
  List<SocketIOGameStateQuestionData> sortedQuestions() {
    return questions.sortedByCompare((e) => e.order, (a, b) => a.compareTo(b));
  }
}

extension SocketIOGameStateRoundDataX on SocketIOGameStateRoundData {
  List<SocketIOGameStateThemeData> sortedThemes() {
    return themes.sortedByCompare((e) => e.order, (a, b) => a.compareTo(b));
  }

  SocketIOGameStateRoundData changeQuestion({
    required int? id,
    required SocketIOGameStateQuestionData Function(
      SocketIOGameStateQuestionData value,
    )
    onChange,
  }) {
    if (id == null) return this;

    final themes = List<SocketIOGameStateThemeData>.from(this.themes);
    for (var i = 0; i < themes.length; i++) {
      final theme = themes[i];
      final questions = List<SocketIOGameStateQuestionData>.from(
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

extension SocketIOGameJoinEventPayloadX on SocketIOGameJoinEventPayload {
  PlayerData get me => players.getById(ProfileController.getUser()!.id)!;
  bool get imShowman => me.isShowman;
  bool get imSpectator => me.isSpectator;

  SocketIOGameJoinEventPayload changePlayer({
    required int? id,
    required PlayerData Function(PlayerData value) onChange,
  }) {
    if (id == null) return this;

    final players = List<PlayerData>.from(this.players);
    final playerIndex = players.indexWhere((e) => e.meta.id == id);
    if (playerIndex < 0) return this;
    players[playerIndex] = onChange(players[playerIndex]);

    return copyWith(players: players);
  }
}

extension SocketIOChatMessageEventPayloadX on SocketIOChatMessageEventPayload {
  TextMessage toChatMessage() {
    return TextMessage(
      id: uuid,
      text: message,
      createdAt: timestamp,
      authorId: user.toString(),
    );
  }
}

extension BrightnessX on Brightness {
  Brightness get reverse =>
      this == Brightness.light ? Brightness.dark : Brightness.light;
}

extension PlayersX on List<PlayerData> {
  PlayerData? getById(int? id) {
    if (id == null) return null;
    return firstWhereOrNull((e) => e.meta.id == id);
  }
}

extension PackageResponseX on PackageResponse {
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

extension ColorX on Color {
  /// Change color brightness
  /// [amount] is the amount to change the brightness. From -1 to 1.
  /// Positive values will lighten the color, while negative values
  /// will darken it.
  Color withBrightness(double amount) {
    assert(amount >= -1 && amount <= 1, 'Amount must be between -1 and 1');

    final hsl = HSLColor.fromColor(this);
    final hslDark = hsl.withLightness((hsl.lightness + amount).clamp(0.0, 1.0));
    return hslDark.toColor();
  }
}

extension ListX<T> on List<T> {
  T? tryByIndex(int? index) {
    if (index == null) return null;
    if (index > length) return null;
    if (isEmpty) return null;
    return this[index];
  }
}

extension PlayerDataX on PlayerData? {
  bool get isActive => this?.status == PlayerDataStatus.inGame;
  bool get isShowman => this?.role == PlayerRole.showman;
  bool get isPlayer => this?.role == PlayerRole.player;
  bool get isSpectator => this?.role == PlayerRole.spectator;
}
