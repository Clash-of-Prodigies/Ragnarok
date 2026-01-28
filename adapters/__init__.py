# adapters/__init__.py
from .HouseBamzy import HouseBamzyMatch

__all__ = ["ADAPTERS"]

ADAPTERS = {
    "HouseBamzy": HouseBamzyMatch,
}