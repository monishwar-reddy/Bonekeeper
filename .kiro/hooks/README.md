# Kiro hooks

This directory is reserved for repository-scoped Kiro lifecycle hooks.

The project currently relies on the repository test and build commands rather
than a destructive hook. Any future hook must remain deterministic, avoid
accessing secrets, and be documented here before it is enabled.
