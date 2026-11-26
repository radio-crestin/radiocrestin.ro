"""What a YouTube or Instagram slide stores about its post, fetched when it is saved (never per request).

embed_details holds the canonical URL it was fetched for plus the details, so a slide
whose link didn't change keeps them, and a changed link fetches again.
"""
from ..models import SlideType, StorySlide
from . import instagram_embeds, youtube_embeds


def details_for(slide: StorySlide, *, refresh: bool = False) -> dict:
    """The slide's embed_details for its current link: kept when still valid, fetched otherwise."""
    known = slide.embed_details or {}
    if slide.type == SlideType.YOUTUBE:
        embed = youtube_embeds.parse(slide.youtube_url)
        if embed is None:
            return {}
        if known.get('url') == embed.url and len(known) > 1 and not refresh:
            return known
        return {'url': embed.url, **youtube_embeds.fetch_details(embed)}
    if slide.type == SlideType.INSTAGRAM:
        post = instagram_embeds.parse(slide.instagram_url)
        if post is None:
            return {}
        if known.get('url') == post.url and len(known) > 1 and not refresh:
            return known
        return {'url': post.url, **instagram_embeds.fetch_details(post)}
    return {}


def refresh(queryset) -> int:
    """Fetches the details of these slides again (Instagram's thumbnail links expire); returns how many changed."""
    changed = 0
    for slide in queryset.filter(type__in=[SlideType.YOUTUBE, SlideType.INSTAGRAM]):
        details = details_for(slide, refresh=True)
        if len(details) > 1 and details != slide.embed_details:
            slide.embed_details = details
            slide.save(update_fields=['embed_details', 'updated_at'])
            changed += 1
    return changed
