import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:openquester/openquester.dart' hide test;

class _MockLogger extends Mock implements TalkerLogger {}

class _MockApi extends Mock implements Api {}

class _MockRestClient extends Mock implements RestClient {}

class _MockAuthClient extends Mock implements AuthClient {}

void main() {
  late _MockAuthClient authClient;
  late AuthController controller;

  setUp(() async {
    await getIt.reset();
    authClient = _MockAuthClient();
    final restClient = _MockRestClient();
    final api = _MockApi();
    when(() => restClient.auth).thenReturn(authClient);
    when(() => api.api).thenReturn(restClient);
    getIt
      ..registerSingleton<TalkerLogger>(_MockLogger())
      ..registerSingleton<Api>(api);
    controller = AuthController();
    getIt.registerSingleton<AuthController>(controller);
  });

  tearDown(() async => getIt.reset());

  test('reads the Discord application id from the server', () async {
    when(
      authClient.getV1AuthSettings,
    ).thenAnswer(
      (_) async => const ResponseAuthSettings(discordClientId: '42'),
    );

    await controller.loadSettings();

    expect(controller.discordClientId.value, '42');
  });

  test('keeps Discord sign-in off when the server has no id', () async {
    when(
      authClient.getV1AuthSettings,
    ).thenAnswer(
      (_) async => const ResponseAuthSettings(discordClientId: null),
    );

    await controller.loadSettings();

    expect(controller.discordClientId.value, isNull);
  });

  test('Discord sign-in stops before opening Discord without an id', () async {
    when(
      authClient.getV1AuthSettings,
    ).thenAnswer((_) async => const ResponseAuthSettings(discordClientId: ''));

    await expectLater(
      Oauth2AuthType().loginUser(username: null),
      throwsA(isA<UserError>()),
    );
  });
}
