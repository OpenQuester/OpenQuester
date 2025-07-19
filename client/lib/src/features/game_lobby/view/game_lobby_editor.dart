import 'package:flutter/material.dart';
import 'package:openquester/common_imports.dart';

class GameLobbyEditor extends WatchingWidget {
  const GameLobbyEditor({super.key});

  @override
  Widget build(BuildContext context) {
    final gameData = watchValue((GameLobbyController e) => e.gameData);
    
    return ListView(
      children: [],
    );
  }
}
