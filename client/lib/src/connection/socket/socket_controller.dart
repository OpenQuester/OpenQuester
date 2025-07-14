import 'dart:convert';

import 'package:openquester/common_imports.dart';
import 'package:socket_io_client/socket_io_client.dart';

@Singleton(order: 3)
class SocketController {
  static final Uri socketUri = Env.apiUrl;
  late Socket general;

  @PostConstruct(preResolve: true)
  Future<void> init() async {
    await _connectGeneral();

    // Reconnect on auth change
    getIt<AuthController>().addListener(reconnect);
  }

  Future<void> _connectGeneral() async {
    general = await createConnection();
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

  Future<Socket> createConnection({String? path}) async {
    final optionsBuilder = OptionBuilder()
      ..setTransports(['websocket'])
      ..enableForceNewConnection()
      ..disableAutoConnect();
    final options = optionsBuilder.build();
    final url = socketUri.replace(path: path ?? '').toString();
    final socket = io(url, options)
      ..onAny(logRequest)
      ..onAnyOutgoing(logOutgoing)
      ..onConnect(onConnect)
      ..onDisconnect((_) => log('onDisconnect'))
      ..onError((e) => log('onError', e))
      ..onReconnectError((e) => log('onReconnectError', e))
      ..onConnectError((e) => log('onConnectError', e));

    return socket;
  }

  Future<void> reconnect() async {
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
    final logData = data is Map ? jsonEncode(data) : data.toString();
    log('event', [event, logData].join('\n'));
  }

  static void log(String event, [dynamic data = '']) {
    logger.t('SocketController.$event $data');
  }
}
