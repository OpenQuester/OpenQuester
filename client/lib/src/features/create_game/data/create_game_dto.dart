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
    String? password,
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
    return GameCreateData(
      title: gameName!,
      packageId: package!.id,
      isPrivate: private,
      ageRestriction: ageRestriction,
      maxPlayers: maxPlayers,
      password: password,
    );
  }
}
