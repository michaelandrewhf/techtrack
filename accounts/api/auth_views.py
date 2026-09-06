from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .throttles import LoginRateThrottle, TokenRefreshRateThrottle


class AccessTokenResponseSerializer(serializers.Serializer):
    access = serializers.CharField()


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=settings.AUTH_REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=settings.AUTH_REFRESH_COOKIE_MAX_AGE,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        secure=settings.AUTH_REFRESH_COOKIE_SECURE,
        httponly=True,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=settings.AUTH_REFRESH_COOKIE_NAME,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
    )


class CookieTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [LoginRateThrottle]

    @extend_schema(
        request=TokenObtainPairSerializer,
        responses={200: AccessTokenResponseSerializer},
        description=(
            "Autentica o usuario. O access token e retornado no corpo e o refresh token "
            "e armazenado exclusivamente em cookie HttpOnly."
        ),
    )
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        refresh_token = response.data.pop("refresh", None)
        if refresh_token:
            set_refresh_cookie(response, refresh_token)
        return response


class CookieTokenRefreshView(TokenRefreshView):
    throttle_classes = [TokenRefreshRateThrottle]

    @extend_schema(
        request=None,
        responses={200: AccessTokenResponseSerializer},
        description="Renova o access token usando o refresh token do cookie HttpOnly.",
    )
    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME)
        if not refresh_token:
            response = Response(
                {"detail": "Sessao expirada.", "code": "refresh_cookie_missing"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            clear_refresh_cookie(response)
            return response

        serializer = self.get_serializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except (TokenError, InvalidToken):
            response = Response(
                {"detail": "Sessao expirada.", "code": "token_not_valid"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            clear_refresh_cookie(response)
            return response

        data = dict(serializer.validated_data)
        rotated_refresh = data.pop("refresh", None)
        response = Response(data, status=status.HTTP_200_OK)
        if rotated_refresh:
            set_refresh_cookie(response, rotated_refresh)
        return response


class TokenLogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        request=None,
        responses={204: None},
        description="Encerra a sessao removendo o cookie HttpOnly de refresh.",
    )
    def post(self, request):
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_refresh_cookie(response)
        return response
