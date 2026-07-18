import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:isolate';

import 'package:postgres/postgres.dart';
import 'package:redis/redis.dart';

final _insertEvent = Sql.named('''
INSERT INTO runtime_benchmark.events (
  run_id,
  event_id,
  runtime,
  game_id,
  player_id,
  score_delta,
  payload
) VALUES (
  @run_id,
  @event_id,
  'dart',
  @game_id,
  @player_id,
  @score_delta,
  @payload
)
''');

Future<void> main() async {
  final config = BenchmarkConfig.fromEnvironment();

  for (var worker = 1; worker < config.workers; worker++) {
    await Isolate.spawn(_runWorker, config.toMessage());
  }

  await _runWorker(config.toMessage());
}

Future<void> _runWorker(Map<String, Object?> message) async {
  final config = BenchmarkConfig.fromMessage(message);
  final postgres = Pool.withEndpoints(
    [
      Endpoint(
        host: config.postgresHost,
        port: config.postgresPort,
        database: config.postgresDatabase,
        username: config.postgresUser,
        password: config.postgresPassword,
      ),
    ],
    settings: PoolSettings(
      maxConnectionCount: config.poolSizePerWorker,
      sslMode: SslMode.disable,
    ),
  );

  final redisConnection = RedisConnection();
  final redis = await redisConnection.connect(
    config.redisHost,
    config.redisPort,
  );
  if (config.redisPassword.isNotEmpty) {
    await redis.send_object(['AUTH', config.redisPassword]);
  }
  if (config.redisDatabase != 0) {
    await redis.send_object(['SELECT', config.redisDatabase.toString()]);
  }

  await postgres.execute('CREATE SCHEMA IF NOT EXISTS runtime_benchmark');
  await postgres.execute('''
CREATE TABLE IF NOT EXISTS runtime_benchmark.events (
  run_id text NOT NULL,
  event_id bigint NOT NULL,
  runtime text NOT NULL,
  game_id integer NOT NULL,
  player_id bigint NOT NULL,
  score_delta integer NOT NULL,
  payload text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, runtime, event_id)
)
''');

  final server = await HttpServer.bind(
    InternetAddress.anyIPv4,
    config.port,
    shared: true,
  );

  stdout.writeln(
    'dart worker listening on ${config.port}; '
    'workers=${config.workers}; pool=${config.poolSizePerWorker}',
  );

  await for (final request in server) {
    unawaited(_handleRequest(request, postgres, redis));
  }
}

Future<void> _handleRequest(
  HttpRequest request,
  Pool<Object?> postgres,
  Command redis,
) async {
  try {
    if (request.method == 'GET' && request.uri.path == '/health') {
      request.response
        ..statusCode = HttpStatus.ok
        ..write('ok');
      await request.response.close();
      return;
    }

    if (request.method != 'POST' || request.uri.path != '/event') {
      request.response.statusCode = HttpStatus.notFound;
      await request.response.close();
      return;
    }

    final body = await utf8.decoder.bind(request).join();
    final json = jsonDecode(body) as Map<String, dynamic>;
    final event = BenchmarkEvent.fromJson(json);
    final redisKey = 'openquester:runtime-benchmark:${event.runId}:dart';

    await redis.send_object([
      'HINCRBY',
      redisKey,
      event.gameId.toString(),
      '1',
    ]);
    await postgres.execute(
      _insertEvent,
      parameters: {
        'run_id': event.runId,
        'event_id': event.eventId,
        'game_id': event.gameId,
        'player_id': event.playerId,
        'score_delta': event.scoreDelta,
        'payload': event.payload,
      },
      ignoreRows: true,
    );

    request.response.statusCode = HttpStatus.noContent;
    await request.response.close();
  } catch (_) {
    request.response.statusCode = HttpStatus.internalServerError;
    await request.response.close();
  }
}

final class BenchmarkEvent {
  BenchmarkEvent({
    required this.runId,
    required this.eventId,
    required this.gameId,
    required this.playerId,
    required this.scoreDelta,
    required this.payload,
  });

  factory BenchmarkEvent.fromJson(Map<String, dynamic> json) => BenchmarkEvent(
    runId: json['run_id'] as String,
    eventId: json['event_id'] as int,
    gameId: json['game_id'] as int,
    playerId: json['player_id'] as int,
    scoreDelta: json['score_delta'] as int,
    payload: json['payload'] as String,
  );

  final String runId;
  final int eventId;
  final int gameId;
  final int playerId;
  final int scoreDelta;
  final String payload;
}

final class BenchmarkConfig {
  BenchmarkConfig({
    required this.port,
    required this.workers,
    required this.postgresHost,
    required this.postgresPort,
    required this.postgresDatabase,
    required this.postgresUser,
    required this.postgresPassword,
    required this.totalPoolSize,
    required this.redisHost,
    required this.redisPort,
    required this.redisPassword,
    required this.redisDatabase,
  });

  factory BenchmarkConfig.fromEnvironment() {
    final env = Platform.environment;
    return BenchmarkConfig(
      port: int.parse(env['PORT'] ?? '18080'),
      workers: int.parse(env['APP_WORKERS'] ?? '1'),
      postgresHost: env['POSTGRES_HOST'] ?? '127.0.0.1',
      postgresPort: int.parse(env['POSTGRES_PORT'] ?? '5432'),
      postgresDatabase: env['POSTGRES_DATABASE'] ?? 'postgres',
      postgresUser: env['POSTGRES_USER'] ?? 'admin',
      postgresPassword: env['POSTGRES_PASSWORD'] ?? '',
      totalPoolSize: int.parse(env['DB_POOL_SIZE'] ?? '24'),
      redisHost: env['REDIS_HOST'] ?? '127.0.0.1',
      redisPort: int.parse(env['REDIS_PORT'] ?? '6379'),
      redisPassword: env['REDIS_PASSWORD'] ?? '',
      redisDatabase: int.parse(env['REDIS_DATABASE'] ?? '0'),
    );
  }

  factory BenchmarkConfig.fromMessage(Map<String, Object?> message) =>
      BenchmarkConfig(
        port: message['port']! as int,
        workers: message['workers']! as int,
        postgresHost: message['postgresHost']! as String,
        postgresPort: message['postgresPort']! as int,
        postgresDatabase: message['postgresDatabase']! as String,
        postgresUser: message['postgresUser']! as String,
        postgresPassword: message['postgresPassword']! as String,
        totalPoolSize: message['totalPoolSize']! as int,
        redisHost: message['redisHost']! as String,
        redisPort: message['redisPort']! as int,
        redisPassword: message['redisPassword']! as String,
        redisDatabase: message['redisDatabase']! as int,
      );

  int get poolSizePerWorker => (totalPoolSize / workers).ceil();

  Map<String, Object?> toMessage() => {
    'port': port,
    'workers': workers,
    'postgresHost': postgresHost,
    'postgresPort': postgresPort,
    'postgresDatabase': postgresDatabase,
    'postgresUser': postgresUser,
    'postgresPassword': postgresPassword,
    'totalPoolSize': totalPoolSize,
    'redisHost': redisHost,
    'redisPort': redisPort,
    'redisPassword': redisPassword,
    'redisDatabase': redisDatabase,
  };

  final int port;
  final int workers;
  final String postgresHost;
  final int postgresPort;
  final String postgresDatabase;
  final String postgresUser;
  final String postgresPassword;
  final int totalPoolSize;
  final String redisHost;
  final int redisPort;
  final String redisPassword;
  final int redisDatabase;
}
