from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import ProtectedError
from rest_framework import permissions, serializers, status
from rest_framework.exceptions import APIException
from rest_framework.response import Response


class Conflict(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Conflict."
    default_code = "conflict"


def django_validation_to_drf(exc):
    if hasattr(exc, "message_dict"):
        return serializers.ValidationError(exc.message_dict)
    if hasattr(exc, "messages"):
        return serializers.ValidationError(exc.messages)
    return serializers.ValidationError(str(exc))


def raise_drf_validation(exc):
    if isinstance(exc, DjangoValidationError):
        raise django_validation_to_drf(exc) from exc
    raise exc


def protected_delete_response(exc: ProtectedError):
    return Response(
        {"detail": "This object cannot be deleted because it is referenced by existing records."},
        status=status.HTTP_409_CONFLICT,
    )


def integrity_error_response(exc: IntegrityError):
    return Response({"detail": "This operation conflicts with existing data."}, status=status.HTTP_409_CONFLICT)


def validate_active(value, field_name):
    if value is not None and hasattr(value, "is_active") and not value.is_active:
        raise serializers.ValidationError({field_name: "Inactive records cannot be selected for new operations."})


class IsAuthenticatedAndStaffForWrites(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return request.user.is_staff
