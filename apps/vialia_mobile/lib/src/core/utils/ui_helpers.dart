import 'package:flutter/material.dart';

extension BuildContextUIHelpers on BuildContext {
  void showErrorSnackbar(String message) {
    ScaffoldMessenger.of(this)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
          backgroundColor: Theme.of(this).colorScheme.error,
        ),
      );
  }

  void showSuccessSnackbar(String message) {
    ScaffoldMessenger.of(this)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
          backgroundColor: Theme.of(this).colorScheme.primary,
        ),
      );
  }
}
