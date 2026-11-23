from django.db import migrations

SLUG = 'azuracast'


def add_category(apps, schema_editor):
    apps.get_model('radio_crestin', 'StationMetadataFetchCategories').objects.get_or_create(slug=SLUG)


def remove_category(apps, schema_editor):
    apps.get_model('radio_crestin', 'StationMetadataFetchCategories').objects.filter(
        slug=SLUG, station_metadata_fetches__isnull=True,
    ).delete()


class Migration(migrations.Migration):
    """Adds the metadata scraper category for AzuraCast's now-playing API (scrapers/azuracast.py)."""

    dependencies = [
        ('radio_crestin', '0076_contact_status_rejected'),
    ]

    operations = [
        migrations.RunPython(add_category, remove_category),
    ]
