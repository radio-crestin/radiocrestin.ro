import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'live_hls.dart';
import 'media.g.dart';
import 'story_media.g.dart';
import 'network_conditions.dart';
import 'station_catalog.dart';

/// An admin's own announcement icon, as the backend stores an uploaded SVG.
const iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
    '<rect width="24" height="24" rx="6" fill="#0F6E63"/>'
    '<circle cx="12" cy="12" r="6" fill="#ffffff"/></svg>';

/// A request the server answered, or tried to.
class ServedRequest {
  ServedRequest(this.origin, this.path, this.station, this.at);

  final Origin origin;
  final String path;

  /// The station whose stream it was for, if any.
  final String? station;
  final DateTime at;

  /// Response body bytes sent so far; grows while a stream plays.
  int bytesSent = 0;

  /// The body the app posted, if any.
  String? body;

  /// The query and the `If-None-Match` and `Range` headers the app sent.
  Map<String, String> query = const {};
  String? ifNoneMatch;
  String? range;

  /// The HTTP method.
  String method = 'GET';

  bool get isMedia => origin == Origin.hls || origin == Origin.mp3;
}

/// Everything the app reaches over the network, served from the test
/// process on the device's loopback: the REST API, the live HLS origin,
/// the stations' MP3 servers, images and the internet probes, each behind
/// the [conditions] a test sets.
class FakeRadioServer {
  FakeRadioServer._(this._server)
      : catalog = StationCatalog('http://127.0.0.1:${_server.port}') {
    _server.listen(_handle);
  }

  static Future<FakeRadioServer> start() async => FakeRadioServer._(
      await HttpServer.bind(InternetAddress.loopbackIPv4, 0));

  final HttpServer _server;
  final StationCatalog catalog;
  final NetworkConditions conditions = NetworkConditions();
  final List<ServedRequest> requests = [];

  /// What `GET /announcements/` lists, as the API's JSON items; empty
  /// unless a test sets it.
  final List<Map<String, Object?>> announcements = [];

  /// The list's `settings`.
  Map<String, Object?> announcementSettings = defaultAnnouncementSettings;

  /// How long `GET /announcements/` takes to answer; the rest of the API
  /// stays fast.
  Duration announcementListDelay = Duration.zero;

  static const defaultAnnouncementSettings = {
    'rotation_mode': 'fixed',
    'max_per_load': 5,
  };

  /// Forms by slug: their question and options, for the form page.
  final Map<String, ({String question, List<String> options})> forms = {};

  /// The events the app reported to `POST /announcements/events/`.
  final List<Map<String, Object?>> announcementEvents = [];

  /// What `GET /stories/` lists, as the API's JSON stories; empty unless
  /// a test sets it.
  final List<Map<String, Object?>> stories = [];

  /// The stories list's `settings`.
  Map<String, Object?> storySettings = const {'auto_open_gap_actions': 0};

  /// The events the app reported to `POST /stories/events/`.
  final List<Map<String, Object?>> storyEvents = [];

  /// Files served under `/images/` in place of the station thumbnail, by
  /// path: real pictures and videos for a recording.
  final Map<String, ({List<int> bytes, String type})> files = {};

  /// Each story's public comments, newest first, as the API keeps them;
  /// `posted` is what the app sent.
  final Map<String, List<Map<String, Object?>>> storyComments = {};

  /// The comments the app posted, as it sent them (refused ones too).
  final List<Map<String, Object?>> postedComments = [];

  /// Answers posting a comment with 429 (its rate limit) when set.
  bool storyCommentsLimited = false;

  /// The stories this device likes, as the API keeps them.
  final Set<String> storyLikes = {};

  /// The events of [type] the app reported for stories.
  List<Map<String, Object?>> storyEventsOf(String type) =>
      storyEvents.where((event) => event['type'] == type).toList();
  final Map<String, LiveHlsStream> _hls = {
    for (final station in Stations.all) station.slug: LiveHlsStream(),
  };

  String get baseUrl => catalog.baseUrl;
  String get host => InternetAddress.loopbackIPv4.address;
  String get apiBaseUrl => '$baseUrl/api/v1';
  Uri get internetProbeUrl => Uri.parse('$baseUrl/probe/generate_204');

  /// The live HLS stream of [station].
  LiveHlsStream hls(FakeStation station) => _hls[station.slug]!;

  /// Media bytes sent for [station] since [since], from [origin] only when
  /// given.
  int mediaBytesSent(
    FakeStation station, {
    required DateTime since,
    Origin? origin,
  }) =>
      requests
          .where((r) =>
              r.isMedia &&
              (origin == null || r.origin == origin) &&
              r.station == station.slug &&
              !r.at.isBefore(since))
          .fold(0, (sum, r) => sum + r.bytesSent);

  /// Back to a healthy network and live streams, between tests.
  void reset() {
    conditions.restore();
    announcements.clear();
    announcementEvents.clear();
    announcementSettings = defaultAnnouncementSettings;
    announcementListDelay = Duration.zero;
    forms.clear();
    stories.clear();
    files.clear();
    storyEvents.clear();
    storyComments.clear();
    postedComments.clear();
    storyCommentsLimited = false;
    storyLikes.clear();
    storySettings = const {'auto_open_gap_actions': 0};
    for (final stream in _hls.values) {
      stream.unfreeze();
    }
  }

  Future<void> close() => _server.close(force: true);

  Future<void> _handle(HttpRequest request) async {
    final path = request.uri.path;
    final origin = _originOf(path);
    final served = ServedRequest(origin, path, _stationOf(request.uri, origin),
        DateTime.now());
    requests.add(served);
    served
      ..query = request.uri.queryParameters
      ..ifNoneMatch = request.headers.value('if-none-match')
      ..range = request.headers.value('range')
      ..method = request.method;
    if (request.method == 'POST') {
      served.body = await utf8.decoder.bind(request).join();
    }
    // The raw socket lets a test drop a connection mid-body, as a real
    // network does, which HttpResponse cannot once headers are out.
    final socket = await request.response.detachSocket(writeHeaders: false);
    final connection = _Connection(socket, served, conditions);
    try {
      if (!await _arrive(connection)) return;
      await _route(request.uri, connection);
    } catch (_) {
      // The link went down mid-body, or the app hung up: a switch, a
      // pause, a timeout.
      connection.drop();
    }
  }

  Origin _originOf(String path) {
    if (path.startsWith('/hls/')) return Origin.hls;
    if (path.startsWith('/mp3/')) return Origin.mp3;
    if (path.startsWith('/images/')) return Origin.images;
    if (path.startsWith('/probe/')) return Origin.internetProbe;
    return Origin.api;
  }

  String? _stationOf(Uri uri, Origin origin) {
    final segments = uri.pathSegments;
    if (segments.length < 2) return null;
    if (origin == Origin.hls) return segments[1];
    if (origin == Origin.mp3) return segments[1].replaceAll('.mp3', '');
    return null;
  }

  /// Applies the link's latency and outage before the response; false when
  /// the request failed there.
  Future<bool> _arrive(_Connection connection) async {
    final origin = connection.served.origin;
    while (true) {
      await conditions.whileSilent(origin);
      final latency = conditions.linkTo(origin).latency;
      if (latency > Duration.zero) await Future<void>.delayed(latency);
      switch (conditions.linkTo(origin).outage) {
        case Outage.refused:
          connection.drop();
          return false;
        case Outage.serverError:
          await connection.status(HttpStatus.serviceUnavailable);
          return false;
        case Outage.notFound:
          await connection.status(HttpStatus.notFound);
          return false;
        case Outage.silent:
          continue;
        case null:
          return true;
      }
    }
  }

  Future<void> _route(Uri uri, _Connection connection) {
    switch (connection.served.origin) {
      case Origin.api:
        return _api(uri, connection);
      case Origin.hls:
        return _hlsRequest(uri, connection);
      case Origin.mp3:
        return _mp3Stream(connection);
      case Origin.images:
        final file = files[uri.path];
        if (file != null) return _ranged(connection, file.bytes, file.type);
        if (uri.path.endsWith('.mp4')) {
          return _ranged(
              connection, base64Decode(storyVideoMp4Base64), 'video/mp4');
        }
        if (uri.path.startsWith('/images/instagram-embed/')) {
          return connection.send(
              utf8.encode(_instagramEmbed(uri.pathSegments[2])),
              'text/html; charset=utf-8');
        }
        if (uri.path.endsWith('.svg')) {
          return connection.send(utf8.encode(iconSvg), 'image/svg+xml');
        }
        return connection.send(
            base64Decode(thumbnailPngBase64), 'image/png');
      case Origin.internetProbe:
        return connection.status(HttpStatus.noContent);
    }
  }

  Future<void> _api(Uri uri, _Connection connection) {
    final path = uri.path;
    if (path == '/api/v1/announcements/') return _announcementList(connection);
    if (path == '/api/v1/stories/') return _storyList(connection);
    final comments = RegExp(r'^/api/v1/stories/([^/]+)/comments/(?:([^/]+)/)?$')
        .firstMatch(path);
    if (comments != null) {
      return _comments(connection, comments.group(1)!, comments.group(2));
    }
    if (path.startsWith('/api/v1/forms/') && path.endsWith('/page/')) {
      return connection.send(
          utf8.encode(_formPage(uri.pathSegments[3],
              dark: uri.queryParameters['theme'] == 'dark')),
          'text/html; charset=utf-8');
    }
    final body = switch (path) {
      '/api/v1/announcements/events/' =>
        _acceptEvents(connection.served.body),
      '/api/v1/stories/events/' => _acceptStoryEvents(connection.served.body),
      '/api/v1/stories/liked/' => {'liked': storyLikes.toList()},
      _ when path.startsWith('/api/v1/stories/') => stories
          .where((story) => story['slug'] == uri.pathSegments[3])
          .firstOrNull,
      _ when path.startsWith('/api/v1/announcements/') => announcements
          .where((a) => a['slug'] == uri.pathSegments[3])
          .firstOrNull,
      _ when path.startsWith('/api/v1/share-links/') =>
        catalog.shareLinkResponse(uri.pathSegments[3]),
      '/api/v1/stations' => catalog.stationsResponse(),
      '/api/v1/stations-metadata' => catalog.metadataResponse(),
      '/api/v1/station-playlist' =>
        catalog.stationPlaylistResponse(uri.queryParameters['station_slug']),
      '/api/v1/private-stations' => {
          'data': {'stations': <Object>[]},
        },
      '/api/v1/stations-metadata-history' => {
          'data': {'stations_metadata_history': null},
        },
      '/api/v1/devices/register/' => {'data': <String, Object>{}},
      _ => null,
    };
    if (body == null) return connection.status(HttpStatus.notFound);
    return connection.send(
        utf8.encode(jsonEncode(body)), 'application/json; charset=utf-8');
  }

  /// The list as the API caches it: no page markdown (it comes with the
  /// single announcement), an ETag, and 304 when the app has it already.
  /// It is the list as it was when the request arrived, sent after
  /// [announcementListDelay].
  Future<void> _announcementList(_Connection connection) async {
    final body = utf8.encode(jsonEncode({
      'settings': announcementSettings,
      'announcements': [
        for (final item in announcements)
          {
            ...item,
            if (item['page'] case final Map<String, Object?> page)
              'page': {...page}
                ..remove('markdown')
                ..remove('embeds'),
          },
      ],
    }));
    await Future<void>.delayed(announcementListDelay);
    final hash = body.fold<int>(0, (a, b) => (a * 31 + b) & 0x7fffffff);
    final etag = '"${body.length}-$hash"';
    if (connection.served.ifNoneMatch == etag) {
      return connection.status(HttpStatus.notModified);
    }
    return connection.send(body, 'application/json; charset=utf-8',
        headers: {'ETag': etag});
  }

  /// The stories list, with an ETag and 304 like the announcements'.
  Future<void> _storyList(_Connection connection) async {
    final body = utf8.encode(
        jsonEncode({'settings': storySettings, 'stories': stories}));
    final hash = body.fold<int>(0, (a, b) => (a * 31 + b) & 0x7fffffff);
    final etag = '"${body.length}-$hash"';
    if (connection.served.ifNoneMatch == etag) {
      return connection.status(HttpStatus.notModified);
    }
    return connection.send(body, 'application/json; charset=utf-8',
        headers: {'ETag': etag});
  }

  /// Keeps the stories' events, applies likes as the API does
  /// (idempotent per device), and answers with the like counts.
  Map<String, Object?> _acceptStoryEvents(String? body) {
    final events =
        ((jsonDecode(body ?? '{}') as Map)['events'] as List? ?? [])
            .cast<Map<String, Object?>>();
    storyEvents.addAll(events);
    for (final event in events) {
      final slug = event['story'] as String?;
      if (slug == null) continue;
      if (event['type'] == 'like') storyLikes.add(slug);
      if (event['type'] == 'unlike') storyLikes.remove(slug);
    }
    final named = {for (final event in events) event['story'] as String?};
    int baseLikes(String slug) =>
        stories.where((s) => s['slug'] == slug).firstOrNull?['like_count']
            as int? ??
        0;
    return {
      'status': 'ok',
      'accepted': events.length,
      'like_counts': {
        for (final slug in named.whereType<String>())
          slug: baseLikes(slug) + (storyLikes.contains(slug) ? 1 : 0),
      },
      'liked': [
        for (final slug in named.whereType<String>())
          if (storyLikes.contains(slug)) slug,
      ],
    };
  }

  /// A story's comments: the list (GET), a new one (POST), or deleting
  /// one's own (DELETE), as `backend/docs/stories-api.md` has them.
  Future<void> _comments(
      _Connection connection, String slug, String? id) async {
    final list = storyComments.putIfAbsent(slug, () => []);
    final device = connection.served.query['device_id'];
    Map<String, Object?> shown(Map<String, Object?> c) => {
          ...c,
          'mine': c['device_id'] != null && c['device_id'] == device,
        }..remove('device_id');
    Future<void> json(Object body, {int status = 200}) {
      final bytes = utf8.encode(jsonEncode(body));
      connection.head(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': '${bytes.length}',
      });
      return connection.write(bytes).then((_) => connection.end());
    }

    switch (connection.served.method) {
      case 'POST':
        final body = (jsonDecode(connection.served.body ?? '{}') as Map)
            .cast<String, Object?>();
        postedComments.add(body);
        if (storyCommentsLimited) {
          return connection.status(HttpStatus.tooManyRequests);
        }
        final comment = {
          'id': 1000 + postedComments.length,
          'author_name': body['author_name'],
          'text': body['text'],
          'created_at': DateTime.now().toUtc().toIso8601String(),
          'device_id': body['device_id'],
        };
        list.insert(0, comment);
        return json({'comment': {...shown(comment), 'mine': true}},
            status: HttpStatus.created);
      case 'DELETE':
        list.removeWhere((c) => '${c['id']}' == id && c['device_id'] == device);
        return connection.status(HttpStatus.noContent);
      default:
        return json({
          'count': list.length,
          'comments': [for (final c in list) shown(c)],
          'next_before': null,
        });
    }
  }

  /// [video], whole or the byte range asked for: AVPlayer reads an MP4
  /// over HTTP only by ranges.
  Future<void> _ranged(
      _Connection connection, List<int> video, String type) async {
    final range = RegExp(r'bytes=(\d*)-(\d*)')
        .firstMatch(connection.served.range ?? '');
    if (range == null) {
      return connection.send(video, type,
          headers: {'Accept-Ranges': 'bytes'});
    }
    final start = int.tryParse(range.group(1)!) ?? 0;
    final end = min(int.tryParse(range.group(2)!) ?? video.length - 1,
        video.length - 1);
    final part = video.sublist(start, end + 1);
    connection.head(HttpStatus.partialContent, {
      'Content-Type': type,
      'Content-Length': '${part.length}',
      'Content-Range': 'bytes $start-$end/${video.length}',
      'Accept-Ranges': 'bytes',
    });
    await connection.write(part);
    await connection.end();
  }

  /// A page standing in for Instagram's embed of post [code]: its author,
  /// a square picture and a caption, as Instagram lays it out.
  String _instagramEmbed(String code) => '''
<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin: 0; background: #fff; font-family: system-ui, sans-serif; }
  header { padding: 12px; font-weight: 600; }
  .media { width: 100%; aspect-ratio: 1; background: #e91e63; }
  p { padding: 12px; margin: 0; }
</style></head><body>
<header id="author">radiocrestin</header>
<div class="media"></div>
<p>Instagram post $code</p>
</body></html>''';

  /// A form page that tells the app it is ready, as the backend's does,
  /// in the spec's card colors for the theme asked.
  String _formPage(String slug, {required bool dark}) {
    final form = forms[slug] ?? (question: 'Form $slug', options: ['A', 'B']);
    final (surface, text, border) = dark
        ? ('#1A1A1A', '#EDEDED', '#2F2F2F')
        : ('#FFFFFF', '#1A1A1A', '#E7E7E7');
    return '''
<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { margin: 0; padding: 4px 20px; background: $surface; color: $text;
         font-family: system-ui, -apple-system, Roboto, sans-serif; }
  .option { border: 1px solid $border; border-radius: 12px; padding: 14px;
            margin: 10px 0; font-size: 15px; }
</style></head><body>
<h2 id="title">${form.question}</h2>
${form.options.map((option) => '<div class="option">$option</div>').join()}
<script>
  var msg = JSON.stringify({type: "rc-form", event: "ready", slug: "$slug"});
  if (window.RadioCrestinForm) window.RadioCrestinForm.postMessage(msg);
</script>
</body></html>''';
  }

  /// Keeps the events of an events report; the app sends JSON, the
  /// website text/plain, both parsed whatever the Content-Type.
  Map<String, Object?> _acceptEvents(String? body) {
    final events =
        (jsonDecode(body ?? '{}') as Map)['events'] as List? ?? [];
    announcementEvents.addAll(events.cast<Map<String, Object?>>());
    return {'status': 'ok', 'accepted': events.length, 'country': 'RO'};
  }

  Future<void> _hlsRequest(Uri uri, _Connection connection) {
    final stream = _hls[connection.served.station];
    final file = uri.pathSegments.last;
    if (stream == null) return connection.status(HttpStatus.notFound);
    if (file.endsWith('.m3u8')) {
      final start = _startVariants[file];
      if (start == null) return connection.status(HttpStatus.notFound);
      return connection.send(utf8.encode(stream.playlist(start: start)),
          'application/vnd.apple.mpegurl');
    }
    final sequence = int.tryParse(file.replaceAll('.aac', ''));
    if (sequence == null || sequence > stream.liveSequence()) {
      return connection.status(HttpStatus.notFound);
    }
    return connection.send(stream.segment(sequence), 'audio/aac');
  }

  /// The playlists the origin publishes, by where they start the player:
  /// the live one 18 s behind live, and the app's 2- and 5-minute starts.
  static const _startVariants = {
    'index.m3u8': Duration(seconds: 18),
    'index-2m.m3u8': Duration(minutes: 2),
    'index-5m.m3u8': Duration(minutes: 5),
  };

  /// An endless 128 kb/s MP3 stream at its bitrate, after Icecast's
  /// default 64 KB burst on connect: no length, the body ends when the
  /// connection does.
  Future<void> _mp3Stream(_Connection connection) async {
    final audio = base64Decode(mp3LoopBase64);
    const bytesPerSecond = 128000 ~/ 8;
    const burst = 65536;
    var offset = 0;
    List<int> next(int length) {
      final chunk = BytesBuilder(copy: false);
      while (chunk.length < length) {
        final end = min(audio.length, offset + length - chunk.length);
        chunk.add(Uint8List.sublistView(audio, offset, end));
        offset = end % audio.length;
      }
      return chunk.takeBytes();
    }

    connection.head(HttpStatus.ok, {
      'Content-Type': 'audio/mpeg',
      'icy-br': '128',
      'Cache-Control': 'no-cache',
    });
    await connection.write(next(burst));
    while (connection.isOpen) {
      await Future<void>.delayed(const Duration(milliseconds: 250));
      await connection.write(next(bytesPerSecond ~/ 4));
    }
  }
}

/// One request's connection, answered by hand on its raw socket.
class _Connection {
  _Connection(this._socket, this.served, this._conditions) {
    _socket.listen((_) {}, onDone: _close, onError: (_) => _close());
  }

  final Socket _socket;
  final ServedRequest served;
  final NetworkConditions _conditions;
  bool _open = true;

  /// Whether the app still holds the connection.
  bool get isOpen => _open;

  void _close() => _open = false;

  void head(int status, Map<String, String> headers) {
    final lines = [
      'HTTP/1.1 $status ${_reasons[status] ?? 'Status'}',
      for (final MapEntry(:key, :value) in headers.entries) '$key: $value',
      'Connection: close',
      '',
      '',
    ];
    _socket.add(latin1.encode(lines.join('\r\n')));
  }

  /// A response without a body.
  Future<void> status(int status) async {
    head(status, {'Content-Length': '0'});
    await _end();
  }

  /// A whole response with [body].
  Future<void> send(
    List<int> body,
    String contentType, {
    Map<String, String> headers = const {},
  }) async {
    head(HttpStatus.ok, {
      'Content-Type': contentType,
      'Content-Length': '${body.length}',
      'Cache-Control': 'no-store',
      ...headers,
    });
    await write(body);
    await _end();
  }

  /// Writes [bytes] in slices, each meeting the link as it is then: a link
  /// that goes down drops the connection mid-body, a silent one stalls it,
  /// a capped one paces it.
  Future<void> write(List<int> bytes) async {
    const slice = 4096;
    for (var start = 0; start < bytes.length; start += slice) {
      await _conditions.whileSilent(served.origin);
      final link = _conditions.linkTo(served.origin);
      if (link.outage != null) throw const SocketException('link down');
      if (!_open) throw const SocketException('closed by the app');
      final end = min(bytes.length, start + slice);
      _socket.add(bytes.sublist(start, end));
      await _socket.flush();
      served.bytesSent += end - start;
      final cap = link.bytesPerSecond;
      if (cap != null) {
        await Future<void>.delayed(
            Duration(microseconds: (end - start) * 1000000 ~/ cap));
      }
    }
  }

  /// Breaks the connection without a word: a reset, no route.
  void drop() {
    _open = false;
    _socket.destroy();
  }

  /// Ends a response written with [head] and [write].
  Future<void> end() => _end();

  Future<void> _end() async {
    await _socket.flush();
    await _socket.close();
    _open = false;
  }

  static const _reasons = {
    200: 'OK',
    204: 'No Content',
    206: 'Partial Content',
    201: 'Created',
    429: 'Too Many Requests',
    304: 'Not Modified',
    404: 'Not Found',
    503: 'Service Unavailable',
  };
}
