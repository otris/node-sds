import { htonl, ntohl } from "../network";

export class SDSSimpleMessage {
	/** Contains the simple SDSMessage */
	private buffer: Buffer;

	constructor(buffer?: Buffer) {
		this.buffer = buffer || Buffer.from([0, 0, 0, 8, 0, 0, 0, 0]);
	}

	/**
	 * The result code of the simple message
	 */
	public get result(): number {
		return ntohl(this.buffer, 5);
	}

	/**
	 * The result code of the simple message
	 */
	public set result(value: number) {
		htonl(this.buffer, 5, value);
	}

	/**
	 * Prepares the message to be send to the JANUS-server
	 */
	public pack(): Buffer {
		return this.buffer;
	}
}
