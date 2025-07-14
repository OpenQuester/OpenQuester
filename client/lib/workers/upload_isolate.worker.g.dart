// dart format width=80
// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'upload_isolate.dart';

// **************************************************************************
// Generator: WorkerGenerator 7.1.4 (Squadron 7.1.2)
// **************************************************************************

/// Command ids used in operations map
const int _$computeId = 1;

/// WorkerService operations for ParseSiqFile
extension on ParseSiqFile {
  OperationsMap _$getOperations() => OperationsMap({
    _$computeId: ($req) async {
      final String $res;
      try {
        final $dsr = _$Deser(contextAware: false);
        $res = await compute($dsr.$0($req.args[0]));
      } finally {}
      return $res;
    },
  });
}

/// Invoker for ParseSiqFile, implements the public interface to invoke the
/// remote service.
base mixin _$ParseSiqFile$Invoker on Invoker implements ParseSiqFile {
  @override
  Future<String> compute(Uint8List fileData) async {
    final dynamic $res = await send(_$computeId, args: [fileData]);
    try {
      final $dsr = _$Deser(contextAware: false);
      return $dsr.$1($res);
    } finally {}
  }
}

/// Facade for ParseSiqFile, implements other details of the service unrelated to
/// invoking the remote service.
base mixin _$ParseSiqFile$Facade implements ParseSiqFile {}

/// WorkerService class for ParseSiqFile
base class _$ParseSiqFile$WorkerService extends ParseSiqFile
    implements WorkerService {
  _$ParseSiqFile$WorkerService() : super();

  @override
  OperationsMap get operations => _$getOperations();
}

/// Service initializer for ParseSiqFile
WorkerService $ParseSiqFileInitializer(WorkerRequest $req) =>
    _$ParseSiqFile$WorkerService();

/// Worker for ParseSiqFile
base class ParseSiqFileWorker extends Worker
    with _$ParseSiqFile$Invoker, _$ParseSiqFile$Facade
    implements ParseSiqFile {
  ParseSiqFileWorker({
    PlatformThreadHook? threadHook,
    ExceptionManager? exceptionManager,
  }) : super(
         $ParseSiqFileActivator(Squadron.platformType),
         threadHook: threadHook,
         exceptionManager: exceptionManager,
       );

  ParseSiqFileWorker.vm({
    PlatformThreadHook? threadHook,
    ExceptionManager? exceptionManager,
  }) : super(
         $ParseSiqFileActivator(SquadronPlatformType.vm),
         threadHook: threadHook,
         exceptionManager: exceptionManager,
       );

  ParseSiqFileWorker.js({
    PlatformThreadHook? threadHook,
    ExceptionManager? exceptionManager,
  }) : super(
         $ParseSiqFileActivator(SquadronPlatformType.js),
         threadHook: threadHook,
         exceptionManager: exceptionManager,
       );

  ParseSiqFileWorker.wasm({
    PlatformThreadHook? threadHook,
    ExceptionManager? exceptionManager,
  }) : super(
         $ParseSiqFileActivator(SquadronPlatformType.wasm),
         threadHook: threadHook,
         exceptionManager: exceptionManager,
       );

  @override
  List? getStartArgs() => null;
}

/// Worker pool for ParseSiqFile
base class ParseSiqFileWorkerPool extends WorkerPool<ParseSiqFileWorker>
    with _$ParseSiqFile$Facade
    implements ParseSiqFile {
  ParseSiqFileWorkerPool({
    PlatformThreadHook? threadHook,
    ExceptionManager? exceptionManager,
    ConcurrencySettings? concurrencySettings,
  }) : super(
         (ExceptionManager exceptionManager) => ParseSiqFileWorker(
           threadHook: threadHook,
           exceptionManager: exceptionManager,
         ),
         concurrencySettings: concurrencySettings,
         exceptionManager: exceptionManager,
       );

  ParseSiqFileWorkerPool.vm({
    PlatformThreadHook? threadHook,
    ExceptionManager? exceptionManager,
    ConcurrencySettings? concurrencySettings,
  }) : super(
         (ExceptionManager exceptionManager) => ParseSiqFileWorker.vm(
           threadHook: threadHook,
           exceptionManager: exceptionManager,
         ),
         concurrencySettings: concurrencySettings,
         exceptionManager: exceptionManager,
       );

  ParseSiqFileWorkerPool.js({
    PlatformThreadHook? threadHook,
    ExceptionManager? exceptionManager,
    ConcurrencySettings? concurrencySettings,
  }) : super(
         (ExceptionManager exceptionManager) => ParseSiqFileWorker.js(
           threadHook: threadHook,
           exceptionManager: exceptionManager,
         ),
         concurrencySettings: concurrencySettings,
         exceptionManager: exceptionManager,
       );

  ParseSiqFileWorkerPool.wasm({
    PlatformThreadHook? threadHook,
    ExceptionManager? exceptionManager,
    ConcurrencySettings? concurrencySettings,
  }) : super(
         (ExceptionManager exceptionManager) => ParseSiqFileWorker.wasm(
           threadHook: threadHook,
           exceptionManager: exceptionManager,
         ),
         concurrencySettings: concurrencySettings,
         exceptionManager: exceptionManager,
       );

  @override
  Future<String> compute(Uint8List fileData) =>
      execute((w) => w.compute(fileData));
}

final class _$Deser extends MarshalingContext {
  _$Deser({super.contextAware});
  late final $0 = value<Uint8List>();
  late final $1 = value<String>();
}
