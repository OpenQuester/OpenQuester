class GameValidationConst {
  static const int maxGameNameLength = 70;
  static const int minGameNameLength = 3;
  static const int minMaxPlayers = 2;
  static const int maxMaxPlayers = 15;
  static const int maxPasswordLength = 16;

  /// Matches any printable Unicode character (including emoji):
  static final gameNameRegExp = RegExp(r'^[^\x00-\x1F]*$', unicode: true);

  /// Matches letters, numbers, underscores and hyphens (backend validation):
  static final passwordRegExp = RegExp(r'^[A-Za-z0-9_-]+$');
}
