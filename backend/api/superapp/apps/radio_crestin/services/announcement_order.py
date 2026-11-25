"""Reordering announcements from the admin list, which may show only some of them.

The list can be filtered, searched or paged, so a drag renumbers just the visible
rows (0, 1, 2, ...). Those rows get back the same set of positions they held, in
their new order; every other announcement keeps its own. Positions stay unique.
"""
from django.db import transaction

from ..models import Announcement
from . import web_deploy
from .announcement_feed import invalidate_cache


def _unique_positions(model) -> dict:
    """{id: position}, first renumbering every row 0..n-1 (same order) if any position is shared."""
    rows = list(model.objects.select_for_update().order_by('position', 'id').values_list('id', 'position'))
    positions = [position for _, position in rows]
    if len(set(positions)) == len(positions):
        return dict(rows)
    for index, (row_id, position) in enumerate(rows):
        if position != index:
            model.objects.filter(id=row_id).update(position=index)
    return {row_id: index for index, (row_id, _) in enumerate(rows)}


def reorder_rows(model, visible_ids_in_new_order, on_commit) -> int:
    """Gives the visible rows of `model` (with a `position`), in their new order, the positions they held.

    Returns how many rows moved. One transaction, rows written with update() (no per-row
    signals); `on_commit` runs once afterwards.
    """
    ids = list(dict.fromkeys(visible_ids_in_new_order))
    with transaction.atomic():
        current = _unique_positions(model)
        ids = [row_id for row_id in ids if row_id in current]
        slots = sorted(current[row_id] for row_id in ids)
        moved = 0
        for row_id, slot in zip(ids, slots):
            if current[row_id] != slot:
                model.objects.filter(id=row_id).update(position=slot)
                moved += 1
        transaction.on_commit(on_commit)
    return moved


def reorder(visible_ids_in_new_order) -> int:
    """Reorders announcements: the cached API list is dropped once, and the website rebuild is scheduled once."""
    moved = reorder_rows(Announcement, visible_ids_in_new_order, invalidate_cache)
    web_deploy.schedule()
    return moved
