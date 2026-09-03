from django.contrib.auth import get_user_model


def test_custom_user_uses_uuid(db):
    user = get_user_model().objects.create_user(username="tech", password="password")

    assert user.id
    assert str(user._meta.pk.__class__.__name__) == "UUIDField"
