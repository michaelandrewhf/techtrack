from datetime import date

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from finance.models import ServiceAgreement
from finance.services import generate_service_agreement_receivable


class Command(BaseCommand):
    help = "Gera cobrancas recorrentes idempotentes para a competencia informada."

    def add_arguments(self, parser):
        parser.add_argument(
            "--competence",
            help="Competencia no formato YYYY-MM. Se omitida, usa o mes atual.",
        )

    def handle(self, *args, **options):
        competence_arg = options.get("competence")
        if competence_arg:
            try:
                year_text, month_text = competence_arg.split("-", 1)
                competence = date(int(year_text), int(month_text), 1)
            except (ValueError, TypeError) as exc:
                raise CommandError("Use --competence no formato YYYY-MM.") from exc
        else:
            today = timezone.localdate()
            competence = today.replace(day=1)

        created_count = 0
        existing_count = 0
        skipped_count = 0
        agreements = ServiceAgreement.objects.active().select_related("customer")
        for agreement in agreements.iterator():
            try:
                _, created = generate_service_agreement_receivable(
                    agreement=agreement,
                    competence=competence,
                )
            except ValidationError as exc:
                skipped_count += 1
                self.stderr.write(f"Ignorado {agreement}: {exc}")
                continue
            if created:
                created_count += 1
            else:
                existing_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Competencia {competence:%m/%Y}: {created_count} criadas, "
                f"{existing_count} ja existentes, {skipped_count} ignoradas."
            )
        )
