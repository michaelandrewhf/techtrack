from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise RuntimeError(f"Expected snippet not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1))


# Backend model: persist the first competence that may generate a recurring charge.
replace_once(
    "finance/models.py",
    '    billing_day = models.PositiveSmallIntegerField(default=10)\n    notes = models.TextField(blank=True)\n',
    '    billing_day = models.PositiveSmallIntegerField(default=10)\n'
    '    first_billing_competence = models.DateField(\n'
    '        null=True,\n'
    '        blank=True,\n'
    '        help_text="Primeiro dia do primeiro mes que pode gerar cobranca recorrente.",\n'
    '    )\n'
    '    notes = models.TextField(blank=True)\n',
)
replace_once(
    "finance/models.py",
    '        if self.customer_id and self.customer.deleted_at:\n'
    '            raise ValidationError({"customer": "Acordos nao podem ser criados para clientes excluidos."})\n',
    '        if self.customer_id and self.customer.deleted_at:\n'
    '            raise ValidationError({"customer": "Acordos nao podem ser criados para clientes excluidos."})\n'
    '        if self.first_billing_competence and self.first_billing_competence.day != 1:\n'
    '            raise ValidationError(\n'
    '                {"first_billing_competence": "A primeira competencia deve usar o primeiro dia do mes."}\n'
    '            )\n'
    '        if (\n'
    '            self.first_billing_competence\n'
    '            and self.starts_on\n'
    '            and self.first_billing_competence < self.starts_on.replace(day=1)\n'
    '        ):\n'
    '            raise ValidationError(\n'
    '                {"first_billing_competence": "A primeira competencia nao pode ser anterior ao contrato."}\n'
    '            )\n',
)

# Backend services: create contract + optional immediate paid first monthly charge atomically.
replace_once(
    "finance/services.py",
    '    ReceivableStatus,\n)\n',
    '    ReceivableStatus,\n    ServiceAgreement,\n)\n',
)
replace_once(
    "finance/services.py",
    'def _due_date_for_competence(competence, billing_day):\n'
    '    last_day = monthrange(competence.year, competence.month)[1]\n'
    '    return date(competence.year, competence.month, min(billing_day, last_day))\n\n\n',
    'def _due_date_for_competence(competence, billing_day):\n'
    '    last_day = monthrange(competence.year, competence.month)[1]\n'
    '    return date(competence.year, competence.month, min(billing_day, last_day))\n\n\n'
    'def _next_month_competence(value):\n'
    '    if value.month == 12:\n'
    '        return date(value.year + 1, 1, 1)\n'
    '    return date(value.year, value.month + 1, 1)\n\n\n',
)
replace_once(
    "finance/services.py",
    '@transaction.atomic\ndef generate_service_agreement_receivable(*, agreement, competence, created_by=None):\n',
    '@transaction.atomic\n'
    'def create_service_agreement(\n'
    '    *,\n'
    '    attrs,\n'
    '    first_billing_mode=None,\n'
    '    first_payment_method=None,\n'
    '    created_by=None,\n'
    '):\n'
    '    starts_on = attrs["starts_on"]\n'
    '    start_competence = starts_on.replace(day=1)\n'
    '    if first_billing_mode == "receive_now":\n'
    '        first_billing_competence = start_competence\n'
    '    elif first_billing_mode == "next_month":\n'
    '        first_billing_competence = _next_month_competence(start_competence)\n'
    '    elif first_billing_mode is None:\n'
    '        # Backward-compatible API behavior for callers that do not opt into the new flow.\n'
    '        first_billing_competence = start_competence\n'
    '    else:\n'
    '        raise ValidationError("Opcao de primeira mensalidade invalida.")\n\n'
    '    if first_billing_mode == "receive_now" and first_payment_method is None:\n'
    '        raise ValidationError("Informe o metodo de pagamento da primeira mensalidade.")\n\n'
    '    agreement = ServiceAgreement(\n'
    '        **attrs,\n'
    '        first_billing_competence=first_billing_competence,\n'
    '    )\n'
    '    agreement.full_clean()\n'
    '    agreement.save()\n\n'
    '    if first_billing_mode == "receive_now":\n'
    '        today = timezone.localdate()\n'
    '        receivable = Receivable(\n'
    '            customer=agreement.customer,\n'
    '            service_agreement=agreement,\n'
    '            origin=ReceivableOrigin.AGREEMENT,\n'
    '            description=f"{agreement.name} - primeira mensalidade",\n'
    '            reference=f"AGR-{str(agreement.pk)[:8]}-{start_competence:%Y%m}",\n'
    '            competence=start_competence,\n'
    '            issued_at=today,\n'
    '            due_date=today,\n'
    '            amount=agreement.amount,\n'
    '            created_by=created_by,\n'
    '        )\n'
    '        receivable.full_clean()\n'
    '        receivable.save()\n'
    '        register_payment(\n'
    '            receivable=receivable,\n'
    '            amount=agreement.amount,\n'
    '            payment_method=first_payment_method,\n'
    '            paid_at=timezone.now(),\n'
    '            reference="Primeira mensalidade recebida no cadastro",\n'
    '            created_by=created_by,\n'
    '        )\n\n'
    '    return agreement\n\n\n'
    '@transaction.atomic\n'
    'def generate_service_agreement_receivable(*, agreement, competence, created_by=None):\n',
)
replace_once(
    "finance/services.py",
    '    if competence < agreement.starts_on.replace(day=1):\n'
    '        raise ValidationError("A competencia nao pode ser anterior ao inicio do acordo.")\n'
    '    if agreement.ends_on and competence > agreement.ends_on.replace(day=1):\n'
    '        raise ValidationError("A competencia e posterior ao encerramento do acordo.")\n\n'
    '    months_from_start = (competence.year - agreement.starts_on.year) * 12 + competence.month - agreement.starts_on.month\n'
    '    if months_from_start % _frequency_months(agreement.billing_frequency) != 0:\n',
    '    billing_start = agreement.first_billing_competence or agreement.starts_on.replace(day=1)\n'
    '    if competence < billing_start:\n'
    '        raise ValidationError("A competencia e anterior ao primeiro ciclo de cobranca do acordo.")\n'
    '    if agreement.ends_on and competence > agreement.ends_on.replace(day=1):\n'
    '        raise ValidationError("A competencia e posterior ao encerramento do acordo.")\n\n'
    '    months_from_start = (competence.year - billing_start.year) * 12 + competence.month - billing_start.month\n'
    '    if months_from_start % _frequency_months(agreement.billing_frequency) != 0:\n',
)

# API serializer: expose persisted billing start and accept the two creation choices.
replace_once(
    "finance/api/serializers.py",
    'from ..models import BusinessProfile, Payment, Receivable, ServiceAgreement\n',
    'from ..models import BusinessProfile, Payment, Receivable, ServiceAgreement\n'
    'from ..services import create_service_agreement\n',
)
replace_once(
    "finance/api/serializers.py",
    'class ServiceAgreementSerializer(serializers.ModelSerializer):\n'
    '    customer_name = serializers.CharField(source="customer.name", read_only=True)\n\n',
    'class ServiceAgreementSerializer(serializers.ModelSerializer):\n'
    '    customer_name = serializers.CharField(source="customer.name", read_only=True)\n'
    '    first_billing_mode = serializers.ChoiceField(\n'
    '        choices=[("receive_now", "Receber agora"), ("next_month", "Proximo mes")],\n'
    '        required=False,\n'
    '        write_only=True,\n'
    '    )\n'
    '    first_payment_method = serializers.PrimaryKeyRelatedField(\n'
    '        queryset=PaymentMethod.objects.filter(is_active=True),\n'
    '        required=False,\n'
    '        write_only=True,\n'
    '    )\n\n',
)
replace_once(
    "finance/api/serializers.py",
    '            "billing_day",\n'
    '            "notes",\n',
    '            "billing_day",\n'
    '            "first_billing_competence",\n'
    '            "first_billing_mode",\n'
    '            "first_payment_method",\n'
    '            "notes",\n',
)
replace_once(
    "finance/api/serializers.py",
    '        read_only_fields = ["created_at", "updated_at"]\n\n'
    '    def validate(self, attrs):\n'
    '        instance = self.instance or ServiceAgreement()\n'
    '        for key, value in attrs.items():\n'
    '            setattr(instance, key, value)\n'
    '        instance.full_clean()\n'
    '        return attrs\n',
    '        read_only_fields = ["first_billing_competence", "created_at", "updated_at"]\n\n'
    '    def validate(self, attrs):\n'
    '        first_billing_mode = attrs.get("first_billing_mode")\n'
    '        first_payment_method = attrs.get("first_payment_method")\n'
    '        if self.instance is not None and (first_billing_mode or first_payment_method):\n'
    '            raise serializers.ValidationError(\n'
    '                "A opcao da primeira mensalidade so pode ser definida na criacao do contrato."\n'
    '            )\n'
    '        if first_billing_mode == "receive_now" and first_payment_method is None:\n'
    '            raise serializers.ValidationError(\n'
    '                {"first_payment_method": "Informe o metodo de pagamento para receber agora."}\n'
    '            )\n'
    '        if first_billing_mode == "next_month" and first_payment_method is not None:\n'
    '            raise serializers.ValidationError(\n'
    '                {"first_payment_method": "Nao informe pagamento quando a cobranca comecar no proximo mes."}\n'
    '            )\n\n'
    '        instance = self.instance or ServiceAgreement()\n'
    '        for key, value in attrs.items():\n'
    '            if hasattr(instance, key):\n'
    '                setattr(instance, key, value)\n'
    '        instance.full_clean()\n'
    '        return attrs\n\n'
    '    def create(self, validated_data):\n'
    '        first_billing_mode = validated_data.pop("first_billing_mode", None)\n'
    '        first_payment_method = validated_data.pop("first_payment_method", None)\n'
    '        request = self.context.get("request")\n'
    '        created_by = request.user if request and request.user.is_authenticated else None\n'
    '        return create_service_agreement(\n'
    '            attrs=validated_data,\n'
    '            first_billing_mode=first_billing_mode,\n'
    '            first_payment_method=first_payment_method,\n'
    '            created_by=created_by,\n'
    '        )\n',
)

# Migration.
Path("finance/migrations/0002_serviceagreement_first_billing_competence.py").write_text(
    '''from django.db import migrations, models\n\n\nclass Migration(migrations.Migration):\n    dependencies = [("finance", "0001_initial")]\n\n    operations = [\n        migrations.AddField(\n            model_name="serviceagreement",\n            name="first_billing_competence",\n            field=models.DateField(\n                blank=True,\n                help_text="Primeiro dia do primeiro mes que pode gerar cobranca recorrente.",\n                null=True,\n            ),\n        ),\n    ]\n'''
)

# Backend coverage for both first-month choices.
replace_once(
    "finance/tests.py",
    'from finance.models import Receivable, ReceivableStatus, ServiceAgreement\n',
    'from finance.models import Payment, Receivable, ReceivableStatus, ServiceAgreement\n',
)
Path("finance/tests.py").write_text(
    Path("finance/tests.py").read_text()
    + '''\n\ndef test_create_agreement_receive_now_creates_paid_first_month(user, customer, payment_method):\n    today = timezone.localdate()\n    client = APIClient()\n    client.force_authenticate(user=user)\n    response = client.post(\n        "/api/v1/service-agreements/",\n        {\n            "customer": str(customer.pk),\n            "name": "Plano recebido na entrada",\n            "status": "active",\n            "starts_on": today.isoformat(),\n            "billing_frequency": "monthly",\n            "amount": "500.00",\n            "billing_day": 10,\n            "first_billing_mode": "receive_now",\n            "first_payment_method": str(payment_method.pk),\n        },\n        format="json",\n    )\n\n    assert response.status_code == 201, response.data\n    agreement = ServiceAgreement.objects.get(pk=response.data["id"])\n    assert agreement.first_billing_competence == today.replace(day=1)\n    receivable = Receivable.objects.get(service_agreement=agreement)\n    assert receivable.competence == today.replace(day=1)\n    assert receivable.due_date == today\n    assert receivable.status == ReceivableStatus.PAID\n    assert Payment.objects.filter(receivable=receivable, voided_at__isnull=True).count() == 1\n\n\ndef test_create_agreement_next_month_skips_current_competence(user, customer):\n    today = timezone.localdate()\n    current_competence = today.replace(day=1)\n    if current_competence.month == 12:\n        next_competence = date(current_competence.year + 1, 1, 1)\n    else:\n        next_competence = date(current_competence.year, current_competence.month + 1, 1)\n\n    client = APIClient()\n    client.force_authenticate(user=user)\n    response = client.post(\n        "/api/v1/service-agreements/",\n        {\n            "customer": str(customer.pk),\n            "name": "Plano com primeiro vencimento futuro",\n            "status": "active",\n            "starts_on": today.isoformat(),\n            "billing_frequency": "monthly",\n            "amount": "500.00",\n            "billing_day": 10,\n            "first_billing_mode": "next_month",\n        },\n        format="json",\n    )\n\n    assert response.status_code == 201, response.data\n    agreement = ServiceAgreement.objects.get(pk=response.data["id"])\n    assert agreement.first_billing_competence == next_competence\n    assert not Receivable.objects.filter(service_agreement=agreement).exists()\n    with pytest.raises(ValidationError):\n        generate_service_agreement_receivable(agreement=agreement, competence=current_competence)\n\n    receivable, created = generate_service_agreement_receivable(agreement=agreement, competence=next_competence)\n    assert created is True\n    assert receivable.competence == next_competence\n    assert receivable.due_date.day == 10\n\n\ndef test_create_agreement_receive_now_requires_payment_method(user, customer):\n    client = APIClient()\n    client.force_authenticate(user=user)\n    response = client.post(\n        "/api/v1/service-agreements/",\n        {\n            "customer": str(customer.pk),\n            "name": "Plano sem metodo",\n            "status": "active",\n            "starts_on": timezone.localdate().isoformat(),\n            "billing_frequency": "monthly",\n            "amount": "500.00",\n            "billing_day": 10,\n            "first_billing_mode": "receive_now",\n        },\n        format="json",\n    )\n\n    assert response.status_code == 400\n    assert "first_payment_method" in response.data\n'''
)

# Frontend API type.
replace_once(
    "frontend/src/api/types.ts",
    '  billing_day: number;\n  notes: string;\n',
    '  billing_day: number;\n  first_billing_competence: string | null;\n  notes: string;\n',
)

# Customer workspace contract form.
replace_once(
    "frontend/src/pages/CustomerDetailPage.tsx",
    'const agreementSchema = z.object({\n'
    '  name: z.string().min(1, "Informe o nome do contrato."),\n'
    '  description: z.string().optional(),\n'
    '  amount: z.string().min(1, "Informe o valor mensal."),\n'
    '  billing_day: z.string().min(1, "Informe o dia de vencimento."),\n'
    '  starts_on: z.string().min(1, "Informe a data de inicio."),\n'
    '});\n',
    'const agreementSchema = z\n'
    '  .object({\n'
    '    name: z.string().min(1, "Informe o nome do contrato."),\n'
    '    description: z.string().optional(),\n'
    '    amount: z.string().min(1, "Informe o valor mensal."),\n'
    '    billing_day: z.string().min(1, "Informe o dia de vencimento."),\n'
    '    starts_on: z.string().min(1, "Informe a data de inicio."),\n'
    '    first_billing_mode: z.enum(["receive_now", "next_month"]),\n'
    '    first_payment_method: z.string().optional(),\n'
    '  })\n'
    '  .superRefine((data, ctx) => {\n'
    '    if (data.first_billing_mode === "receive_now" && !data.first_payment_method) {\n'
    '      ctx.addIssue({\n'
    '        code: z.ZodIssueCode.custom,\n'
    '        path: ["first_payment_method"],\n'
    '        message: "Selecione o metodo de pagamento.",\n'
    '      });\n'
    '    }\n'
    '  });\n',
)
replace_once(
    "frontend/src/pages/CustomerDetailPage.tsx",
    '    enabled: activeTab === "finance" || modal === "payment",\n',
    '    enabled:\n'
    '      activeTab === "finance" || modal === "payment" || modal === "agreement",\n',
)
replace_once(
    "frontend/src/pages/CustomerDetailPage.tsx",
    '      name: "Suporte mensal",\n'
    '      billing_day: "10",\n'
    '      starts_on: new Date().toISOString().slice(0, 10),\n'
    '    },\n'
    '  });\n',
    '      name: "Suporte mensal",\n'
    '      billing_day: "10",\n'
    '      starts_on: new Date().toISOString().slice(0, 10),\n'
    '      first_billing_mode: "next_month",\n'
    '      first_payment_method: "",\n'
    '    },\n'
    '  });\n'
    '  const firstBillingMode = agreementForm.watch("first_billing_mode");\n',
)
replace_once(
    "frontend/src/pages/CustomerDetailPage.tsx",
    '        billing_day: Number(data.billing_day),\n'
    '        notes: "",\n',
    '        billing_day: Number(data.billing_day),\n'
    '        first_billing_mode: data.first_billing_mode,\n'
    '        first_payment_method:\n'
    '          data.first_billing_mode === "receive_now"\n'
    '            ? data.first_payment_method\n'
    '            : undefined,\n'
    '        notes: "",\n',
)
replace_once(
    "frontend/src/pages/CustomerDetailPage.tsx",
    '        name: "Suporte mensal",\n'
    '        billing_day: "10",\n'
    '        starts_on: new Date().toISOString().slice(0, 10),\n'
    '      });\n',
    '        name: "Suporte mensal",\n'
    '        billing_day: "10",\n'
    '        starts_on: new Date().toISOString().slice(0, 10),\n'
    '        first_billing_mode: "next_month",\n'
    '        first_payment_method: "",\n'
    '      });\n',
)
replace_once(
    "frontend/src/pages/CustomerDetailPage.tsx",
    '          <Field\n'
    '            label="Inicio"\n'
    '            required\n'
    '            error={agreementForm.formState.errors.starts_on?.message}\n'
    '          >\n'
    '            <Input type="date" {...agreementForm.register("starts_on")} />\n'
    '          </Field>\n'
    '          {createAgreement.error ? (\n',
    '          <Field\n'
    '            label="Inicio"\n'
    '            required\n'
    '            error={agreementForm.formState.errors.starts_on?.message}\n'
    '          >\n'
    '            <Input type="date" {...agreementForm.register("starts_on")} />\n'
    '          </Field>\n'
    '          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">\n'
    '            <div className="font-medium text-slate-950 dark:text-white">\n'
    '              Primeira mensalidade\n'
    '            </div>\n'
    '            <div className="mt-3 space-y-3">\n'
    '              <label className="flex cursor-pointer items-start gap-3">\n'
    '                <input\n'
    '                  className="mt-1"\n'
    '                  type="radio"\n'
    '                  value="receive_now"\n'
    '                  {...agreementForm.register("first_billing_mode")}\n'
    '                />\n'
    '                <span>\n'
    '                  <strong className="block text-sm">Receber agora</strong>\n'
    '                  <span className="text-xs text-slate-500">\n'
    '                    Cria a primeira mensalidade com vencimento hoje e registra a baixa como paga.\n'
    '                  </span>\n'
    '                </span>\n'
    '              </label>\n'
    '              <label className="flex cursor-pointer items-start gap-3">\n'
    '                <input\n'
    '                  className="mt-1"\n'
    '                  type="radio"\n'
    '                  value="next_month"\n'
    '                  {...agreementForm.register("first_billing_mode")}\n'
    '                />\n'
    '                <span>\n'
    '                  <strong className="block text-sm">Cobrar no proximo mes</strong>\n'
    '                  <span className="text-xs text-slate-500">\n'
    '                    Nao gera cobranca no mes atual; o primeiro vencimento segue o dia cadastrado no proximo mes.\n'
    '                  </span>\n'
    '                </span>\n'
    '              </label>\n'
    '            </div>\n'
    '          </div>\n'
    '          {firstBillingMode === "receive_now" ? (\n'
    '            <Field\n'
    '              label="Metodo de pagamento da primeira mensalidade"\n'
    '              required\n'
    '              error={agreementForm.formState.errors.first_payment_method?.message}\n'
    '            >\n'
    '              <Select {...agreementForm.register("first_payment_method")}>\n'
    '                <option value="">Selecione</option>\n'
    '                {(paymentMethods.data?.results ?? []).map((method) => (\n'
    '                  <option key={method.id} value={method.id}>\n'
    '                    {method.name}\n'
    '                  </option>\n'
    '                ))}\n'
    '              </Select>\n'
    '            </Field>\n'
    '          ) : null}\n'
    '          <Notice tone="info">\n'
    '            {firstBillingMode === "receive_now"\n'
    '              ? "A entrada sera registrada como recebida hoje. As proximas mensalidades seguirao o dia de vencimento a partir do proximo mes."\n'
    '              : "A primeira cobranca sera gerada somente no proximo mes, usando o dia de vencimento informado."}\n'
    '          </Notice>\n'
    '          {createAgreement.error ? (\n',
)

# Consolidated Finance contract modal gets the same choice.
replace_once(
    "frontend/src/pages/FinancePage.tsx",
    '  const [agreementStart, setAgreementStart] = useState(\n'
    '    new Date().toISOString().slice(0, 10),\n'
    '  );\n',
    '  const [agreementStart, setAgreementStart] = useState(\n'
    '    new Date().toISOString().slice(0, 10),\n'
    '  );\n'
    '  const [agreementBillingMode, setAgreementBillingMode] = useState<\n'
    '    "receive_now" | "next_month"\n'
    '  >("next_month");\n'
    '  const [agreementPaymentMethod, setAgreementPaymentMethod] = useState("");\n',
)
replace_once(
    "frontend/src/pages/FinancePage.tsx",
    '        billing_day: Number(agreementDay),\n'
    '      }),\n',
    '        billing_day: Number(agreementDay),\n'
    '        first_billing_mode: agreementBillingMode,\n'
    '        first_payment_method:\n'
    '          agreementBillingMode === "receive_now"\n'
    '            ? agreementPaymentMethod\n'
    '            : undefined,\n'
    '      }),\n',
)
replace_once(
    "frontend/src/pages/FinancePage.tsx",
    '      setAgreementAmount("");\n'
    '      setAgreementCustomer("");\n'
    '      setAgreementOpen(false);\n',
    '      setAgreementAmount("");\n'
    '      setAgreementCustomer("");\n'
    '      setAgreementBillingMode("next_month");\n'
    '      setAgreementPaymentMethod("");\n'
    '      setAgreementOpen(false);\n',
)
replace_once(
    "frontend/src/pages/FinancePage.tsx",
    '          <Field label="Inicio" required>\n'
    '            <Input\n'
    '              type="date"\n'
    '              value={agreementStart}\n'
    '              onChange={(event) => setAgreementStart(event.target.value)}\n'
    '            />\n'
    '          </Field>\n'
    '          {createAgreement.error ? (\n',
    '          <Field label="Inicio" required>\n'
    '            <Input\n'
    '              type="date"\n'
    '              value={agreementStart}\n'
    '              onChange={(event) => setAgreementStart(event.target.value)}\n'
    '            />\n'
    '          </Field>\n'
    '          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">\n'
    '            <div className="font-medium">Primeira mensalidade</div>\n'
    '            <div className="mt-3 space-y-3">\n'
    '              <label className="flex cursor-pointer items-start gap-3">\n'
    '                <input\n'
    '                  className="mt-1"\n'
    '                  checked={agreementBillingMode === "receive_now"}\n'
    '                  type="radio"\n'
    '                  onChange={() => setAgreementBillingMode("receive_now")}\n'
    '                />\n'
    '                <span>\n'
    '                  <strong className="block text-sm">Receber agora</strong>\n'
    '                  <span className="text-xs text-slate-500">\n'
    '                    Gera a primeira mensalidade hoje e registra a baixa como paga.\n'
    '                  </span>\n'
    '                </span>\n'
    '              </label>\n'
    '              <label className="flex cursor-pointer items-start gap-3">\n'
    '                <input\n'
    '                  className="mt-1"\n'
    '                  checked={agreementBillingMode === "next_month"}\n'
    '                  type="radio"\n'
    '                  onChange={() => setAgreementBillingMode("next_month")}\n'
    '                />\n'
    '                <span>\n'
    '                  <strong className="block text-sm">Cobrar no proximo mes</strong>\n'
    '                  <span className="text-xs text-slate-500">\n'
    '                    Nao gera cobranca agora; o primeiro vencimento usa o dia cadastrado no proximo mes.\n'
    '                  </span>\n'
    '                </span>\n'
    '              </label>\n'
    '            </div>\n'
    '          </div>\n'
    '          {agreementBillingMode === "receive_now" ? (\n'
    '            <Field label="Metodo da primeira mensalidade" required>\n'
    '              <Select\n'
    '                value={agreementPaymentMethod}\n'
    '                onChange={(event) => setAgreementPaymentMethod(event.target.value)}\n'
    '              >\n'
    '                <option value="">Selecione</option>\n'
    '                {(paymentMethods.data?.results ?? []).map((method) => (\n'
    '                  <option key={method.id} value={method.id}>\n'
    '                    {method.name}\n'
    '                  </option>\n'
    '                ))}\n'
    '              </Select>\n'
    '            </Field>\n'
    '          ) : null}\n'
    '          <Notice tone="info">\n'
    '            {agreementBillingMode === "receive_now"\n'
    '              ? "A primeira mensalidade entra como recebida hoje; o ciclo recorrente passa a seguir o vencimento no proximo mes."\n'
    '              : "A primeira mensalidade sera gerada somente no proximo mes."}\n'
    '          </Notice>\n'
    '          {createAgreement.error ? (\n',
)
replace_once(
    "frontend/src/pages/FinancePage.tsx",
    '                !agreementCustomer ||\n'
    '                !agreementAmount ||\n'
    '                createAgreement.isPending\n',
    '                !agreementCustomer ||\n'
    '                !agreementAmount ||\n'
    '                (agreementBillingMode === "receive_now" &&\n'
    '                  !agreementPaymentMethod) ||\n'
    '                createAgreement.isPending\n',
)

# Documentation of the billing rule.
Path("docs/first-month-billing.md").write_text(
    '''# Primeira mensalidade de contratos\n\nAo criar um contrato recorrente, o operador escolhe como tratar a primeira mensalidade:\n\n- **Receber agora**: cria uma conta a receber da competencia inicial com vencimento na data do cadastro e registra um pagamento integral no metodo selecionado. A cobranca fica paga imediatamente.\n- **Cobrar no proximo mes**: nao cria conta a receber no mes atual. A primeira competencia faturavel passa a ser o mes seguinte e usa o `billing_day` do contrato.\n\n`ServiceAgreement.first_billing_competence` guarda o primeiro mes permitido para a geracao recorrente. Contratos antigos, nos quais esse campo e nulo, preservam o comportamento anterior e usam o mes de `starts_on` como ancora.\n\nA restricao unica de `Receivable` por `service_agreement + competence` impede duplicacao da competencia recebida na entrada. O comando `generate_monthly_receivables` continua responsavel pelas competencias recorrentes seguintes e ignora meses anteriores a `first_billing_competence`.\n'''
)

# Remove the temporary patch machinery from the resulting implementation commit.
Path(".github/workflows/apply-first-billing-choice.yml").unlink(missing_ok=True)
Path(".github/scripts/apply_first_billing_choice.py").unlink(missing_ok=True)
