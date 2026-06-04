import base64
from nacl.signing import SigningKey
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import x25519


def b64(value: bytes) -> str:
    return base64.b64encode(value).decode('utf-8')


def main() -> None:
    signing = SigningKey.generate()
    encryption = x25519.X25519PrivateKey.generate()
    encryption_private = encryption.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption(),
    )
    encryption_public_der = encryption.public_key().public_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    print('ONDC_SIGNING_PRIVATE_KEY_B64=' + b64(bytes(signing)))
    print('ONDC_SIGNING_PUBLIC_KEY_B64=' + b64(bytes(signing.verify_key)))
    print('ONDC_ENCRYPTION_PRIVATE_KEY_B64=' + b64(encryption_private))
    print('ONDC_ENCRYPTION_PUBLIC_KEY_B64=' + b64(encryption_public_der))


if __name__ == '__main__':
    main()
