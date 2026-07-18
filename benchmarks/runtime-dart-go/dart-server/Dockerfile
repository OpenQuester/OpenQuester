FROM dart:stable@sha256:13140e26d84f4fda57cea31942222112aeb2eec10e5e6874c1c0f70beed189ab AS build

WORKDIR /src
COPY pubspec.yaml pubspec.lock ./
RUN dart pub get --enforce-lockfile
COPY bin ./bin
RUN mkdir -p /out && dart compile exe bin/server.dart -o /out/dart-benchmark-server

FROM debian:bookworm-slim@sha256:7b140f374b289a7c2befc338f42ebe6441b7ea838a042bbd5acbfca6ec875818
COPY --from=build /out/dart-benchmark-server /usr/local/bin/dart-benchmark-server
USER 65534:65534
ENTRYPOINT ["/usr/local/bin/dart-benchmark-server"]
