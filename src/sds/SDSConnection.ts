import { EventEmitter } from "events";
import { createConnection, Socket } from "net";
import * as os from "os";
import { timeout } from "promised-timeout";
import { ntohl } from "../network";
import { PDClass } from "../pd-scripting/PDClass";
import { PDMeta } from "../pd-scripting/PDMeta";
import { ParameterNames, SDSMessage } from "./SDSMessage";
import { SDSRequest } from "./SDSRequest";
import { SDSResponse } from "./SDSResponse";

export class SDSConnection extends EventEmitter {

	/** Acknowledgment message */
	public static ACK: Buffer = Buffer.from(SDSMessage.term_utf8("valid"));

	/** Hello-Message ("magic") to login to the JANUS-server */
	public static HELLO: Buffer = Buffer.from("GGCH$1$$", "ascii");

	/** Invalid message (if the request was invalid) */
	public static INVALID: Buffer = Buffer.from("invalid", "ascii");

	/* tslint:disable:variable-name */
	/** PDClass functions */
	public PDClass: PDClass;

	/** PDMeta functions */
	public PDMeta: PDMeta;
	/* tslint:enable:variable-name */

	/** Buffered bytes of the message */
	private bufferedMessageBytes: number;

	/** Indicates the current connection status */
	private isConnected: boolean;

	/** Message buffer of a received message */
	private message: Buffer;

	/** Message size of a received message (needed to know if a message was received completely) */
	private messageSize: number;

	/** TCP-Socket for the communication with the JANUS-server */
	private socket: Socket;

	constructor() {
		super();

		this.message = Buffer.alloc(4096);
		this.bufferedMessageBytes = 0;
		this.messageSize = 0;
		this.isConnected = false;
		this.socket = null as any;

		// Initialize functions
		this.PDClass = new PDClass(this);
		this.PDMeta = new PDMeta(this);
	}

	/**
	 * Established the TCP-connection with the JANUS-server
	 * @param clientName Name with which you want to log in to the server
	 * @param host Host to connect with (IPv4-adress)
	 * @param port Port of the JANUS-server
	 * @returns The id of the client
	 */
	public connect(clientName: string, host: string, port: number = 11000): Promise<number> {
		return new Promise((resolve, reject) => {
			this.socket = createConnection(port, host);
			this.socket.on("connect", async () => {
				this.isConnected = true;

				// Send the magic to the server to be able to connect and wait for an ACK
				let response = await this.send(SDSConnection.HELLO);
				if (!response.isACK()) {
					reject(new Error(`Expected to receive an ACK, got ${response}`));
				}

				// Send the client name and os
				const request = new SDSRequest();
				request.operation = 0; // this operation is not labeled. Take it as it is
				request.add(Buffer.from(`${clientName} on ${os.platform()}`));
				response = await this.send(request);

				// wait for the client-ID
				resolve(response.getParameter(ParameterNames.CLIENT_ID));
			});

			this.socket.on("error", (err: Error) => {
				err.message = `Unhandled error ocurred: The TCP-connection failed: ${err.message}`;
				console.error(err);
				reject(err);
			});

			this.socket.on("close", (hadError: boolean) => {
				this.isConnected = false;
			});

			this.socket.on("end", () => {
				console.log("Connection closed due received a FIN-package");
				this.socket.end();
			});

			this.socket.on("data", this.scanParseAndEmit.bind(this));
		});
	}

	/**
	 * Send given message on the wire and immediately return a promise that is fulfilled whenever the response
	 * comes in or the timeout is reached.
	 *
	 * @param request The SDS-Request or a buffer to send. Note: If you pass a buffer, the buffer won't be packed or edited.
	 * @param waitForResponse when send() is called from disconnect(), we shouldn't wait for a response because
	 *                        we won't get one. When setting this variable to false, we can avoid the timeout error.
	 */
	public send(request: SDSRequest | Buffer, waitForResponse: boolean = true): Promise<SDSResponse> {
		if (!this.isConnected) {
			throw new Error("The client is not connected");
		}

		// if send is called by disconnect(), the server sends no response,
		// so call send without waiting for response to avoid the timeout error
		if (!waitForResponse) {
			if (request instanceof SDSRequest) {
				this.socket.write(request.pack());
			} else {
				this.socket.write(request);
			}

			return new Promise<SDSResponse>((resolve) => {
				// @todo: Create a qualified "disconnect" response
				resolve();
			});
		} else {
			// normal case: call send with timeout
			const ms = 6000;
			const response: Promise<SDSResponse> = this.waitForResponse();
			if (request instanceof SDSRequest) {
				this.socket.write(request.pack());
			} else {
				this.socket.write(request);
			}

			// clear timeouts if response finishes in time
			// see motivation of npm promised-timeout
			return timeout({
				error: new Error(`Request timed out (after ${ms} ms)`),
				promise: response,
				time: ms,
			});
		}
	}

	/**
	 * Appends a buffer to the message buffer
	 * @param chunk Data to append
	 */
	private appendToBuffer(chunk: Buffer) {
		const spaceLeft = this.message.length - this.bufferedMessageBytes;
		if (spaceLeft < chunk.length) {
			const newCapacity = Math.max(this.bufferedMessageBytes + chunk.length, 1.5 * this.message.length);
			const newBuffer = Buffer.alloc(newCapacity);
			this.message.copy(newBuffer);
			this.message = newBuffer;
		}
		chunk.copy(this.message, this.bufferedMessageBytes);
		this.bufferedMessageBytes += chunk.length;
	}

	/**
	 * Handles incoming data from the server
	 * @param data Byte buffer
	 */
	private scanParseAndEmit(data: Buffer) {
		if (data.equals(SDSConnection.INVALID)) {
			throw new Error("Request was invalid");
		} else if (data.equals(SDSConnection.ACK)) {
			this.emit("response", new SDSResponse(data, false));
		} else {
			if (this.messageSize === 0) {
				// We got a new message, check the size and wait until we received the message completely
				this.messageSize = ntohl(data, 0);
			}

			// Append to the buffer and wait for the rest
			this.appendToBuffer(data);

			if (this.bufferedMessageBytes === this.messageSize) {
				// We received the message completely. Handle it
				const response = new SDSResponse(this.message.slice(0, this.messageSize));
				// console.log(`Received response ${response}`);
				this.emit("response", response);

				// Reset the message variables
				this.messageSize = this.bufferedMessageBytes = 0;
				this.message = Buffer.alloc(4096);
			}
		}
	}

	/**
	 * Make a new promise that is resolved once a 'response' event is triggered.
	 */
	private waitForResponse(): Promise<SDSResponse> {
		return new Promise((resolve) => {
			this.once("response", resolve);
		});
	}
}
