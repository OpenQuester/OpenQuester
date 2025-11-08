import 'package:envied/envied.dart';

part 'env.g.dart';

@Envied(useConstantCase: true)
final class Env {
  @EnviedField()
  static Uri apiUrl = _Env.apiUrl;

  @EnviedField()
  static Uri clientAppUrl = _Env.clientAppUrl;

  @EnviedField()
  static const String discordAuthClientId = _Env.discordAuthClientId;
}
