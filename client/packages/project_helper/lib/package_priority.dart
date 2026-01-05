/// Defines build priority for a package
/// Default priority is 999 for all packages
/// Priority 0 is reserved for the current package (where oqhelper is run)
/// Negative priorities run before current package
/// Positive priorities run after current package
/// Packages with same priority run concurrently
class PackagePriority {
  const PackagePriority(this.packageName, this.priority);

  final String packageName;
  final int priority;

  /// Default priority for packages
  static const int defaultPriority = 999;

  /// Priority for the current package
  static const int currentPackagePriority = 0;
}
