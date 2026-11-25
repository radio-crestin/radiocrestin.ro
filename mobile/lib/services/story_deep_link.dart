/// The story a link names, from the website's story page
/// (`backend/docs/stories-api.md`, `share_url`):
///
/// - `https://www.radiocrestin.ro/poveste/<slug>/`, the shared link, which
///   Android's App Links and iOS's universal links hand to the app;
/// - `radiocrestin://poveste/<slug>`, the page's "open in app" on iOS.
///
/// Null for any other link, such as a station's (`radiocrestin://<slug>`,
/// `https://www.radiocrestin.ro/<slug>`).
String? storySlugFromUri(Uri uri) {
  final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  final web = uri.scheme == 'http' || uri.scheme == 'https';
  // A custom scheme puts its first part in the host.
  final parts = web || uri.host.isEmpty ? segments : [uri.host, ...segments];
  if (parts.length < 2 || parts.first.toLowerCase() != storyPathSegment) {
    return null;
  }
  final slug = parts[1].toLowerCase();
  return _slug.hasMatch(slug) ? slug : null;
}

/// The path the website's story pages live under.
const storyPathSegment = 'poveste';

/// A story slug, as the API allows it.
final _slug = RegExp(r'^[a-z0-9-]{1,100}$');
