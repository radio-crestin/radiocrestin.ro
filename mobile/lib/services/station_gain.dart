import 'dart:math' as math;

/// A station's loudness correction (`audio_gain_db`, -20..+20 dB) as the
/// player applies it.
///
/// The backend bakes the gain into the station's live HLS stream, so every
/// station plays at about -16 LUFS there. A direct stream (the station's own
/// Icecast/Shoutcast URL, played as a fallback) has none, so the app applies
/// it itself: HLS ⇄ direct of the same station, and one station to the next,
/// sound the same.
///
/// The gain splits in two, since a player's volume can't go above 1:
/// - [volumeFactor], the part at or below 0 dB: it scales the player's
///   volume, on top of the listener's volume and the sleep timer's fade.
/// - [boostDb], the part above 0 dB: a real gain, where the platform has
///   one with a limiter (Android's LoudnessEnhancer); elsewhere it is not
///   applied, and the station plays at the volume it has (clamped at 1.0).
class StationGain {
  /// The loudness correction the stream plays with, in dB.
  final double db;

  const StationGain(this.db);

  /// No correction.
  static const StationGain none = StationGain(0);

  /// The range the backend accepts (`Stations.audio_gain_db`).
  static const double minDb = -20;
  static const double maxDb = 20;

  /// The `type` of a station's HLS stream in `station_streams`.
  static const String hlsStreamType = 'HLS';

  /// The gain for a stream of [streamType] of a station whose gain is
  /// [stationGainDb].
  ///
  /// None on HLS (the gain is already in the stream), with nothing loaded
  /// (a null type), or when the station has no gain (an API or cache from
  /// before the field: null). Out-of-range or non-finite values are
  /// clamped to the backend's range, or dropped.
  factory StationGain.forStream({
    required double? stationGainDb,
    required String? streamType,
  }) {
    if (streamType == null || streamType == hlsStreamType) return none;
    final db = stationGainDb;
    if (db == null || !db.isFinite || db == 0) return none;
    return StationGain(db.clamp(minDb, maxDb).toDouble());
  }

  /// The gain as an amplitude ratio: 10^(dB/20).
  double get linear => math.pow(10, db / 20).toDouble();

  /// What the player's volume is multiplied by: [linear] up to 1.0.
  double get volumeFactor => db >= 0 ? 1.0 : linear;

  /// The part above 0 dB, for a gain effect with a limiter; 0 when the gain
  /// is 0 or negative.
  double get boostDb => db > 0 ? db : 0;

  @override
  bool operator ==(Object other) => other is StationGain && other.db == db;

  @override
  int get hashCode => db.hashCode;

  @override
  String toString() => 'StationGain(${db}dB)';
}
