// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'response_user.dart';

part 'socket_io_user_change_event_payload.freezed.dart';
part 'socket_io_user_change_event_payload.g.dart';

/// Data sent to subscribed players when a user's information is updated
@Freezed()
abstract class SocketIOUserChangeEventPayload with _$SocketIOUserChangeEventPayload {
  const factory SocketIOUserChangeEventPayload({
    required ResponseUser userData,

    /// When the user change occurred
    required DateTime timestamp,
  }) = _SocketIOUserChangeEventPayload;
  
  factory SocketIOUserChangeEventPayload.fromJson(Map<String, Object?> json) => _$SocketIOUserChangeEventPayloadFromJson(json);
}
