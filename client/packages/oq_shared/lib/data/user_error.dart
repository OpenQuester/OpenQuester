class UserError extends Error {
  UserError(this.message);

  final String message;

  @override
  String toString() => message;
}
