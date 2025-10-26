// Export appropriate implementation based on platform
// Exports createBlobUrl function
export 'blob_helper_stub.dart'
    if (dart.library.js_interop) 'blob_helper_web.dart';
