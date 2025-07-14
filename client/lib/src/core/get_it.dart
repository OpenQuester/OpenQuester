import 'package:get_it/get_it.dart';
import 'package:injectable/injectable.dart';

import 'package:openquester/src/core/get_it.config.dart';

final GetIt getIt = GetIt.instance;

@InjectableInit(
  initializerName: 'init', // default
  preferRelativeImports: true, // default
  asExtension: true, // default
)
Future<GetIt> configureDependencies() => getIt.init();
