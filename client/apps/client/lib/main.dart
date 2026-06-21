import 'package:flutter/material.dart';
import 'package:openquester/src/core/application/app_init.dart';
import 'package:openquester/src/core/application/application.dart';
import 'package:openquester/src/core/localization.dart';

void main() async {
  await AppInit.init();
  runApp(localizationWrapper(const App()));
}
