import 'package:openquester/openquester.dart';

Future<void> handleError(Object error, StackTrace stackTrace) async {
  logger.w(error, stackTrace: stackTrace);
  await getIt<ToastController>().show(error);
}
