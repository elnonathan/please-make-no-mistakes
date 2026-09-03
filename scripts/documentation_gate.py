#!/usr/bin/env python3
"""Run the public documentation contract."""

from __future__ import annotations

import json
from pathlib import Path

from documentation_contract import validate_repository


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    findings = validate_repository(root)
    print(
        json.dumps(
            {
                "status": "pass" if not findings else "fail",
                "findings": [finding.as_dict() for finding in findings],
            },
            indent=2,
            sort_keys=True,
        )
    )
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())
