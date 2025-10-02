import nacl from 'tweetnacl';

/**
 * Verify a Discord interaction signature.
 *
 * @param {string} body - Raw request body.
 * @param {string} signature - Hex encoded signature from Discord.
 * @param {string} timestamp - Timestamp header from the request.
 * @param {string} clientPublicKey - Hex encoded public key.
 * @returns {boolean} True if the signature is valid.
 */
export function verifyKey(body, signature, timestamp, clientPublicKey) {
	const message = new TextEncoder().encode(timestamp + body);
	const sig = hex2bin(signature);
	const key = hex2bin(clientPublicKey);
	return nacl.sign.detached.verify(message, sig, key);
}

/**
 * Convert a hex string to a byte array.
 *
 * @param {string} hex - Hex encoded string.
 * @returns {Uint8Array} Byte array representation.
 */

function hex2bin(hex) {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
	}
	return bytes;
}
