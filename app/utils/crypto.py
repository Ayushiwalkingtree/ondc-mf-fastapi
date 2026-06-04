import base64
from cryptography.hazmat.primitives import padding, serialization
from cryptography.hazmat.primitives.asymmetric import x25519
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from nacl.public import PrivateKey, PublicKey, Box
from nacl.signing import SigningKey, VerifyKey
from nacl.exceptions import BadSignatureError, CryptoError
from app.core.exceptions import OndcSignatureError, AppException


def b64decode(value: str) -> bytes:
    try:
        return base64.b64decode(value)
    except Exception as exc:
        raise AppException('Invalid base64 key/value', status_code=500, code='INVALID_CRYPTO_CONFIG') from exc


def b64encode(value: bytes) -> str:
    return base64.b64encode(value).decode('utf-8')


def sign_ed25519(message: bytes, private_key_b64: str) -> str:
    key_bytes = b64decode(private_key_b64)
    signing_key = SigningKey(key_bytes[:32])
    signed = signing_key.sign(message)
    return b64encode(signed.signature)


def verify_ed25519(message: bytes, signature_b64: str, public_key_b64: str) -> None:
    try:
        verify_key = VerifyKey(b64decode(public_key_b64))
        verify_key.verify(message, b64decode(signature_b64))
    except (BadSignatureError, ValueError) as exc:
        raise OndcSignatureError() from exc


def decrypt_x25519(cipher_text_b64: str, private_key_b64: str, sender_public_key_b64: str) -> str:
    try:
        private_key = PrivateKey(b64decode(private_key_b64))
        public_key = PublicKey(b64decode(sender_public_key_b64))
        box = Box(private_key, public_key)
        plain = box.decrypt(b64decode(cipher_text_b64))
        return plain.decode('utf-8')
    except (CryptoError, ValueError) as exc:
        raise AppException('Failed to decrypt challenge', status_code=400, code='DECRYPTION_FAILED') from exc


def encrypt_x25519(plain_text: str, private_key_b64: str, receiver_public_key_b64: str) -> str:
    private_key = PrivateKey(b64decode(private_key_b64))
    public_key = PublicKey(b64decode(receiver_public_key_b64))
    box = Box(private_key, public_key)
    encrypted = box.encrypt(plain_text.encode('utf-8'))
    return b64encode(bytes(encrypted))


def x25519_public_key_der_b64(private_key_b64: str) -> str:
    private_key = _load_x25519_private_key(private_key_b64)
    public_key = private_key.public_key()
    return b64encode(
        public_key.public_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )


def decrypt_ondc_challenge(
    challenge_b64: str,
    private_key_b64: str,
    registry_public_key_b64: str,
) -> str:
    try:
        private_key = _load_x25519_private_key(private_key_b64)
        public_key = _load_x25519_public_key(registry_public_key_b64)
        shared_key = private_key.exchange(public_key)
        cipher = Cipher(algorithms.AES(shared_key), modes.ECB())
        decryptor = cipher.decryptor()
        padded_plain = decryptor.update(b64decode(challenge_b64)) + decryptor.finalize()
        plain = _unpad_pkcs7(padded_plain)
        return plain.decode('utf-8')
    except Exception as exc:
        raise AppException('Failed to decrypt ONDC registry challenge', status_code=400, code='DECRYPTION_FAILED') from exc


def _load_x25519_private_key(private_key_b64: str) -> x25519.X25519PrivateKey:
    key_bytes = b64decode(private_key_b64)
    if len(key_bytes) == 32:
        return x25519.X25519PrivateKey.from_private_bytes(key_bytes)
    loaded = serialization.load_der_private_key(key_bytes, password=None)
    if not isinstance(loaded, x25519.X25519PrivateKey):
        raise AppException('Invalid X25519 private key', status_code=500, code='INVALID_CRYPTO_CONFIG')
    return loaded


def _load_x25519_public_key(public_key_b64: str) -> x25519.X25519PublicKey:
    key_bytes = b64decode(public_key_b64)
    if len(key_bytes) == 32:
        return x25519.X25519PublicKey.from_public_bytes(key_bytes)
    loaded = serialization.load_der_public_key(key_bytes)
    if not isinstance(loaded, x25519.X25519PublicKey):
        raise AppException('Invalid X25519 public key', status_code=500, code='INVALID_CRYPTO_CONFIG')
    return loaded


def _unpad_pkcs7(value: bytes) -> bytes:
    try:
        unpadder = padding.PKCS7(algorithms.AES.block_size).unpadder()
        return unpadder.update(value) + unpadder.finalize()
    except ValueError:
        return value.rstrip(b'\x00')
