// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:dio/dio.dart';

import 'clients/files_client.dart';
import 'clients/packages_client.dart';
import 'clients/users_client.dart';
import 'clients/auth_client.dart';
import 'clients/games_client.dart';

/// OpenQuester API `v0.15.0`
class RestClient {
  RestClient(
    Dio dio, {
    String? baseUrl,
  })  : _dio = dio,
        _baseUrl = baseUrl;

  final Dio _dio;
  final String? _baseUrl;

  static String get version => '0.15.0';

  FilesClient? _files;
  PackagesClient? _packages;
  UsersClient? _users;
  AuthClient? _auth;
  GamesClient? _games;

  FilesClient get files => _files ??= FilesClient(_dio, baseUrl: _baseUrl);

  PackagesClient get packages => _packages ??= PackagesClient(_dio, baseUrl: _baseUrl);

  UsersClient get users => _users ??= UsersClient(_dio, baseUrl: _baseUrl);

  AuthClient get auth => _auth ??= AuthClient(_dio, baseUrl: _baseUrl);

  GamesClient get games => _games ??= GamesClient(_dio, baseUrl: _baseUrl);
}
