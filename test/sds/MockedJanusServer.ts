import { createServer, Server, Socket } from "net";
import { crypt_md5 } from "../src/cryptmd5";
import { PDClass } from "../src/pd-scripting/PDClass";
import { ComOperations, Operations, ParameterNames } from "../src/sds/SDSMessage";
import { SDSConnection } from "../../src/sds/SDSConnection";
import { SDSRequest } from "../../src/sds/SDSRequest";

export class MockedJanusServer {

	/** Buffered bytes of the message */
	private bufferedMessageBytes: number;

	/** Message buffer of a received message */
	private message: Buffer;

	/** Message size of a received message (needed to know if a message was received completely) */
	private messageSize: number;

	/** Server socket */
	private server: Server;

	/** Socket for the communication */
	private socket: Socket;

	constructor() {
		this.message = Buffer.alloc(4096);
		this.bufferedMessageBytes = 0;
		this.messageSize = 0;
		this.server = null as any;
		this.socket = null as any;
	}

	/**
	 * Initializes a local tcp socket
	 * @param port Port the server should listen on
	 * @returns this-reference (for chained calls)
	 */
	public init(port: number = 11001): Promise<MockedJanusServer> {
		return new Promise<MockedJanusServer>((resolve, reject) => {
			this.server = createServer((socket) => {
				this.socket = socket;
				socket.on("data", this.dateReceived.bind(this));
			});

			this.server.on("listening", resolve.bind(null, this));
			this.server.on("error", (err: Error) => {
				err.message = `[Mocked JANUS-server] Unhandled error occurred: ${err.message}`;
				console.error(err);
				reject(err);
			});
			this.server.on("close", () => {
				console.log("Mocked JANUS-server shut down...");
			});

			this.server.listen(port, "127.0.0.1");
		});
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
	 * Handles received data
	 * @param data Received data buffer
	 */
	private dateReceived(data: Buffer) {
		// First, check if the client tries to establish a connection (by sending the magic)
		// @todo: The magic can look different. For now, the magic send by the SDS-API will be fixed,
		//        but it can change in the future
		if (data.equals(SDSConnection.HELLO)) {
			// send back the ACK
			this.socket.write(SDSConnection.ACK);
		} else if (/.+\son\s+.+/.test(data.toString())) {
			// the client told us his name and the os, send him a id back
			// @todo: I don't know how the id has to look like. For now, send a random 6 digit long number
			const clientId = Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000;
			const response = new SDSRequest(); // We use the request-class here again, thats fine
			response.addParameter(ParameterNames.CLIENT_ID, clientId);

			// The response class requires to set an operation. It won't be evaluated, so set any value here
			response.operation = 1;

			this.socket.write(response.pack());
		} else {
			if (this.messageSize === 0) {
				// We got a new message, check the size and wait until we received the message completely
				this.messageSize = ntohl(data, 0);
			}

			// Append to the buffer and wait for the rest
			this.appendToBuffer(data);

			if (this.bufferedMessageBytes === this.messageSize) {
				// We received the message completely. Handle it
				this.handleRequest(this.message);

				// Reset the message variables
				this.messageSize = this.bufferedMessageBytes = 0;
				this.message = Buffer.alloc(4096);
			}
		}
	}

	/**
	 * Handles a request from a client
	 * @param requestBuffer Buffer with the client request
	 */
	private handleRequest(requestBuffer: Buffer) {
		// We need to parse the request, but it's only possible with the class "SDSResponse"
		// Because a response and a request have the same structure, we can simply treat the request as a response
		// and are able to read the request
		const request = new SDSResponse(requestBuffer);

		// Handle the request and send a response
		throw new Error("Not implemented");
	}
}
