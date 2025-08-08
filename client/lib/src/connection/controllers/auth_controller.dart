import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:openquester/common_imports.dart';

@Singleton(order: 2)
class AuthController extends ChangeNotifier {
  bool get authorized => ProfileController.getUser() != null;

  @PostConstruct(preResolve: true)
  Future<void> init() async {}

  Future<void> loginUser() async {
    try {
      final accessTokenResponse = await getIt<Oauth2Controller>().auth();
      final token = accessTokenResponse.accessToken;

      if (token == null) {
        throw UserError(LocaleKeys.authorization_canceled.tr());
      }

      final inputOauthLogin = InputOauthLogin(
        token: token,
        oauthProvider: InputOauthLoginOauthProvider.discord,
        tokenSchema: accessTokenResponse.tokenType,
      );

      getIt<ProfileController>().user.value = await Api.I.api.auth
          .postV1AuthOauth2(body: inputOauthLogin);

      notifyListeners();

      if (ProfileController.getUser() == null) {
        throw UserError(LocaleKeys.authorization_canceled.tr());
      }
    } catch (e, s) {
      logger.w(e, stackTrace: s);
      rethrow;
    }
  }

  Future<void> logOut() async {
    getIt<ProfileController>().user.value = null;
    await getIt.get<Api>().api.auth.getV1AuthLogout();
    notifyListeners();
  }
}
