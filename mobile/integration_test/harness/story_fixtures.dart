import 'station_catalog.dart';

/// Stories as `GET /stories/` lists them (`backend/docs/stories-api.md`),
/// their media on the fake server [base] (`FakeRadioServer.baseUrl`).
class StoryFixtures {
  StoryFixtures._();

  static const verseSlug = 'e2e-story-verse';
  static const verseTitle = 'Versetul zilei';
  static const teaserSlug = 'e2e-story-teaser';
  static const teaserTitle = 'Concert de Crăciun';
  static const teaserCta = 'Vezi tot concertul';
  static const youtubeUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  static const instagramSlug = 'e2e-story-instagram';
  static const instagramTitle = 'Pe Instagram';
  static const instagramUrl = 'https://www.instagram.com/p/E2Epost01/';
  static const instagramCaption = 'Repetiții pentru concert';
  static const autoSlug = 'e2e-story-auto';
  static const autoTitle = 'Noutăți';
  static const stationCta = 'Ascultă acum';
  static const commentPlaceholder = 'Spune ce te-a încurajat (public)…';
  static const caption = 'În fiecare dimineață, un verset';

  /// Two pictures; the second has a button that plays [Stations.alpha].
  ///
  /// With [comments], it takes public comments with [commentPlaceholder].
  static Map<String, Object?> verse(
    String base, {
    int likeCount = 4,
    bool comments = false,
  }) =>
      _story(
        slug: verseSlug,
        title: verseTitle,
        likeCount: likeCount,
        extra: {
          if (comments)
            'comments': {
              'enabled': true,
              'placeholder': commentPlaceholder,
              'count': 0,
            },
        },
        slides: [
          {..._image(base, 401, seconds: 4), 'caption': caption},
          _image(base, 402, seconds: 4, cta: {
            'style': 'button',
            'label': stationCta,
            'target': {
              'type': 'in_app',
              'route': 'station',
              'slug': Stations.alpha.slug,
            },
          }),
        ],
      );

  /// A short teaser video with sound whose CTA (swipe up and a button)
  /// opens the full video in the YouTube app, else on the web; then a
  /// picture.
  static Map<String, Object?> teaser(String base) => _story(
        slug: teaserSlug,
        title: teaserTitle,
        slides: [
          {
            'id': 411,
            'type': 'video',
            'media_url': '$base/images/story-teaser.mp4',
            'poster_url': '$base/images/story-teaser-poster.png',
            'duration_seconds': 3,
            'orientation': 'portrait',
            'has_sound': true,
            'youtube_url': null,
            'instagram': null,
            'cta': {
              'style': 'both',
              'label': teaserCta,
              'target': {
                'type': 'app_link',
                'app': 'youtube',
                'app_url': youtubeUrl,
                'fallback_url': youtubeUrl,
              },
            },
          },
          _image(base, 412, seconds: 4),
        ],
      );

  /// An Instagram post whose embed [loads] from the fake server, or fails
  /// (nothing answers), which leaves its thumbnail, author and caption.
  static Map<String, Object?> instagram(String base, {bool loads = true}) =>
      _story(
        slug: instagramSlug,
        title: instagramTitle,
        slides: [
          {
            'id': 421,
            'type': 'instagram',
            'media_url': null,
            'poster_url': '$base/images/instagram-thumb.png',
            'duration_seconds': 8,
            'orientation': 'portrait',
            'has_sound': false,
            'youtube_url': null,
            'instagram': {
              'url': instagramUrl,
              'kind': 'post',
              'thumbnail_url': '$base/images/instagram-thumb.png',
              'author_name': 'radiocrestin',
              'caption': instagramCaption,
              'media_url': null,
              'media_type': null,
              'shortcode': 'E2Epost01',
              'embed_url': loads
                  ? '$base/images/instagram-embed/E2Epost01/'
                  // Nothing listens on port 1: the embed can't load.
                  : 'http://127.0.0.1:1/p/E2Epost01/embed/',
            },
            'cta': null,
          },
        ],
      );

  /// A story that opens by itself: due again after [everyActions]
  /// actions, at most [maxShows] times.
  static Map<String, Object?> autoOpen(
    String base, {
    int? everyActions,
    int? everyDays,
    int? maxShows,
  }) =>
      _story(
        slug: autoSlug,
        title: autoTitle,
        display: {
          'auto_open': true,
          'every_days': everyDays,
          'every_actions': everyActions,
          'max_shows': maxShows,
        },
        slides: [_image(base, 431, seconds: 3)],
      );

  static Map<String, Object?> _story({
    required String slug,
    required String title,
    required List<Map<String, Object?>> slides,
    int likeCount = 0,
    Map<String, Object?>? display,
    Map<String, Object?> extra = const {},
  }) =>
      {
        ...extra,
        'id': slug.hashCode & 0xffff,
        'slug': slug,
        'title': title,
        'position': 0,
        'cover_url': null,
        'share_url': 'https://www.radiocrestin.ro/poveste/$slug/',
        'starts_at': null,
        'ends_at': null,
        'updated_at': '2026-11-25T10:00:00Z',
        'like_count': likeCount,
        'filters': {
          'platforms': <String>[],
          'countries_include': <String>[],
          'countries_exclude': <String>[],
          'locales': <String>[],
          'min_app_version': null,
          'max_app_version': null,
        },
        'display': display ??
            {
              'auto_open': false,
              'every_days': null,
              'every_actions': null,
              'max_shows': null,
            },
        'slides': slides,
      };

  static Map<String, Object?> _image(
    String base,
    int id, {
    required int seconds,
    Map<String, Object?>? cta,
  }) =>
      {
        'id': id,
        'type': 'image',
        'media_url': '$base/images/story-$id.png',
        'poster_url': null,
        'duration_seconds': seconds,
        'orientation': 'portrait',
        'has_sound': false,
        'youtube_url': null,
        'instagram': null,
        'width': 1080,
        'height': 1920,
        'cta': cta,
      };
}
