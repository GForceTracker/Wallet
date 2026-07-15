---
name: Manual dict endpoints bypass Pydantic models
description: Some admin endpoints in this FastAPI app hand-build response dicts instead of using response_model, so schema changes silently don't show up there.
---

Not every endpoint that returns wallet/user data uses the `WalletResponse`/`UserResponse` Pydantic models via `response_model=`. At least one admin list endpoint builds a plain dict per user with a hardcoded field list instead.

**Why:** Adding a field to a model/schema does not guarantee every endpoint serializes it — hand-built dicts silently drop new fields (and can already be missing older ones, e.g. `wallet_name` was missing before this was even noticed).

**How to apply:** When adding a field to `Wallet`/`User` and expecting it to show up in the admin UI or any endpoint, grep for how that specific endpoint builds its response. If it manually constructs a dict rather than returning the ORM object through a `response_model`, add the field there explicitly too — don't assume the model change is sufficient.
