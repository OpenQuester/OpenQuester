class GameValidationConst {
  static const int maxGameNameLength = 70;
  static const int minGameNameLength = 3;
  static const int minMaxPlayers = 2;
  static const int maxMaxPlayers = 15;
  static const int maxPasswordLength = 16;

  /// Same rule as the server: letters, digits, `_` and `-`
  static final passwordRegExp = RegExp(r'^[A-Za-z0-9_-]{1,16}$');

  /// Matches any printable Unicode character (including emoji):
  static final gameNameRegExp = RegExp(r'^[^\x00-\x1F]*$', unicode: true);
}
