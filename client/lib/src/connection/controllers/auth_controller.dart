import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:openquester/common_imports.dart';

@Singleton(order: 2)
class AuthController extends ChangeNotifier {
  bool get authorized => ProfileController.getUser() != null;

  String? lastUsername;

  @PostConstruct(preResolve: true)
  Future<void> init() async {}

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
    final accessTokenResponse = await getIt<Oauth2Controller>().auth();
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
