from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("finance", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="serviceagreement",
            name="first_billing_competence",
            field=models.DateField(
                blank=True,
                help_text="Primeiro dia do primeiro mes que pode gerar cobranca recorrente.",
                null=True,
            ),
        ),
    ]
