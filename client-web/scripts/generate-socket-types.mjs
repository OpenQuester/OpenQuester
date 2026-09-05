import { readFileSync, writeFileSync } from "node:fs";

const schema = JSON.parse(
  readFileSync(new URL("../../openapi/schema.json", import.meta.url), "utf8"),
);
const events = schema["x-socket-io"].events;

function renderMap(name, payloads) {
  const lines = Object.entries(payloads).map(([event, reference]) => {
    if (reference === null) return `  ${JSON.stringify(event)}: undefined;`;
    const component = reference.split("/").at(-1);
    return `  ${JSON.stringify(event)}: components["schemas"][${JSON.stringify(component)}];`;
  });
  return `export type ${name} = {\n${lines.join("\n")}\n};`;
}

function renderNames(name, payloads) {
  const lines = Object.keys(payloads).map(
    (event) => `  ${JSON.stringify(event)},`,
  );
  return `export const ${name} = [\n${lines.join("\n")}\n] as const;`;
}

const output = `// Generated from openapi/schema.json x-socket-io metadata. Do not edit.\nimport type { components } from "../api/schema";\n\n${renderMap("GeneratedClientSocketPayloads", events.clientToServer.eventPayloads)}\n\n${renderMap("GeneratedServerSocketPayloads", events.serverToClient.eventPayloads)}\n\n${renderNames("GENERATED_CLIENT_SOCKET_EVENTS", events.clientToServer.eventPayloads)}\n\n${renderNames("GENERATED_SERVER_SOCKET_EVENTS", events.serverToClient.eventPayloads)}\n`;

writeFileSync(
  new URL("../src/shared/realtime/socket.generated.ts", import.meta.url),
  output,
);
