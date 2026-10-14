"""Initialization module for SQLAlchemy models.

Defines shared imports and base reference for the internal CITAB system.
The actual ORM models are declared in individual files under this package.
"""
from sqlalchemy import MetaData

metadata = MetaData()