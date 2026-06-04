import orjson
from typing import Any


def dumps(data: Any) -> str:
    return orjson.dumps(data, option=orjson.OPT_SORT_KEYS).decode('utf-8')


def canonical_bytes(data: Any) -> bytes:
    return orjson.dumps(data, option=orjson.OPT_SORT_KEYS)
