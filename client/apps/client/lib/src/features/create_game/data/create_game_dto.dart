import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:openquester/openquester.dart';

part 'create_game_dto.freezed.dart';

@freezed
abstract class CreateGameDto with _$CreateGameDto {
  const factory CreateGameDto({
    PackageListItem? package,
    String? gameName,
    @Default(AgeRestriction.none) AgeRestriction ageRestriction,
    @Default(false) bool private,
    @Default(10) int maxPlayers,

    /// Empty for a private game: the server makes a 4-letter code
    String? password,
    @Default(true) bool falseStart,
    @Default(ButtonPressMode.randomWithinWindow)
    ButtonPressMode buttonPressMode,
    @Default(WrongAnswerPenalty.subtract) WrongAnswerPenalty wrongAnswerPenalty,
  }) = _CreateGameDto;
}

extension CreateGameDtoX on CreateGameDto {
  bool get basicDataPresent {
    return package != null && gameName != null;
  }

  bool get valid {
    if (!basicDataPresent) return false;

    // Check game name length validation
    final nameLength = gameName?.length ?? 0;
    if (nameLength < GameValidationConst.minGameNameLength) return false;
    if (nameLength > GameValidationConst.maxGameNameLength) return false;

    // Check game name regex validation
    if (!GameValidationConst.gameNameRegExp.hasMatch(gameName ?? '')) {
      return false;
    }

    return true;
  }

  GameCreateData toRequestData() {
    // Whitespace only counts as empty: the server then generates a password
    final trimmedPassword = password?.trim() ?? '';

    return GameCreateData(
      title: gameName!,
      packageId: package!.id,
      isPrivate: private,
      ageRestriction: ageRestriction,
      maxPlayers: maxPlayers,
      password: private && trimmedPassword.isNotEmpty ? trimmedPassword : null,
      settings: GameSettingsInput(
        falseStart: falseStart,
        buttonPressMode: buttonPressMode,
        wrongAnswerPenalty: wrongAnswerPenalty,
      ),
    );
  }
}
