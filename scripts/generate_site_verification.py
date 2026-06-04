import argparse
from pathlib import Path
from app.core.config import get_settings
from app.utils.crypto import sign_ed25519


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--request-id', required=True)
    parser.add_argument('--out', default='ondc-site-verification.html')
    args = parser.parse_args()
    settings = get_settings()
    signed = sign_ed25519(args.request_id.encode('utf-8'), settings.ONDC_SIGNING_PRIVATE_KEY_B64)
    html = f'''<html>
  <head>
    <meta name="ondc-site-verification" content="{signed}" />
  </head>
  <body>ONDC Site Verification Page</body>
</html>
'''
    Path(args.out).write_text(html, encoding='utf-8')
    print(f'Generated {args.out}')


if __name__ == '__main__':
    main()
