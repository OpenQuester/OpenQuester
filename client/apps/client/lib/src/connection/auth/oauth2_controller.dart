import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:oauth2_client/access_token_response.dart';
import 'package:oauth2_client/interfaces.dart';
import 'package:oauth2_client/oauth2_client.dart';
import 'package:openquester/common_imports.dart';
import 'package:universal_io/io.dart';
import 'package:universal_web/web.dart' as web;

@singleton
class Oauth2Controller {
  Future<AccessTokenResponse> auth() async {
    final redirectUri = _getRedirectUrls();
    final client = OAuth2Client(
      authorizeUrl: 'https://discord.com/oauth2/authorize',
      tokenUrl: 'https://discord.com/api/oauth2/token',
      revokeUrl: 'https://discord.com/api/oauth2/token/revoke',
      customUriScheme: redirectUri.$1,
      redirectUri: redirectUri.$2,
    );
    try {
      final result = await client.getTokenWithAuthCodeFlow(
        clientId: Env.discordAuthClientId,
        scopes: ['identify', 'email'],
        webAuthClient: isDesktopPlatform ? IoWebAuth() : null,
      );
      return result;
    } on PlatformException catch (e) {
      throw UserError(e.message ?? e.code);
    }
  }

  (String scheme, String uri) _getRedirectUrls() {
    var scheme = '';
    var uri = '/';

    if (kIsWeb || kIsWasm) {
      final href = Uri.parse(web.window.location.href);
      scheme = href.scheme;
      uri = href.replace(path: '/auth.html').toString();
    } else if (isDesktopPlatform) {
      uri = 'http://localhost:10000';
      scheme = Platform.isMacOS ? 'http' : uri;
    } else {
      scheme = 'com.asion.openquester';
      uri = '$scheme:/';
    }
    return (scheme, uri);
  }
}

class IoWebAuth implements BaseWebAuth {
  @override
  Future<String> authenticate({
    required String callbackUrlScheme,
    required String url,
    required String redirectUrl,
    Map<String, dynamic>? opts,
  }) async {
    final preferEphemeral = (opts?['preferEphemeral'] == true);

    return FlutterWebAuth2.authenticate(
      callbackUrlScheme: callbackUrlScheme,
      url: url,
      options: FlutterWebAuth2Options(
        preferEphemeral: preferEphemeral,
        useWebview: isDesktopPlatform ? false : null,
      ),
    );
  }
}
