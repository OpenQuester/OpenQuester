import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_chat_ui/flutter_chat_ui.dart' as chat show Composer;
import 'package:openquester/common_imports.dart';

class Composer extends StatefulWidget {
  const Composer({super.key});

  @override
  State<Composer> createState() => _ComposerState();
}

class _ComposerState extends State<Composer> {
  late final textEditingController = TextEditingController();
  late final focusNode = FocusNode();

  @override
  void initState() {
    // Set after frame to override handler in Composer
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => focusNode.onKeyEvent = _handleKeyEvent,
    );
    super.initState();
  }

  @override
  void dispose() {
    textEditingController.dispose();
    focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return chat.Composer(
      attachmentIcon: null,
      focusNode: focusNode,
      textEditingController: textEditingController,
      handleSafeArea: false,
    );
  }

  KeyEventResult _handleKeyEvent(FocusNode node, KeyEvent event) {
    // Check for Enter
    if (event is KeyDownEvent &&
        event.logicalKey == LogicalKeyboardKey.enter &&
        !HardwareKeyboard.instance.isShiftPressed) {
      final text = textEditingController.text.trim();
      if (text.isNotEmpty) {
        unawaited(getIt<SocketChatController>().onSendPressed(text));
        textEditingController.clear();
      }
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }
}
