import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:youtube_player_iframe/youtube_player_iframe.dart';

import '../services/image_cache_service.dart';
import '../services/story.dart';
import '../services/story_viewer_controller.dart';
import '../theme.dart';

/// What a slide tells the viewer while it shows.
class StorySlideEvents {
  const StorySlideEvents({
    required this.onReady,
    required this.onFailed,
    required this.onSound,
    required this.onInteract,
    required this.onOpenLink,
  });

  /// The media is on screen: the slide's timer may run.
  final VoidCallback onReady;

  /// The media could not load: the slide shows what it can, and moves on.
  final VoidCallback onFailed;

  /// Whether the slide plays sound now (the radio steps back meanwhile).
  final ValueChanged<bool> onSound;

  /// The listener plays with an embed: the slide waits for them.
  final VoidCallback onInteract;

  /// A link tapped inside an embed, opened outside the app.
  final ValueChanged<Uri> onOpenLink;
}

/// One slide's media, filling the viewer: a picture, a video, a YouTube
/// video or an Instagram post.
///
/// Media framed like the screen fills it; the rest is letterboxed (a
/// landscape slide on a phone held upright, any slide on a tablet).
class StorySlideView extends StatelessWidget {
  const StorySlideView({
    super.key,
    required this.slide,
    required this.controller,
    required this.events,
    required this.paused,
    required this.muted,
  });

  final StorySlide slide;
  final StoryViewerController controller;
  final StorySlideEvents events;
  final bool paused;
  final bool muted;

  /// How long media may take to load before the slide moves on without
  /// it.
  static const loadTimeout = Duration(seconds: 12);

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final screenPortrait = size.height >= size.width;
    final fit = screenPortrait != slide.landscape &&
            size.shortestSide < 600
        ? BoxFit.cover
        : BoxFit.contain;
    final instagram = slide.instagram;
    return switch (slide.type) {
      StorySlideType.image =>
        StoryImage(url: slide.mediaUrl!, fit: fit, events: events),
      StorySlideType.video => _StoryVideo(
          url: slide.mediaUrl!,
          posterUrl: slide.posterUrl,
          fit: fit,
          sound: slide.hasSound,
          controller: controller,
          events: events,
          paused: paused,
          muted: muted,
        ),
      StorySlideType.youtube => _StoryYoutube(
          slide: slide,
          events: events,
          paused: paused,
          muted: muted,
        ),
      StorySlideType.instagram => instagram!.mediaUrl != null
          ? (instagram.mediaIsVideo
              ? _StoryVideo(
                  url: instagram.mediaUrl!,
                  posterUrl: slide.posterUrl ?? instagram.thumbnailUrl,
                  fit: fit,
                  sound: true,
                  controller: controller,
                  events: events,
                  paused: paused,
                  muted: muted,
                )
              : StoryImage(
                  url: instagram.mediaUrl!, fit: fit, events: events))
          : StoryInstagramEmbed(
              instagram: instagram,
              posterUrl: slide.posterUrl ?? instagram.thumbnailUrl,
              events: events,
            ),
    };
  }
}

/// A picture from the image cache (on disk once loaded), which tells when
/// it is on screen.
class StoryImage extends StatefulWidget {
  const StoryImage({
    super.key,
    required this.url,
    this.fit = BoxFit.cover,
    this.events,
  });

  final String url;
  final BoxFit fit;
  final StorySlideEvents? events;

  @override
  State<StoryImage> createState() => _StoryImageState();
}

class _StoryImageState extends State<StoryImage> {
  File? _file;
  bool _failed = false;
  bool _reported = false;
  Timer? _timeout;

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  @override
  void didUpdateWidget(StoryImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) _resolve();
  }

  @override
  void dispose() {
    _timeout?.cancel();
    super.dispose();
  }

  void _resolve() {
    _file = null;
    _failed = false;
    _reported = false;
    _timeout?.cancel();
    if (widget.events != null) {
      _timeout = Timer(StorySlideView.loadTimeout, _fail);
    }
    ImageCacheService? cache;
    try {
      cache = ImageCacheService.instance;
    } catch (_) {
      cache = null;
    }
    final url = widget.url;
    final kept = cache?.cachedFileSync(url);
    if (kept != null) {
      _file = kept;
      return;
    }
    if (cache == null) return _fail();
    cache.getOrDownload(url).then((file) {
      if (!mounted || url != widget.url) return;
      if (file == null) return _fail();
      setState(() => _file = file);
    });
  }

  void _fail() {
    if (!mounted || _reported) return;
    _reported = true;
    _timeout?.cancel();
    setState(() => _failed = true);
    widget.events?.onFailed();
  }

  void _ready() {
    if (_reported) return;
    _reported = true;
    _timeout?.cancel();
    widget.events?.onReady();
  }

  @override
  Widget build(BuildContext context) {
    final file = _file;
    if (_failed && file == null) return const _MediaFailed();
    if (file == null) return const _MediaLoading();
    return SizedBox.expand(
      child: Image.file(
        file,
        fit: widget.fit,
        gaplessPlayback: true,
        frameBuilder: (context, child, frame, synchronous) {
          if (frame != null) {
            WidgetsBinding.instance.addPostFrameCallback((_) => _ready());
          }
          return child;
        },
        errorBuilder: (context, error, stack) {
          WidgetsBinding.instance.addPostFrameCallback((_) => _fail());
          return const _MediaFailed();
        },
      ),
    );
  }
}

/// A story video: its poster while it loads, then the video, which sets
/// the slide's bar and ends it.
class _StoryVideo extends StatefulWidget {
  const _StoryVideo({
    required this.url,
    required this.posterUrl,
    required this.fit,
    required this.sound,
    required this.controller,
    required this.events,
    required this.paused,
    required this.muted,
  });

  final String url;
  final String? posterUrl;
  final BoxFit fit;
  final bool sound;
  final StoryViewerController controller;
  final StorySlideEvents events;
  final bool paused;
  final bool muted;

  @override
  State<_StoryVideo> createState() => _StoryVideoState();
}

class _StoryVideoState extends State<_StoryVideo> {
  late final VideoPlayerController _video;
  bool _ready = false;
  bool _failed = false;
  bool _ended = false;
  Timer? _timeout;

  @override
  void initState() {
    super.initState();
    _video = VideoPlayerController.networkUrl(
      Uri.parse(widget.url),
      // The radio keeps its audio session; the viewer quiets it instead.
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
    );
    _video.addListener(_onVideo);
    _timeout = Timer(StorySlideView.loadTimeout, _fail);
    unawaited(_start());
  }

  Future<void> _start() async {
    try {
      await _video.initialize();
      await _video.setVolume(widget.muted ? 0 : 1);
      if (!mounted) return;
      _timeout?.cancel();
      setState(() => _ready = true);
      widget.events.onReady();
      _applyPlaying();
    } catch (e) {
      _fail();
    }
  }

  void _fail() {
    if (!mounted || _failed || _ready) return;
    _failed = true;
    _timeout?.cancel();
    setState(() {});
    widget.events.onFailed();
  }

  void _onVideo() {
    final value = _video.value;
    if (!_ready || value.hasError) {
      if (value.hasError) _fail();
      return;
    }
    widget.controller.playerProgress(value.position, value.duration);
    final atEnd = value.duration > Duration.zero &&
        value.position >= value.duration - const Duration(milliseconds: 80);
    if (atEnd && !value.isPlaying && !_ended) {
      _ended = true;
      widget.controller.slideEnded();
    }
  }

  @override
  void didUpdateWidget(_StoryVideo oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.muted != widget.muted && _ready) {
      unawaited(_video.setVolume(widget.muted ? 0 : 1));
    }
    if (oldWidget.paused != widget.paused || oldWidget.muted != widget.muted) {
      _applyPlaying();
    }
  }

  void _applyPlaying() {
    if (!_ready) return;
    final play = !widget.paused;
    widget.events.onSound(play && widget.sound && !widget.muted);
    unawaited(play ? _video.play() : _video.pause());
  }

  @override
  void dispose() {
    _timeout?.cancel();
    _video.removeListener(_onVideo);
    unawaited(_video.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final poster = widget.posterUrl;
    final size = _video.value.size;
    return Stack(
      fit: StackFit.expand,
      children: [
        if (poster != null) StoryImage(url: poster, fit: widget.fit),
        if (_ready && size.width > 0)
          FittedBox(
            fit: widget.fit,
            clipBehavior: Clip.hardEdge,
            child: SizedBox(
              width: size.width,
              height: size.height,
              child: VideoPlayer(_video),
            ),
          ),
        if (!_ready && !_failed && poster == null) const _MediaLoading(),
        if (!_ready && !_failed && poster != null)
          const Center(child: _Spinner()),
        if (_failed && poster == null) const _MediaFailed(),
      ],
    );
  }
}

/// A YouTube video playing inside the slide, under the viewer's own
/// gestures: holding pauses it, the bars and taps move on.
class _StoryYoutube extends StatefulWidget {
  const _StoryYoutube({
    required this.slide,
    required this.events,
    required this.paused,
    required this.muted,
  });

  final StorySlide slide;
  final StorySlideEvents events;
  final bool paused;
  final bool muted;

  @override
  State<_StoryYoutube> createState() => _StoryYoutubeState();
}

class _StoryYoutubeState extends State<_StoryYoutube> {
  late final YoutubePlayerController _yt;
  StreamSubscription<YoutubePlayerValue>? _sub;
  bool _playing = false;
  bool _reported = false;
  Timer? _timeout;

  @override
  void initState() {
    super.initState();
    final id =
        YoutubePlayerController.convertUrlToId(widget.slide.youtubeUrl!) ??
            '';
    _yt = YoutubePlayerController.fromVideoId(
      videoId: id,
      autoPlay: true,
      params: YoutubePlayerParams(
        showControls: false,
        showFullscreenButton: false,
        mute: widget.muted,
        loop: false,
        enableCaption: false,
        privacyEnhancedMode: true,
        strictRelatedVideos: true,
        playsInline: true,
      ),
    );
    _sub = _yt.stream.listen(_onValue);
    _timeout = Timer(StorySlideView.loadTimeout, () {
      if (_reported) return;
      _reported = true;
      widget.events.onFailed();
    });
    if (id.isEmpty) {
      _reported = true;
      WidgetsBinding.instance
          .addPostFrameCallback((_) => widget.events.onFailed());
    }
  }

  void _onValue(YoutubePlayerValue value) {
    final playing = value.playerState == PlayerState.playing;
    if (playing && !_reported) {
      _reported = true;
      _timeout?.cancel();
      widget.events.onReady();
    }
    if (playing != _playing && mounted) {
      setState(() => _playing = playing);
      widget.events.onSound(playing && !widget.muted);
    }
    if (value.playerState == PlayerState.ended) _yt.pauseVideo();
  }

  @override
  void didUpdateWidget(_StoryYoutube oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.paused != widget.paused) {
      unawaited(widget.paused ? _yt.pauseVideo() : _yt.playVideo());
    }
    if (oldWidget.muted != widget.muted) {
      unawaited(widget.muted ? _yt.mute() : _yt.unMute());
      widget.events.onSound(_playing && !widget.muted);
    }
  }

  @override
  void dispose() {
    _timeout?.cancel();
    _sub?.cancel();
    unawaited(_yt.close());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final poster = widget.slide.posterUrl;
    final isShort = widget.slide.youtubeUrl!.contains('/shorts/');
    return Stack(
      fit: StackFit.expand,
      children: [
        if (poster != null)
          StoryImage(url: poster, fit: BoxFit.contain),
        Center(
          child: AspectRatio(
            aspectRatio: isShort ? 9 / 16 : 16 / 9,
            // The viewer's gestures stay the viewer's.
            child: IgnorePointer(
              child: YoutubePlayer(controller: _yt, backgroundColor: Colors.black),
            ),
          ),
        ),
        if (!_reported) const Center(child: _Spinner()),
      ],
    );
  }
}

/// An Instagram post or reel through Instagram's embed page, with the
/// thumbnail while it loads; when the embed fails, the thumbnail, author
/// and caption (`backend/docs/stories-api.md`, "Instagram").
///
/// The listener may scroll it or play a reel in it: touching it holds the
/// slide (the edges still move on).
class StoryInstagramEmbed extends StatefulWidget {
  const StoryInstagramEmbed({
    super.key,
    required this.instagram,
    required this.posterUrl,
    required this.events,
  });

  final StoryInstagram instagram;
  final String? posterUrl;
  final StorySlideEvents events;

  @override
  State<StoryInstagramEmbed> createState() => _StoryInstagramEmbedState();
}

class _StoryInstagramEmbedState extends State<StoryInstagramEmbed> {
  late final WebViewController _web;
  bool _loaded = false;
  bool _failed = false;
  Timer? _timeout;

  /// The embed's page width: Instagram lays its embed out for up to 540 px.
  static const double _maxWidth = 540;

  @override
  void initState() {
    super.initState();
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.black)
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) => _onLoaded(),
        onWebResourceError: (error) {
          if (error.isForMainFrame ?? true) _fail();
        },
        // A link tapped in the embed opens Instagram (or the browser),
        // never a page inside the slide.
        onNavigationRequest: (request) {
          if (!_loaded || !request.isMainFrame) {
            return NavigationDecision.navigate;
          }
          final uri = Uri.tryParse(request.url);
          if (uri != null) widget.events.onOpenLink(uri);
          return NavigationDecision.prevent;
        },
      ));
    _timeout = Timer(StorySlideView.loadTimeout, _fail);
    unawaited(_web.loadRequest(Uri.parse(widget.instagram.embedUrl)));
  }

  void _onLoaded() {
    if (!mounted || _loaded || _failed) return;
    _timeout?.cancel();
    setState(() => _loaded = true);
    widget.events.onReady();
  }

  void _fail() {
    if (!mounted || _loaded || _failed) return;
    _timeout?.cancel();
    setState(() => _failed = true);
    widget.events.onFailed();
  }

  @override
  void dispose() {
    _timeout?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final poster = widget.posterUrl;
    if (_failed) {
      return StoryInstagramCard(
          instagram: widget.instagram, posterUrl: poster);
    }
    return Stack(
      fit: StackFit.expand,
      children: [
        if (poster != null) StoryImage(url: poster, fit: BoxFit.contain),
        Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: _maxWidth),
            child: Listener(
              onPointerDown: (_) => widget.events.onInteract(),
              child: AnimatedOpacity(
                opacity: _loaded ? 1 : 0,
                duration: const Duration(milliseconds: 250),
                child: WebViewWidget(
                  key: const ValueKey('story-instagram-embed'),
                  controller: _web,
                ),
              ),
            ),
          ),
        ),
        if (!_loaded) const Center(child: _Spinner()),
      ],
    );
  }
}

/// An Instagram post shown from what the backend stored: its thumbnail,
/// author and caption. The slide's CTA (or the viewer's "Open in
/// Instagram") opens it.
class StoryInstagramCard extends StatelessWidget {
  const StoryInstagramCard({
    super.key,
    required this.instagram,
    required this.posterUrl,
  });

  final StoryInstagram instagram;
  final String? posterUrl;

  @override
  Widget build(BuildContext context) {
    final poster = posterUrl;
    final text = Theme.of(context).textTheme;
    return Stack(
      fit: StackFit.expand,
      children: [
        if (poster != null)
          StoryImage(url: poster, fit: BoxFit.contain)
        else
          const ColoredBox(color: AppColors.storyBackdrop),
        Align(
          alignment: Alignment.bottomCenter,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 150),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  const Icon(Icons.camera_alt_outlined,
                      color: Colors.white, size: 20),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      instagram.authorName == null
                          ? 'Instagram'
                          : '@${instagram.authorName}',
                      style: text.titleSmall?.copyWith(
                          color: Colors.white, fontWeight: FontWeight.w700),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ]),
                if (instagram.caption != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    instagram.caption!,
                    maxLines: 4,
                    overflow: TextOverflow.ellipsis,
                    style: text.bodyMedium
                        ?.copyWith(color: Colors.white, height: 1.4),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _MediaLoading extends StatelessWidget {
  const _MediaLoading();

  @override
  Widget build(BuildContext context) =>
      const ColoredBox(color: AppColors.storyBackdrop,
          child: Center(child: _Spinner()));
}

class _MediaFailed extends StatelessWidget {
  const _MediaFailed();

  @override
  Widget build(BuildContext context) => const ColoredBox(
        color: AppColors.storyBackdrop,
        child: Center(
          child: Icon(Icons.broken_image_outlined,
              color: Colors.white54, size: 48),
        ),
      );
}

class _Spinner extends StatelessWidget {
  const _Spinner();

  @override
  Widget build(BuildContext context) => const SizedBox(
        width: 32,
        height: 32,
        child: CircularProgressIndicator(
            strokeWidth: 2.5, color: AppColors.primary),
      );
}
