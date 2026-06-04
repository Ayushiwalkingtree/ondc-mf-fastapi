from nacl.signing import SigningKey
from app.utils.crypto import b64encode, sign_ed25519, verify_ed25519


def test_ed25519_sign_verify() -> None:
    key = SigningKey.generate()
    private = b64encode(bytes(key))
    public = b64encode(bytes(key.verify_key))
    msg = b'hello'
    sig = sign_ed25519(msg, private)
    verify_ed25519(msg, sig, public)
