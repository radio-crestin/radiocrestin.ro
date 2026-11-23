import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('radio_crestin', '0077_azuracast_metadata_fetch_category'),
    ]

    operations = [
        migrations.AddField(
            model_name='stations',
            name='audio_gain_db',
            field=models.FloatField(default=0.0, help_text="Volume change applied to the live HLS stream so every station plays about as loud (-16 LUFS). Negative makes the station quieter, positive louder (with a peak limiter). Measure it with backend/streaming/tools/measure_loudness.py. A change restarts the station's stream pod within a minute.", validators=[django.core.validators.MinValueValidator(-20), django.core.validators.MaxValueValidator(20)], verbose_name='Audio Gain (dB)'),
        ),
    ]
