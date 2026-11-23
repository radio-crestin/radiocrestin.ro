from django.db import migrations


def restore_spaces(apps, schema_editor):
    # The admin form stripped " - " to "-" on every save (144 of 152 rows on
    # 2026-11-23), which split hyphenated words. No source uses a bare "-".
    apps.get_model('radio_crestin', 'StationsMetadataFetch').objects.filter(
        split_character='-').update(split_character=' - ')


class Migration(migrations.Migration):

    dependencies = [
        ('radio_crestin', '0078_station_audio_gain_db'),
    ]

    operations = [
        migrations.RunPython(restore_spaces, migrations.RunPython.noop),
    ]
