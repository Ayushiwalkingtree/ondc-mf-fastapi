from __future__ import annotations

import asyncio
import sys
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import AsyncSessionLocal, engine
from app.services.transaction_log import find_discovered_select_details, save_ondc_log


TRANSACTION_ID = 'local-validation-transaction'
SEARCH_MESSAGE_ID = 'local-search-message'
ON_SEARCH_MESSAGE_ID = 'local-on-search-message'
SELECT_MESSAGE_ID = 'local-select-message'
ON_SELECT_MESSAGE_ID = 'local-on-select-message'


def search_payload() -> dict:
    return {
        'context': {
            'domain': 'ONDC:FIS14',
            'action': 'search',
            'version': '2.1.0',
            'transaction_id': TRANSACTION_ID,
            'message_id': SEARCH_MESSAGE_ID,
            'bap_id': 'ondcapi.walkingtree.tech',
            'bap_uri': 'https://ondcapi.walkingtree.tech/ondc',
        },
        'message': {'intent': {'category': {'descriptor': {'code': 'MUTUAL_FUNDS'}}}},
    }


def on_search_payload() -> dict:
    return {
        'context': {
            'domain': 'ONDC:FIS14',
            'action': 'on_search',
            'version': '2.1.0',
            'transaction_id': TRANSACTION_ID,
            'message_id': ON_SEARCH_MESSAGE_ID,
            'bap_id': 'ondcapi.walkingtree.tech',
            'bap_uri': 'https://ondcapi.walkingtree.tech/ondc',
            'bpp_id': 'api.sellerapp.com',
            'bpp_uri': 'https://api.sellerapp.com/ondc',
        },
        'message': {
            'catalog': {
                'providers': [
                    {
                        'id': 'sellerapp_id',
                        'items': [
                            {'id': '138', 'descriptor': {'code': 'SCHEME'}},
                            {
                                'id': '12391',
                                'parent_item_id': '138',
                                'fulfillment_ids': ['ff_122'],
                                'descriptor': {'code': 'SCHEME_PLAN'},
                            },
                        ],
                        'fulfillments': [
                            {
                                'id': 'ff_122',
                                'type': 'LUMPSUM',
                                'tags': [
                                    {
                                        'descriptor': {'code': 'THRESHOLDS'},
                                        'list': [
                                            {'descriptor': {'code': 'AMOUNT_MIN'}, 'value': '1000'},
                                            {'descriptor': {'code': 'AMOUNT_MAX'}, 'value': '10000'},
                                            {'descriptor': {'code': 'AMOUNT_MULTIPLES'}, 'value': '1'},
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


def select_payload() -> dict:
    return {
        'context': {
            'domain': 'ONDC:FIS14',
            'action': 'select',
            'version': '2.1.0',
            'transaction_id': TRANSACTION_ID,
            'message_id': SELECT_MESSAGE_ID,
            'bap_id': 'ondcapi.walkingtree.tech',
            'bap_uri': 'https://ondcapi.walkingtree.tech/ondc',
            'bpp_id': 'api.sellerapp.com',
            'bpp_uri': 'https://api.sellerapp.com/ondc',
        },
        'message': {
            'order': {
                'provider': {'id': 'sellerapp_id'},
                'items': [
                    {
                        'id': '12391',
                        'quantity': {'selected': {'measure': {'value': '3000', 'unit': 'INR'}}},
                        'fulfillment_ids': ['ff_122'],
                    }
                ],
                'fulfillments': [{'id': 'ff_122', 'type': 'LUMPSUM'}],
            }
        },
    }


def on_select_payload() -> dict:
    payload = select_payload()
    payload['context'] = {**payload['context'], 'action': 'on_select', 'message_id': ON_SELECT_MESSAGE_ID}
    return payload


async def main() -> None:
    if engine is None or AsyncSessionLocal is None:
        raise SystemExit('Database is disabled. Run with NO_DATABASE=false.')

    async with AsyncSessionLocal() as db:
        await save_ondc_log(db, action='search', direction='outbound', payload=search_payload(), status='SENT')
        await save_ondc_log(db, action='on_search', direction='inbound', payload=on_search_payload(), status='ACK')
        discovered = await find_discovered_select_details(
            db,
            transaction_id=TRANSACTION_ID,
            provider_id='sellerapp_id',
            item_id='12391',
            scheme_item_id='138',
            fulfillment_id='ff_122',
            fulfillment_type='LUMPSUM',
            amount=Decimal('3000'),
        )
        if not discovered:
            raise SystemExit('discovery lookup failed')
        await save_ondc_log(db, action='select', direction='outbound', payload=select_payload(), status='SENT')
        await save_ondc_log(db, action='on_select', direction='inbound', payload=on_select_payload(), status='ACK')
        print('discovered_bpp_uri=' + discovered['bpp_uri'])
        print('discovered_fulfillment_id=' + discovered['fulfillment_id'])
        print('validation_rows=search,on_search,select,on_select')


if __name__ == '__main__':
    asyncio.run(main())
