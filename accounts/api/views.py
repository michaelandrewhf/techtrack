import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    PasswordResetConfirmSerializer,
    PasswordResetMessageSerializer,
    PasswordResetRequestSerializer,
    UserProfileSerializer,
)

logger = logging.getLogger(__name__)

PASSWORD_RESET_RESPONSE = (
    "Se existir uma conta ativa com esse e-mail, enviaremos as instrucoes para redefinir a senha."
)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UserProfileSerializer)
    def get(self, request):
        return Response(UserProfileSerializer(request.user).data)

    @extend_schema(request=UserProfileSerializer, responses=UserProfileSerializer)
    def patch(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        request=PasswordResetRequestSerializer,
        responses={200: PasswordResetMessageSerializer},
    )
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        users = (
            get_user_model()
            .objects.filter(email__iexact=email, is_active=True)
            .exclude(email="")
        )
        for user in users:
            if not user.has_usable_password():
                continue
            self._send_reset_email(user)

        return Response({"message": PASSWORD_RESET_RESPONSE})

    @staticmethod
    def _send_reset_email(user):
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_url = (
            f"{settings.FRONTEND_URL.rstrip('/')}/reset-password/{uid}/{token}"
        )
        context = {
            "display_name": user.get_full_name().strip() or user.username,
            "reset_url": reset_url,
            "timeout_minutes": max(1, settings.PASSWORD_RESET_TIMEOUT // 60),
        }
        subject = "Redefinicao de senha | TechTrack"
        text_body = render_to_string("accounts/password_reset_email.txt", context)
        html_body = render_to_string("accounts/password_reset_email.html", context)
        message = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        message.attach_alternative(html_body, "text/html")

        try:
            message.send(fail_silently=False)
        except Exception:
            logger.exception("Falha ao enviar e-mail de redefinicao de senha.")


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        request=PasswordResetConfirmSerializer,
        responses={200: PasswordResetMessageSerializer},
    )
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"message": "Senha redefinida com sucesso."})
