from decimal import Decimal
import pytest
from pydantic import ValidationError
from app.core.config import get_settings
from app.schemas.mf import ConfirmRequest, InitRequest, SearchRequest, SelectRequest
from app.services.mf_mapper import MutualFundMapper
from app.services.transaction_log import (
    _extract_log_metadata,
    _extract_select_details_from_on_search,
    _validate_amount_thresholds,
    find_transaction_message_sequence,
)


@pytest.fixture(autouse=True)
def clear_settings_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('DEBUG', 'false')
    monkeypatch.setenv('ENABLE_SELECT_NEW_TXN_ID', 'false')
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


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
    assert order['fulfillments'][0]['id'] == 'ff_122'
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


def test_lumpsum_select_mapper_keeps_resolved_workbench_fulfillment_id() -> None:
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
    assert order['items'][0]['fulfillment_ids'] == ['ff_122']
    assert order['fulfillments'][0]['id'] == 'ff_122'
    assert order['fulfillments'][0]['type'] == 'LUMPSUM'


def test_lumpsum_select_mapper_does_not_override_resolved_fulfillment_id() -> None:
    payload = MutualFundMapper().build_select(
        SelectRequest(
            transaction_id='txn-1',
            provider_id='sellerapp_id',
            item_id='12391',
            fulfillment_id='ff_122',
            amount=Decimal('3000'),
            customer_pan='ARRPP7771N',
            arn='ARN-124567',
            raw_overrides={
                'message': {
                    'order': {
                        'items': [{'id': '12391', 'fulfillment_ids': ['ff_123']}],
                        'fulfillments': [{'id': 'ff_123', 'type': 'SIP'}],
                    }
                }
            },
        )
    )

    order = payload['message']['order']
    assert order['items'][0]['fulfillment_ids'] == ['ff_122']
    assert order['fulfillments'][0]['id'] == 'ff_122'
    assert order['fulfillments'][0]['type'] == 'LUMPSUM'


def test_select_mapper_generates_fresh_message_id_over_context_override() -> None:
    payload = MutualFundMapper().build_select(
        SelectRequest(
            transaction_id='txn-1',
            provider_id='sellerapp_id',
            item_id='12391',
            fulfillment_id='ff_122',
            amount=Decimal('3000'),
            customer_pan='ARRPP7771N',
            arn='ARN-124567',
            raw_overrides={'context': {'message_id': 'on-search-message', 'transaction_id': 'wrong-txn'}},
        )
    )

    assert payload['context']['transaction_id'] == 'txn-1'
    assert payload['context']['message_id'] != 'on-search-message'


def test_select_mapper_reuses_search_transaction_id_when_flag_false(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('ENABLE_SELECT_NEW_TXN_ID', 'false')
    get_settings.cache_clear()

    payload = MutualFundMapper().build_select(
        SelectRequest(
            transaction_id='search-txn-1',
            provider_id='sellerapp_id',
            item_id='12391',
            fulfillment_id='ff_122',
            amount=Decimal('3000'),
            customer_pan='ARRPP7771N',
            arn='ARN-124567',
        )
    )

    assert payload['context']['transaction_id'] == 'search-txn-1'


def test_select_mapper_generates_new_transaction_id_when_flag_true(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('ENABLE_SELECT_NEW_TXN_ID', 'true')
    get_settings.cache_clear()

    payload = MutualFundMapper().build_select(
        SelectRequest(
            transaction_id='search-txn-1',
            provider_id='sellerapp_id',
            item_id='12391',
            fulfillment_id='ff_122',
            amount=Decimal('3000'),
            customer_pan='ARRPP7771N',
            arn='ARN-124567',
        )
    )

    assert payload['context']['transaction_id'] != 'search-txn-1'


def test_select_request_requires_transaction_id_when_new_txn_flag_false(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv('ENABLE_SELECT_NEW_TXN_ID', 'false')
    get_settings.cache_clear()

    with pytest.raises(ValidationError, match='transaction_id is required'):
        SelectRequest(
            provider_id='sellerapp_id',
            item_id='12391',
            fulfillment_id='ff_122',
            amount=Decimal('3000'),
            customer_pan='ARRPP7771N',
            arn='ARN-124567',
        )


def test_select_mapper_generates_transaction_id_when_request_omits_it_and_flag_true(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv('ENABLE_SELECT_NEW_TXN_ID', 'true')
    get_settings.cache_clear()

    payload = MutualFundMapper().build_select(
        SelectRequest(
            provider_id='sellerapp_id',
            item_id='12391',
            fulfillment_id='ff_122',
            amount=Decimal('3000'),
            customer_pan='ARRPP7771N',
            arn='ARN-124567',
        )
    )

    assert payload['context']['transaction_id']


def test_init_mapper_builds_lumpsum_new_folio_payload() -> None:
    payload = MutualFundMapper().build_init(
        InitRequest(
            transaction_id='txn-1',
            provider_id='sellerapp_id',
            item_id='12391',
            fulfillment_id='ff_123',
            amount=Decimal('3000'),
            customer_pan='ARRPP7771N',
            customer_ip='115.245.207.90',
            customer_phone='9916599123',
            arn='ARN-124567',
            euin='E52432',
            sub_broker_arn='ARN-123456',
            form_id='investor_details_form',
            form_submission_id='submission-1',
            payment_mode='NETBANKING',
            source_bank_code='icic0000047',
            source_bank_account_number='004701563111',
            source_bank_account_name='harish gupta',
            source_bank_account_type='SAVINGS',
        ),
        bpp_id='staging-automation.ondc.org',
        bpp_uri='https://workbench.ondc.tech/api-service/ONDC:FIS14/2.1.0/seller',
    )

    order = payload['message']['order']
    assert payload['context']['action'] == 'init'
    assert order['provider']['id'] == 'sellerapp_id'
    assert order['items'][0]['id'] == '12391'
    assert order['items'][0]['quantity']['selected']['measure'] == {'value': '3000', 'unit': 'INR'}
    assert order['items'][0]['fulfillment_ids'] == ['ff_123']
    assert order['fulfillments'][0]['id'] == 'ff_123'
    assert order['fulfillments'][0]['customer']['person']['id'] == 'pan:arrpp7771n'
    assert order['fulfillments'][0]['customer']['person']['creds'][0] == {
        'id': '115.245.207.90',
        'type': 'IP_ADDRESS',
    }
    assert order['xinput']['form']['id'] == 'investor_details_form'
    assert order['xinput']['form_response']['submission_id'] == 'submission-1'
    assert order['payments'][0]['params']['source_bank_code'] == 'icic0000047'
    assert order['payments'][0]['tags'][1]['list'][0]['value'] == 'NETBANKING'


def test_init_mapper_keeps_backward_compatible_order_wrapper() -> None:
    payload = MutualFundMapper().build_init(
        InitRequest(
            transaction_id='txn-1',
            provider_id='sellerapp_id',
            item_id='12391',
            investor={'name': 'legacy investor'},
            order={'payments': [{'type': 'PRE_FULFILLMENT'}]},
        )
    )

    order = payload['message']['order']
    assert order['billing'] == {'name': 'legacy investor'}
    assert order['payments'] == [{'type': 'PRE_FULFILLMENT'}]


def test_confirm_mapper_builds_lumpsum_new_folio_payload() -> None:
    payload = MutualFundMapper().build_confirm(
        ConfirmRequest(
            transaction_id='txn-1',
            provider_id='sellerapp_id',
            order_id='mfpp_213adf123af',
            item_id='12391',
            fulfillment_id='ff_122',
            amount=Decimal('3000'),
            customer_pan='ARRPP7771N',
            customer_ip='115.245.207.90',
            customer_phone='9916599123',
            arn='ARN-124567',
            euin='E52432',
            sub_broker_arn='ARN-123456',
            form_id='investor_details_form',
            form_submission_id='submission-1',
            payment_id='pmt_123',
            payment_mode='NETBANKING',
            source_bank_code='icic0000047',
            source_bank_account_number='004701563111',
            source_bank_account_name='harish gupta',
            source_bank_account_type='SAVINGS',
            bpp_terms_url='https://sellerapp.com/legal/ondc:fis14/static_terms?v=0.1',
        ),
        bpp_id='staging-automation.ondc.org',
        bpp_uri='https://workbench.ondc.tech/api-service/ONDC:FIS14/2.1.0/seller',
    )

    order = payload['message']['order']
    assert payload['context']['action'] == 'confirm'
    assert order['id'] == 'mfpp_213adf123af'
    assert order['provider']['id'] == 'sellerapp_id'
    assert order['items'][0]['id'] == '12391'
    assert order['items'][0]['fulfillment_ids'] == ['ff_122']
    assert order['items'][0]['payment_ids'] == ['pmt_123']
    assert order['fulfillments'][0]['customer']['person']['id'] == 'pan:arrpp7771n'
    assert order['xinput']['form']['id'] == 'investor_details_form'
    assert order['xinput']['form_response']['submission_id'] == 'submission-1'
    assert order['payments'][0]['id'] == 'pmt_123'
    assert order['payments'][0]['status'] == 'NOT-PAID'
    assert order['payments'][0]['tags'][1]['list'][0]['value'] == 'NETBANKING'
    assert [tag['descriptor']['code'] for tag in order['tags']] == ['BAP_TERMS', 'BPP_TERMS']


def test_confirm_mapper_keeps_backward_compatible_payment_contract() -> None:
    payload = MutualFundMapper().build_confirm(
        ConfirmRequest(
            transaction_id='txn-1',
            provider_id='sellerapp_id',
            order_id='order-1',
            payment={'id': 'pmt_1', 'type': 'PRE_FULFILLMENT'},
        )
    )

    order = payload['message']['order']
    assert order['id'] == 'order-1'
    assert order['provider']['id'] == 'sellerapp_id'
    assert order['payments'] == [{'id': 'pmt_1', 'type': 'PRE_FULFILLMENT'}]


@pytest.mark.asyncio
async def test_find_transaction_message_sequence_reads_distinct_action_ids() -> None:
    class Row:
        def __init__(self, action: str, direction: str, message_id: str) -> None:
            self.action = action
            self.direction = direction
            self.message_id = message_id

    class Rows:
        def all(self) -> list[Row]:
            return [
                Row('select', 'outbound', 'msg-C'),
                Row('on_search', 'inbound', 'msg-B'),
                Row('search', 'outbound', 'msg-A'),
                Row('search', 'outbound_response', 'msg-A'),
            ]

    class Db:
        async def scalars(self, _statement: object) -> Rows:
            return Rows()

    sequence = await find_transaction_message_sequence(
        Db(),  # type: ignore[arg-type]
        transaction_id='txn-1',
    )

    assert sequence == {
        'search_message_id': 'msg-A',
        'on_search_message_id': 'msg-B',
        'select_message_id': 'msg-C',
    }


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
