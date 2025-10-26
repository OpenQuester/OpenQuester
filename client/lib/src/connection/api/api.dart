import 'package:dio/dio.dart';
import 'package:openquester/common_imports.dart';

@Singleton(order: 1)
class Api {
  static Api get I => getIt<Api>();

  RestClient get api =>
      RestClient(getIt<DioController>().client, baseUrl: Env.apiUrl.toString());

  static String? parseError(Object error) {
    if (error is DioException) {
      if (error.response != null &&
          error.response?.data is Map<String, dynamic>) {
        final data = error.response?.data as Map<String, dynamic>;
        if (data.containsKey('error')) {
          return data['error'] as String;
        }
      }
      return error.message;
    }
    return null;
  }
}
