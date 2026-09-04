#!/bin/sh
set -eu

uv run --frozen python manage.py migrate --noinput
exec uv run --frozen python manage.py runserver 0.0.0.0:8000
