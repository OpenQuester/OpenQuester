import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:openquester/openquester.dart' hide test;

class _Package extends Mock implements PackageListItem {}

void main() {
  final package = _Package();
  when(() => package.id).thenReturn(1);
  final draft = CreateGameDto(
    package: package,
    gameName: 'Quiz',
    private: true,
  );

  for (final password in [null, '', '   ', '\t\n ']) {
    test('empty trimmed password $password is omitted from the wire', () {
      final json = draft.copyWith(password: password).toRequestData().toJson();
      expect(json.containsKey('password'), isFalse);
      expect(json['isPrivate'], isTrue);
    });
  }

  test('private passwords are trimmed and public games omit them', () {
    final withPassword = draft.copyWith(password: ' code_1 ');
    expect(withPassword.toRequestData().toJson()['password'], 'code_1');
    expect(
      withPassword.copyWith(private: false).toRequestData().toJson(),
      isNot(contains('password')),
    );
  });
}
