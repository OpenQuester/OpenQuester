import 'package:flutter/material.dart';
import 'package:flutter_chat_core/flutter_chat_core.dart';
import 'package:openquester/openquester.dart';
import 'package:socket_io_client/socket_io_client.dart';

@singleton
class SocketChatController extends ChangeNotifier {
  InMemoryChatController? chatController;

  User? user;
  Socket? _socket;
  List<User>? _users;

  void clear() {
    _socket?.destroy();
    _socket = null;
    user = null;
    chatController?.dispose();
    chatController = null;
    _users?.clear();
    _users = null;
    notifyListeners();
  }

  @override
  @disposeMethod
  void dispose() {
    clear();
    super.dispose();
  }

  Future<void> init({required Socket socket, List<Message>? messages}) async {
    // Clear before connect
    clear();

    // Init chat controller
    chatController = InMemoryChatController(messages: messages);

    final restUser = ProfileController.getUser();
    if (restUser == null) throw UserError(LocaleKeys.user_unauthorized.tr());

    // Set chat user
    user = User(
      id: restUser.id.toString(),
      name: restUser.username,
      imageSource: restUser.avatar,
    );

    // Setup socket
    _socket = socket;
    _socket?.on(SocketIOEvents.chatMessage.json!, _onChatMessage);

    notifyListeners();
  }

  /// Set chat users
  void setUsers(List<User> users) {
    _users = users;
    notifyListeners();
  }

  Future<void> onSendPressed(String message) async {
    final formatedMessage = message.trim();
    if (formatedMessage.isEmpty) return;

    _socket?.emit(
      SocketIOEvents.chatMessage.json!,
      SocketIOChatMessageContent(message: formatedMessage).toJson(),
    );
  }

  void _onChatMessage(dynamic data) {
    final message = SocketIOChatMessageEventPayload.fromJson(
      data as Map<String, dynamic>,
    );

    final textMessage = message.toChatMessage();
    chatController?.insertMessage(textMessage);
    notifyListeners();
  }

  Future<User?> resolveUser(String id) async {
    return _users?.firstWhereOrNull((e) => e.id == id);
  }
}
