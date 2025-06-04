import nacl from 'tweetnacl';

export function verifyKey(body, signature, timestamp, clientPublicKey) {
	const message = new TextEncoder().encode(timestamp + body);
	const sig = hex2bin(signature);
	const key = hex2bin(clientPublicKey);
	return nacl.sign.detached.verify(message, sig, key);
}

function hex2bin(hex) {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
	}
	return bytes;
}
