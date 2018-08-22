// T O D O's until the refactored version has the same functionality like the old one
// @todo: Function missing: setLanguage (see https://github.com/otris/node-sds/blob/master/src/sds.ts#L313)
// @todo: Function missing: runScriptOnServer (see https://github.com/otris/node-sds/blob/master/src/sds.ts#L338)
// @todo: Function missing: callClassOperation (see https://github.com/otris/node-sds/blob/master/src/sds.ts#L355)

import { EventEmitter } from "events";
import { createConnection, Socket } from "net";
import * as os from "os";
import * as promisePrototypeFinally from "promise.prototype.finally";
import { timeout } from "promised-timeout";
import { ntohl } from "../network";
import { PDClass } from "../pd-scripting/PDClass";
import { PDMeta } from "../pd-scripting/PDMeta";
import { ServerGui } from "../pd-scripting/ServerGui";
import { ParameterNames, SDSMessage } from "./SDSMessage";
import { SDSRequest } from "./SDSRequest";
import { SDSResponse } from "./SDSResponse";
import { SDSSimpleMessage } from "./SDSSimpleMessage";

// make Promise.finally available
promisePrototypeFinally.shim();

export class SDSConnection {

	/** Acknowledgment message */
	public static ACK: Buffer = Buffer.from(SDSMessage.term_utf8("valid"));

	/** Hello-Message ("magic") to login to the JANUS-server */
	public static HELLO: Buffer = Buffer.from("GGCH$1$$", "ascii");

	/** Invalid message (if the request was invalid) */
	public static INVALID: Buffer = Buffer.from("invalid", "ascii");

	/** Timeout in milliseconds to wait for a response from the server */
	public static TIMEOUT = 6000;

	/* tslint:disable:variable-name */
	/** PDClass functions */
	public PDClass: PDClass;

	/** PDMeta functions */
	public PDMeta: PDMeta;

	/** Functions of the server gui */
	public ServerGui: ServerGui;
	/* tslint:enable:variable-name */

	/** Buffered bytes of the message */
	private bufferedMessageBytes: number;

	/** EventEmitter to handle requests and responses between the client and the server */
	private emitter: EventEmitter;

	/** Indicates whether a request is currently in process */
	private isBusy: boolean;

	/** Indicates the current connection status */
	private isConnected: boolean;

	/** Message buffer of a received message */
	private message: Buffer;

	/** Message size of a received message (needed to know if a message was received completely) */
	private messageSize: number;

	/** TCP-Socket for the communication with the JANUS-server */
	private socket: Socket;

	constructor() {
		this.emitter = new EventEmitter();
		this.message = Buffer.alloc(4096);
		this.bufferedMessageBytes = 0;
		this.messageSize = 0;
		this.isConnected = false;
		this.socket = null as any;
		this.isBusy = false;

		// Initialize functions
		this.PDClass = null as any;
		this.PDMeta = null as any;
		this.ServerGui = null as any;
	}

	/**
	 * Establishes the TCP-connection with the JANUS-server
	 * @param clientName Name with which you want to log in to the server
	 * @param host Host to connect with (IPv4-adress)
	 * @param port Port of the JANUS-server
	 * @returns The id of the client
	 */
	public connect(clientName: string, host: string, port: number = 11000): Promise<number> {
		const connectPromise = new Promise((resolve, reject) => {
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

				// wait for the client-ID
				response = await this.send(request);
				const clientId = response.getParameter(ParameterNames.CLIENT_ID);

				// Initialize functions
				this.PDClass = new PDClass(this);
				this.PDMeta = new PDMeta(this);
				this.ServerGui = new ServerGui(this);
				await this.PDMeta.initialize();

				resolve(clientId);
			});

			this.socket.on("error", (err: Error) => {
				err.message = `Unhandled error ocurred: The TCP-connection failed: ${err.message}`;
				this.disconnect();
				reject(err);
			});

			this.socket.on("close", (hadError: boolean) => {
				this.isConnected = false;
			});

			this.socket.on("end", () => {
				this.socket.end();
			});

			this.socket.on("data", this.scanParseAndEmit.bind(this));
		});

		// this is a workaround for the test execution: Because there is no possibility to set a timeout for the connection
		// attempt, we reject the connection if it exceed a time of X ms
		return timeout({
			error: new Error(`Unhandled error ocurred: The TCP-connection failed: connect ETIMEDOUT ${host}:${port}`),
			promise: connectPromise,
			time: 15000,
		});
	}

	/**
	 * Closes the TCP-connection with the JANUS-server
	 */
	public disconnect() {
		if (this.socket) {
			// @todo: send a disconnect message to the client (see https://github.com/otris/node-sds/blob/master/src/sds.ts#L250)
			this.isConnected = false;
			this.socket.destroy();
		}
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
		// wait until the parser emits a "response"-event
		const response: Promise<SDSResponse> = new Promise((resolve) => {
			this.emitter.once("response", resolve);
		});
		return this.sendRequest(request, response, waitForResponse);
	}

	/**
	 * Send the given message and waits for the response of the server
	 *
	 * @param request The SDS-Request or a buffer to send. Note: If you pass a buffer, the buffer won't be packed or edited.
	 * @returns A simple message object
	 */
	public sendSimple(request: SDSRequest): Promise<SDSSimpleMessage> {
		// wait until the parser emits a "simple-response"-event
		const response: Promise<SDSSimpleMessage> = new Promise((resolve) => {
			this.emitter.once("simple-response", resolve);
		});
		return this.sendRequest(request, response, true);
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
			this.emitter.emit("response", new SDSResponse(data, false));
		} else {
			if (this.messageSize === 0) {
				// We got a new message, check the size and wait until we received the message completely
				this.messageSize = ntohl(data, 0);
			}

			// Append to the buffer and wait for the rest
			this.appendToBuffer(data);

			if (this.bufferedMessageBytes === this.messageSize) {
				// We received the message completely. Handle it
				const responseBuffer = this.message.slice(0, this.messageSize);

				if (responseBuffer.length === 8) {
					this.emitter.emit("simple-response", new SDSSimpleMessage(responseBuffer));
				} else {
					this.emitter.emit("response", new SDSResponse(responseBuffer));
				}

				// Reset the message variables
				this.messageSize = this.bufferedMessageBytes = 0;
				this.message = Buffer.alloc(4096);
			}
		}
	}

	/**
	 * Send given message on the wire and immediately return a promise that is fulfilled whenever the response
	 * comes in or the timeout is reached.
	 *
	 * @param request The SDS-Request or a buffer to send. Note: If you pass a buffer, the buffer won't be packed or edited.
	 * @param waitForResponse when send() is called from disconnect(), we shouldn't wait for a response because
	 *                        we won't get one. When setting this variable to false, we can avoid the timeout error.
	 */
	private async sendRequest<T extends SDSResponse | SDSSimpleMessage>(
		request: SDSRequest | Buffer, requestPromise: Promise<T> | Promise<SDSSimpleMessage>, waitForResponse: boolean = true): Promise<T> {
		if (!this.isConnected) {
			throw new Error("The client is not connected");
		}

		// Wait with the next request as long as the current request is active
		while (this.isBusy) {
			await this.sleep(500);
		}

		// if send is called by disconnect(), the server sends no response,
		// so call send without waiting for response to avoid the timeout error
		if (!waitForResponse) {
			return new Promise<T>((resolve) => {
				if (request instanceof SDSRequest) {
					this.socket.write(request.pack());
				} else {
					this.socket.write(request);
				}

				// @todo: Create a qualified "disconnect" response
				resolve();
			});
		} else {
			// add the current request to the queue to prevent sending requests parallel
			this.isBusy = true;

			if (request instanceof SDSRequest) {
				this.socket.write(request.pack());
			} else {
				this.socket.write(request);
			}

			// clear timeouts if response finishes in time
			// see motivation of npm promised-timeout
			return timeout({
				error: new Error(`Request timed out (after ${SDSConnection.TIMEOUT} ms)`),
				promise: requestPromise,
				time: SDSConnection.TIMEOUT,
			}).finally(() => {
				this.isBusy = false;
			});
		}
	}

	/**
	 * Sleeps for a given time
	 * @param ms Time in milliseconds
	 */
	private sleep(ms: number) {
		return new Promise( (resolve) => setTimeout(resolve, ms) );
	}
}
