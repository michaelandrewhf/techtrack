from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = "login"


class TokenRefreshRateThrottle(AnonRateThrottle):
    scope = "token_refresh"


class TokenVerifyRateThrottle(AnonRateThrottle):
    scope = "token_verify"


class PasswordResetRateThrottle(AnonRateThrottle):
    scope = "password_reset"


class PasswordResetConfirmRateThrottle(AnonRateThrottle):
    scope = "password_reset_confirm"
