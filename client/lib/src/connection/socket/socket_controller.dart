import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:openquester/common_imports.dart' hide LogLevel;
import 'package:socket_io_client/socket_io_client.dart';
import 'package:talker/talker.dart' hide TalkerLogger;

@Singleton(order: 3)
class SocketController {
  static final Uri socketUri = Env.apiUrl;

  /// Registered connections
  final Map<String, Socket> _connections = {};

  /// General socket connection
  late Socket general;

  final ValueNotifier<bool> _paused = ValueNotifier(false);

  @PostConstruct(preResolve: true)
  Future<void> init() async {
    await _connectGeneral();

    // Reconnect on auth change
    getIt<AuthController>().addListener(reconnectGeneral);
    getIt<AppStateController>().appLifecycleState.addListener(
      _appLifecycleListener,
    );
  }

  @disposeMethod
  Future<void> dispose() async {
    for (final socket in _connections.values) {
      socket
        ..disconnect()
        ..dispose();
    }
    _connections.clear();
    getIt<AppStateController>().appLifecycleState.removeListener(
      _appLifecycleListener,
    );
  }

  // Listen to app lifecycle changes
  // and pause/resume connections accordingly
  void _appLifecycleListener() {
    final state = getIt<AppStateController>().appLifecycleState.value;
    if (state == AppLifecycleState.resumed) {
      resumeConnections();
    } else if (state == AppLifecycleState.paused) {
      pauseConnections();
    }
  }

  Future<void> _connectGeneral() async {
    general = await createConnection();
    _registerConnection(general);

    general
      ..connect()
      ..onConnect((data) async {
        onConnect(data);
        await _refreshOnReconnect();
      });
  }

  Future<void> _refreshOnReconnect() async {
    getIt<GamesListController>().pagingController.refresh();
  }

  /// Creates a new socket connection
  Future<Socket> createConnection({String? path, String? id}) async {
    final optionsBuilder = OptionBuilder()
      ..setTransports(['websocket'])
      ..enableForceNewConnection()
      ..disableAutoConnect();
    final options = optionsBuilder.build();
    final url = socketUri
        .replace(path: socketUri.path + (path ?? ''))
        .normalizePath()
        .toString();
    final socket = io(url, options)
      ..id = id ?? path ?? 'general'
      ..onAny(logRequest)
      ..onAnyOutgoing(logOutgoing)
      ..onConnect(onConnect)
      ..onDisconnect((_) => log('onDisconnect'))
      ..onError((e) => log('onError', e))
      ..onReconnectError((e) => log('onReconnectError', e))
      ..onConnectError((e) => log('onConnectError', e));

    _registerConnection(socket);
    return socket;
  }

  /// Registers a socket connection inside the controller
  void _registerConnection(Socket socket) {
    if (!_connections.containsKey(socket.id)) {
      _connections[socket.id!] = socket;
    }
  }

  /// Disconnects all connections temporarily
  void pauseConnections() {
    if (_paused.value) return;
    _paused.value = true;

    for (final socket in _connections.values) {
      if (socket.connected) {
        socket.disconnect();
        log('Paused connection: ${socket.id}');
      }
    }
  }

  /// Reconnects all previously paused connections
  void resumeConnections() {
    if (!_paused.value) return;
    _paused.value = false;

    for (final socket in _connections.values) {
      if (!socket.connected) {
        socket.connect();
        log('Resumed connection: ${socket.id}');
      }
    }
  }

  Future<void> reconnectGeneral() async {
    general
      ..disconnect()
      ..dispose();
    await _connectGeneral();
  }

  static void onConnect(dynamic data) {
    log('onConnect: $data');
  }

  static Future<void> logOutgoing(String event, [dynamic data]) async =>
      logRequest(event, data, outgoing: true);

  static Future<void> logRequest(
    String event,
    dynamic data, {
    bool outgoing = false,
  }) async {
    final logData = data is Map
        ? const JsonEncoder.withIndent('  ').convert(data)
        : data?.toString();

    getIt<TalkerLogger>().talker.logCustom(
      TalkerLog(
        ['[$event]', logData].nonNulls.join('\n'),
        key: outgoing
            ? AppTalkerKeys.socketIoRequest.name
            : AppTalkerKeys.socketIoResponse.name,
        logLevel: LogLevel.verbose,
        time: DateTime.now(),
        title: outgoing ? 'Socket Outgoing' : 'Socket Incoming',
        pen: outgoing ? (AnsiPen()..cyan()) : (AnsiPen()..green()),
      ),
    );
  }

  static void log(String event, [dynamic data = '']) {
    logger.t('SocketController.$event $data');
  }
}
