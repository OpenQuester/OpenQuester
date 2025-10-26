/// Abstract base logger interface for structured logging across the
/// application.
///
/// Provides different log levels for categorizing messages by importance
/// and detail:
/// - [t] (trace): Very detailed debug information, typically for tracing
///   execution flow
/// - [d] (debug): Detailed information for debugging purposes
/// - [i] (info): General informational messages about application flow
/// - [w] (warning): Warning messages for potentially harmful situations
/// - [e] (error): Error messages for error conditions and exceptions
abstract class BaseLogger {
  /// Log an informational message.
  ///
  /// Use for general application flow, major operations, and user-facing
  /// events.
  /// Example: "User logged in", "File processing started"
  void i(
    dynamic message, {
    DateTime? time,
    Object? error,
    StackTrace? stackTrace,
  });

  /// Log a warning message.
  ///
  /// Use for potentially harmful situations that don't prevent operation.
  /// Example: "Deprecated API used", "File not found but continuing"
  void w(
    dynamic message, {
    DateTime? time,
    Object? error,
    StackTrace? stackTrace,
  });

  /// Log an error message.
  ///
  /// Use for error conditions, exceptions, and operation failures.
  /// Example: "Database connection failed", "File encoding error"
  void e(
    dynamic message, {
    DateTime? time,
    Object? error,
    StackTrace? stackTrace,
  });

  /// Log a trace message.
  ///
  /// Use for very detailed debug information, execution flow tracing,
  /// and fine-grained operation details. Typically the most verbose level.
  /// Example: "Entering function X", "Processing item 1 of 100"
  void t(
    dynamic message, {
    DateTime? time,
    Object? error,
    StackTrace? stackTrace,
  });

  /// Log a debug message.
  ///
  /// Use for detailed information useful during development and debugging.
  /// Example: "Variable value: X", "Intermediate calculation result"
  void d(
    dynamic message, {
    DateTime? time,
    Object? error,
    StackTrace? stackTrace,
  });
}
