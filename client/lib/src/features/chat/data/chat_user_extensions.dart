import 'package:flutter_chat_core/flutter_chat_core.dart';
import 'package:openquester/common_imports.dart';

extension ChatUserX on User {
  static User fromPlayerData(PlayerData playerData) {
    return User(
      id: playerData.meta.id.toString(),
      name: playerData.meta.username,
      imageSource: playerData.meta.avatar,
    );
  }
}
