from decimal import Decimal
import pytest
from app.schemas.mf import SearchRequest, SelectRequest
from app.services.mf_mapper import MutualFundMapper
from app.services.transaction_log import _extract_log_metadata, _extract_select_details_from_on_search, _validate_amount_thresholds


def test_search_mapper_builds_payload() -> None:
    payload = MutualFundMapper().build_search(SearchRequest(intent='large cap funds'))
    assert payload['context']['action'] == 'search'
    assert payload['message']['intent']['descriptor']['name'] == 'large cap funds'


def test_lumpsum_select_mapper_builds_fis_210_payload() -> None:
    payload = MutualFundMapper().build_select(
        SelectRequest(
            transaction_id='txn-1',
            provider_id='sellerapp_id',
            item_id='12391',
            fulfillment_id='ff_122',
            amount=Decimal('3000'),
            customer_pan='ARRPP7771N',
            euin='E52432',
            arn='ARN-124567',
            sub_broker_arn='ARN-123456',
            form_id='form_1',
            form_submission_id='submission-1',
            bap_terms_url='https://buyer.example/legal/ondc:fis14/static_terms?v=0.1',
        ),
        bpp_id='api.sellerapp.com',
        bpp_uri='https://api.sellerapp.com/ondc',
    )

    order = payload['message']['order']
    assert payload['context']['action'] == 'select'
    assert order['provider']['id'] == 'sellerapp_id'
    assert order['items'][0]['id'] == '12391'
    assert order['items'][0]['quantity']['selected']['measure'] == {'value': '3000', 'unit': 'INR'}
    assert order['items'][0]['fulfillment_ids'] == ['ff_122']
    assert order['fulfillments'][0]['type'] == 'LUMPSUM'
    assert order['fulfillments'][0]['customer']['person']['id'] == 'pan:arrpp7771n'
    assert order['fulfillments'][0]['agent']['person']['id'] == 'euin:E52432'
    assert order['xinput']['form_response']['submission_id'] == 'submission-1'
    assert order['tags'][0]['descriptor']['code'] == 'BAP_TERMS'

    metadata = _extract_log_metadata('select', payload)
    assert metadata == {
        'bpp_id': 'api.sellerapp.com',
        'bpp_uri': 'https://api.sellerapp.com/ondc',
        'provider_id': 'sellerapp_id',
        'item_id': '12391',
        'fulfillment_id': 'ff_122',
    }


def test_lumpsum_select_mapper_uses_workbench_example_fulfillment_id() -> None:
    payload = MutualFundMapper().build_select(
        SelectRequest(
            transaction_id='txn-1',
            provider_id='sellerapp_id',
            item_id='12391',
            fulfillment_id='ff_122',
            amount=Decimal('3000'),
            customer_pan='ARRPP7771N',
            euin='E52432',
            arn='ARN-124567',
            sub_broker_arn='ARN-123456',
        ),
        bpp_id='staging-automation.ondc.org',
        bpp_uri='https://workbench.ondc.tech/api-service/ONDC:FIS14/2.1.0/seller',
    )

    order = payload['message']['order']
    assert order['items'][0]['fulfillment_ids'] == ['ff_123']
    assert order['fulfillments'][0]['id'] == 'ff_123'
    assert order['fulfillments'][0]['type'] == 'LUMPSUM'


def test_extract_select_details_requires_lumpsum_fulfillment() -> None:
    payload = {
        'context': {'bpp_uri': 'https://seller.example/ondc', 'bpp_id': 'seller.example'},
        'message': {
            'catalog': {
                'providers': [
                    {
                        'id': 'sellerapp_id',
                        'items': [{'id': 'plan-1', 'parent_item_id': 'scheme-1', 'fulfillment_ids': ['ff-lumpsum']}],
                        'fulfillments': [
                            {
                                'id': 'ff-lumpsum',
                                'type': 'LUMPSUM',
                                'tags': [
                                    {
                                        'descriptor': {'code': 'THRESHOLDS'},
                                        'list': [
                                            {'descriptor': {'code': 'AMOUNT_MIN'}, 'value': '1000'},
                                            {'descriptor': {'code': 'AMOUNT_MAX'}, 'value': '5000'},
                                            {'descriptor': {'code': 'AMOUNT_MULTIPLES'}, 'value': '100'},
                                        ],
                                    }
                                ],
                            }
                        ],
                    }
                ]
            }
        },
    }

    details = _extract_select_details_from_on_search(
        payload,
        provider_id='sellerapp_id',
        item_id='plan-1',
        scheme_item_id='scheme-1',
        fulfillment_id=None,
        fulfillment_type='LUMPSUM',
    )

    assert details
    assert details['bpp_uri'] == 'https://seller.example/ondc'
    assert details['fulfillment_id'] == 'ff-lumpsum'
    _validate_amount_thresholds(Decimal('3000'), details['thresholds'])
    with pytest.raises(ValueError):
        _validate_amount_thresholds(Decimal('3050'), details['thresholds'])
