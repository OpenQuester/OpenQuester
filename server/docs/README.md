# Server Docs

Start with `../src/README.md` for the source layout and layer ownership. Use the guides below when adding backend behavior.

## Developer Guides

- [Server contribution guide](contributing-server.md)
- [How to add a REST endpoint](how-to-add-rest-endpoint.md)
- [How to add a socket game action](how-to-add-socket-action.md)
- [How to add game logic](how-to-add-game-logic.md)

## Existing References

- [Game action executor](game-action-executor.md)
- [WebSocket game flow](websocket-game-flow/README.md)
- [Final round flow](final-round-flow.md)
- [Media download sync](media-download-sync.md)
- [Redis action pipeline notes](redis-lua-and-json-optimization.md)
- [Logging guidelines](logging-guidelines.md)
- [Admin panel](admin-panel.md)

## API Contract

- OpenAPI schema: [`../../openapi/schema.json`](../../openapi/schema.json)
- Keep REST endpoint changes, socket event changes, and DTO shape changes reflected in the schema and in the relevant docs in this folder.
