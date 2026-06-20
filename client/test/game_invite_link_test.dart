import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:openquester/src/features/game_lobby/data/game_invite_link.dart';

void main() {
  group('buildGameInviteUri', () {
    test('uses the canonical game route under the configured app URL', () {
      final uri = buildGameInviteUri(
        gameId: 'abc-123',
        clientAppUrl: Uri.parse('https://app.openquester.test/base'),
      );

      expect(uri.toString(), 'https://app.openquester.test/games/abc-123');
    });

    test('encodes unsafe game id path characters', () {
      final uri = buildGameInviteUri(
        gameId: 'room/with spaces',
        clientAppUrl: Uri.parse('https://app.openquester.test'),
      );

      expect(
        uri.toString(),
        'https://app.openquester.test/games/room%2Fwith%20spaces',
      );
    });
  });

  testWidgets('copy helper does not show a success SnackBar', (tester) async {
    final binding = TestDefaultBinaryMessengerBinding.instance;
    final clipboardCalls = <MethodCall>[];

    binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'Clipboard.setData') {
          clipboardCalls.add(call);
        }

        return null;
      },
    );
    addTearDown(() {
      binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      );
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () async {
                await copyGameInviteLinkToClipboard(
                  context,
                  gameId: 'abc-123',
                );
              },
              child: const Text('Copy'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Copy'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 250));

    expect(clipboardCalls, hasLength(1));
    expect(find.byType(SnackBar), findsNothing);
  });
}
