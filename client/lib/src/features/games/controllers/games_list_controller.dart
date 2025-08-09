import 'package:openquester/common_imports.dart';
import 'package:socket_io_client/socket_io_client.dart';
import 'package:throttling/throttling.dart';

@Singleton(order: 5)
class GamesListController extends ListControllerBase<GameListItem> {
  String? queryFilter;

  @override
  @PostConstruct(preResolve: true)
  Future<void> init() async {
    await super.init();
    getIt<SocketController>().general
      ..on(SocketIOEvents.games.name, _onSocketEvent)
      // Refresh list on reconnect
      ..onReconnect((_) => pagingController.refresh());
    queryFilter = null;
  }

  @override
  Future<void> dispose() async {
    await super.dispose();
    getIt<SocketController>().general.off(SocketIOEvents.games.name);
    _throttling.close();
  }

  Future<void> _onSocketEvent(dynamic data) async {
    final result = GameEventSubscription.fromJson(data as Map<String, Object?>);
    switch (result) {
      case GameEventSubscriptionUnionCreated():
        await addFirstItem(result.data);
      case GameEventSubscriptionUnionChanged():
        await updateItem(result.data);
      case GameEventSubscriptionUnionStarted():
        await updateItem(result.data);
      case GameEventSubscriptionUnionDeleted():
        await deleteItem(result.data.id);
        _leaveCurrentGameOnDelete(result.data.id);
    }
  }

  void _leaveCurrentGameOnDelete(String gameId) {
    final controller = getIt<GameLobbyController>();
    final currentGameId = controller.gameListData.value?.id;
    if (currentGameId != gameId) return;
    controller.leave(force: true);
  }

  @override
  Future<ListResponse<GameListItem>> getPage(ListRequest request) async {
    final list = await Api.I.api.games.getV1Games(
      limit: request.limit,
      offset: request.offset,
      order: OrderDirection.desc,
      sortBy: GamesSortBy.createdAt,
      titlePrefix: queryFilter,
    );
    return ListResponse(
      list: list.data,
      metadata: ListResponseMeta(total: list.pageInfo.total),
    );
  }

  /// Filters game list by titlePrefix
  /// If [text] is isEmptyOrNull search filter resets
  void search(String? text) {
    queryFilter = text.isEmptyOrNull ? null : text;
    _throttling.throttle(pagingController.refresh);
  }

  final _throttling = Throttling<void>(
    duration: const Duration(milliseconds: 500),
  );

  Future<void> deleteGame(String gameId) async {
    await Api.I.api.games.deleteV1GamesGameId(gameId: gameId);
  }
}
