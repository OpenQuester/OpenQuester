import 'package:flutter/material.dart';
import 'package:flutter_chat_core/flutter_chat_core.dart';
import 'package:flutter_chat_ui/flutter_chat_ui.dart'
    hide Composer, SimpleTextMessage;
import 'package:openquester/common_imports.dart';

class ChatScreen extends WatchingWidget {
  const ChatScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = watchIt<SocketChatController>();

    if (controller.user == null || controller.chatController == null) {
      return const CircularProgressIndicator().center();
    }

    return Chat(
      chatController: controller.chatController!,
      onMessageSend: controller.onSendPressed,
      currentUserId: controller.user!.id,
      resolveUser: controller.resolveUser,
      theme: ChatTheme.fromThemeData(
        context.theme,
      ).copyWith.colors(surface: Colors.transparent),
      builders: Builders(
        composerBuilder: (context) => const Composer(),
        textMessageBuilder: textMessageBuilder,
        chatAnimatedListBuilder: chatAnimatedListBuilder,
      ),
    );
  }

  Widget chatAnimatedListBuilder(BuildContext context, ChatItem itemBuilder) =>
      ChatAnimatedList(itemBuilder: itemBuilder);

  Widget textMessageBuilder(
    BuildContext context,
    TextMessage message,
    int index, {
    required bool isSentByMe,
    MessageGroupStatus? groupStatus,
  }) {
    return SimpleTextMessage(message: message, index: index);
  }
}
