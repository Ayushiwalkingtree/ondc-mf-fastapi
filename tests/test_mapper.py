from app.schemas.mf import SearchRequest
from app.services.mf_mapper import MutualFundMapper


def test_search_mapper_builds_payload() -> None:
    payload = MutualFundMapper().build_search(SearchRequest(intent='large cap funds'))
    assert payload['context']['action'] == 'search'
    assert payload['message']['intent']['descriptor']['name'] == 'large cap funds'
