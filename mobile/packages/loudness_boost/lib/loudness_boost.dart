import 'dart:io' show Platform;

import 'package:flutter/services.dart';

/// Raises an Android audio session's loudness above full volume with the
/// platform's LoudnessEnhancer (a gain with a limiter).
///
/// Android only: elsewhere [apply] does nothing and answers false.
class LoudnessBoost {
  const LoudnessBoost();

  static const MethodChannel _channel =
      MethodChannel('com.radiocrestin.loudness_boost');

  /// Whether the platform can boost at all.
  bool get isSupported => Platform.isAndroid;

  /// Boosts audio session [sessionId] by [gainDb] dB; 0 removes the boost.
  ///
  /// Answers whether the session plays with [gainDb]: false when the device
  /// can't create the effect, there is no session yet, or the platform has
  /// no boost. Never throws.
  Future<bool> apply({required int? sessionId, required double gainDb}) async {
    if (!isSupported) return gainDb <= 0;
    try {
      final applied = await _channel.invokeMethod<bool>('apply', {
        'sessionId': sessionId ?? 0,
        'gainDb': gainDb,
      });
      return applied ?? false;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }
}
