import 'package:openapi/openapi.dart';

extension OqPackageX on OqPackage {
  static OqPackage get empty => OqPackage(
    id: -1,
    title: '',
    description: '',
    createdAt: DateTime.now(),
    author: const ShortUserInfo(id: -1, username: ''),
    ageRestriction: AgeRestriction.none,
    language: '',
    rounds: [],
    tags: [],
  );
}
