import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:openquester/common_imports.dart';

@Singleton(order: 2)
class AuthController extends ChangeNotifier {
  bool get authorized => ProfileController.getUser() != null;

  String? lastUsername;

  /// Discord application id from the server's sign-in settings, or null
  /// while unknown or when Discord sign-in is off there
  final discordClientId = ValueNotifier<String?>(null);

  @PostConstruct(preResolve: true)
  Future<void> init() async {
    // Don't hold up startup on the network: the button appears once known
    unawaited(loadSettings());
  }

  /// Reads the sign-in settings from the server, so one build works for
  /// every deployment
  Future<void> loadSettings() async {
    try {
      final settings = await Api.I.api.auth.getV1AuthSettings();
      // Providers this build doesn't know arrive as $unknown and are skipped
      final clientId = settings.oauthProviders
          .firstWhereOrNull(
            (p) => p.provider == OauthProviderSettingsProvider.discord,
          )
          ?.clientId
          .trim();
      discordClientId.value = (clientId?.isEmpty ?? true) ? null : clientId;
    } catch (e, s) {
      logger.w(e, stackTrace: s);
    }
  }

  Future<void> loginUser({
    required AuthType auth,
    required String? username,
  }) async {
    try {
      lastUsername = username?.trim();
      getIt<ProfileController>().user.value = await auth.loginUser(
        username: username,
      );

      notifyListeners();

      if (ProfileController.getUser() == null) {
        throw UserError(LocaleKeys.login_authorization_canceled.tr());
      }
    } catch (e, s) {
      logger.w(e, stackTrace: s);
      rethrow;
    }
  }

  Future<void> logOut() async {
    if (!authorized) return;
    getIt<ProfileController>().user.value = null;
    await getIt.get<Api>().api.auth.getV1AuthLogout();
    notifyListeners();
  }
}

abstract class AuthType {
  Future<ResponseUser> loginUser({required String? username});
}

class Oauth2AuthType extends AuthType {
  @override
  Future<ResponseUser> loginUser({required String? username}) async {
    final authController = getIt<AuthController>();
    if (authController.discordClientId.value == null) {
      await authController.loadSettings();
    }
    final clientId = authController.discordClientId.value;
    if (clientId == null) {
      throw UserError(LocaleKeys.login_discord_unavailable.tr());
    }

    final accessTokenResponse = await getIt<Oauth2Controller>().auth(
      clientId: clientId,
    );
    final token = accessTokenResponse.accessToken;

    if (token == null) {
      throw UserError(LocaleKeys.login_authorization_canceled.tr());
    }

    final inputOauthLogin = InputOauthLogin(
      token: token,
      oauthProvider: InputOauthLoginOauthProvider.discord,
      tokenSchema: accessTokenResponse.tokenType,
    );
    return Api.I.api.auth.postV1AuthOauth2(body: inputOauthLogin);
  }
}

class GuestAuthType extends AuthType {
  @override
  Future<ResponseUser> loginUser({required String? username}) async {
    final body = InputGuestLogin(username: username ?? '');
    return Api.I.api.auth.postV1AuthGuest(body: body);
  }
}
