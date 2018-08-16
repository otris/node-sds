import { createServer, Server, Socket } from "net";
import { crypt_md5 } from "../src/cryptmd5";
import { ntohl } from "../src/network";
import { PDClass } from "../src/pd-scripting/PDClass";
import { SDSConnection } from "../src/sds/SDSConnection";
import { ComOperations, Operations, ParameterNames } from "../src/sds/SDSMessage";
import { SDSRequest } from "../src/sds/SDSRequest";
import { SDSResponse } from "../src/sds/SDSResponse";
import { SDSSimpleMessage } from "../src/sds/SDSSimpleMessage";
import { ADMIN_USER, ADMIN_USER_PASS, TEST_FELLOW, TEST_FELLOW_PASS, TEST_PRINCIPAL } from "./env.test";
import { MockedPDObject } from "./MockedPDObject";

export class MockedJanusServer {

	/** Buffered bytes of the message */
	private bufferedMessageBytes: number;

	/** Message buffer of a received message */
	private message: Buffer;

	/** Message size of a received message (needed to know if a message was received completely) */
	private messageSize: number;

	/** Map with the PDObjects of the server */
	private pdObjectsMap: Map<string, MockedPDObject>;

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
		this.pdObjectsMap = new Map();
	}

	/**
	 * Stops the mocked server
	 */
	public close() {
		if (this.server) {
			this.server.close();
		}

		if (this.socket) {
			this.socket.destroy();
		}
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
				reject(err);
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
			// the client told us his name and the os, send him an id back
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
				this.handleRequest(this.message.slice(0, this.messageSize));

				// Reset the message variables
				this.messageSize = this.bufferedMessageBytes = 0;
				this.message = Buffer.alloc(4096);
			}
		}
	}

	/**
	 * Sends back a response for a change principal request
	 * The request will be successful if the principal to change to equals "test", otherwise it will fail
	 * @param request Request from the client
	 */
	private handleChangePrincipalRequest(request: SDSResponse) {
		const response = new SDSRequest();

		if (request.getParameter(ParameterNames.PRINCIPAL) === TEST_PRINCIPAL) {
			response.addParameter(ParameterNames.RETURN_VALUE, 0);
			response.addParameter(ParameterNames.PRINCIPAL, 1);
			response.addParameter(45, "otris software AG"); // it's the field 'carrier' of the principal, but the parameter is not labeled
		} else {
			// Failure. Only valid if the principal equals "test"
			response.addParameter(ParameterNames.RETURN_VALUE, 18);
		}

		response.operation = 173;
		this.socket.write(response.pack());
	}

	/**
	 * Sends back a response for a change user request.
	 * The request will be successful for the user "admin" with passwort "test123" or user "admin2" with password ""
	 * For other combinations an error will be returned
	 * @param request Request from the client
	 */
	private handleChangeUserRequest(request: SDSResponse) {
		let response = new SDSRequest();
		const hashedPassword = request.getParameter(ParameterNames.PASSWORD);
		const login = request.getParameter(ParameterNames.USER);

		// Response for invalid password
		const responseInvalidPass = new SDSRequest();
		responseInvalidPass.operation = 127;
		responseInvalidPass.addParameter(ParameterNames.RETURN_VALUE, 21); // PDMeta error code

		if (login === ADMIN_USER) {
			if (hashedPassword === crypt_md5(ADMIN_USER_PASS, PDClass.JANUS_CRYPTMD5_SALT).value || hashedPassword === "") {
				response.operation = 173; // don't know
				response.addParameter(ParameterNames.RETURN_VALUE, 0);
				response.addParameter(ParameterNames.USER, "Administrator");
				response.addParameter(ParameterNames.USER_ID, 1);
				response.addParameter(ParameterNames.PASSWORD, hashedPassword);
			} else {
				response = responseInvalidPass;
			}
		} else if (login === `${TEST_FELLOW}.${TEST_PRINCIPAL}`) {
			if (hashedPassword === crypt_md5(TEST_FELLOW_PASS, PDClass.JANUS_CRYPTMD5_SALT).value || hashedPassword === "") {
				response.operation = 173; // don't know
				response.addParameter(ParameterNames.RETURN_VALUE, 0);
				response.addParameter(ParameterNames.USER, "Test");
				response.addParameter(ParameterNames.USER_ID, 2);
				response.addParameter(ParameterNames.PASSWORD, hashedPassword);
			} else {
				response = responseInvalidPass;
			}
		} else {
			// Unknown user
			response.operation = 123;
			response.addParameter(ParameterNames.RETURN_VALUE, 16); // PDMeta error code
		}

		this.socket.write(response.pack());
	}

	private handleComOperationRequest(request: SDSResponse) {
		const response = new SDSRequest();

		switch (request.getParameter(ParameterNames.INDEX)) {
			case ComOperations.ERROR_MESSAGE:
				// just return a random string for the requested error code. The tests should not match the
				// translated error message. It can change in the future and they are not part of this module
				response.addParameter(ParameterNames.RETURN_VALUE, "<random>");
				break;

			case ComOperations.GET_CLASSES:
				// return a fixed list of classes
				response.addParameter(ParameterNames.RETURN_VALUE, ["AccessProfile", "DlcAction", "Fellow"]);
				break;

			case ComOperations.GET_CLASS_ID:
				// Return a random integer, the class id could change in future and should not matter for testing
				response.addParameter(ParameterNames.CLASS_ID, Math.floor(Math.random() * (100 - 1 + 1)) + 1);
				break;

			default:
				throw new Error(`Unknown com operation: ${request.getParameter(ParameterNames.INDEX)}`);
		}

		response.operation = 173;
		this.socket.write(response.pack());
	}

	/**
	 * Sends back a response for a PDClass.newObject-request
	 * @param request Request from the client
	 */
	private handlePDClassNewObject(request: SDSResponse) {
		const response = new SDSRequest();
		let oId2 = Math.floor(Math.random() * (999999 - 1 + 1)) + 999999;
		if (request.getParameter(ParameterNames.IS_TRANSACTION_OBJECT) as boolean) {
			oId2 *= -1;
		}

		const classId = request.getParameter(ParameterNames.CLASS_ID);
		response.oId = `${classId}:${oId2}`; // Generate a object id
		this.pdObjectsMap.set(response.oId, new MockedPDObject(response.oId, classId));
		response.operation = 173;
		this.socket.write(response.pack());
	}

	/**
	 * Sends back a response for a PDClass.newObject-request
	 * @param request Request from the client
	 */
	private handlePDClassPtr(request: SDSResponse) {
		const response = new SDSRequest();
		if (this.pdObjectsMap.has(request.oId)) {
			// it's enough to return the object id. The response usually has more parameters, but we will not add them now
			response.oId = request.oId;
		} else {
			response.oId = "0:0";
		}

		response.operation = 173;
		this.socket.write(response.pack());
	}

	/**
	 * Sends back a response for the getAttribute-Operation of the class PDObject
	 * @param request Request from the client
	 */
	private handlePDObjectGetAttribute(request: SDSResponse) {
		if (this.pdObjectsMap.has(request.oId)) {
			const response = new SDSRequest();
			response.oId = request.oId;
			response.operation = 0;

			const pdObject = this.pdObjectsMap.get(request.oId) as MockedPDObject;
			response.addParameter(ParameterNames.RETURN_VALUE, 0); // @todo: clear how to indicate success or failure

			const attributeName = request.getParameter(ParameterNames.CLASS_NAME) as string;
			const attributeValue = pdObject.attributes.get(attributeName) || attributeName; // the server returns the name of the requested attribute if the attribute does not exist
			response.addParameter(ParameterNames.VALUE, attributeValue);
			this.socket.write(response.pack());
		} else {
			throw new Error(`The object with id ${request.oId} doesn't exist`);
		}
	}

	/**
	 * Sends back a response for the setAttribute-Operation of the class PDObject
	 * @param request Request from the client
	 */
	private handlePDObjectSetAttribute(request: SDSResponse) {
		if (this.pdObjectsMap.has(request.oId)) {
			const pdObject = this.pdObjectsMap.get(request.oId) as MockedPDObject;
			const attributeName = request.getParameter(ParameterNames.CLASS_NAME);

			const response = new SDSSimpleMessage();
			if (attributeName === "notExistingAttribute") {
				response.result = 268544; // extracted from the response of the live message
			} else {
				response.result = 0;
				pdObject.attributes.set(
					attributeName,
					request.getParameter(ParameterNames.VALUE) as string,
				);
			}

			this.socket.write(response.pack());
		} else {
			throw new Error(`The object with id '${request.oId}' doesn't exist`);
		}
	}

	/**
	 * Sends back a response for the sync-Operation of a PDObject
	 * @param request Request from the client
	 */
	private handlePdObjectSync(request: SDSResponse) {
		const response = new SDSRequest();
		response.oId = "0:0";
		response.operation = 0;
		this.socket.write(response.pack());
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
		try {
			switch (request.operation) {
				case Operations.CHANGE_USER:
					this.handleChangeUserRequest(request);
					break;

				case Operations.COM_OPERATION:
					this.handleComOperationRequest(request);
					break;

				case Operations.CHANGE_PRINCIPAL:
					this.handleChangePrincipalRequest(request);
					break;

				case Operations.PDCLASS_NEWOBJECT:
					this.handlePDClassNewObject(request);
					break;

				case Operations.PDCLASS_PTR:
					this.handlePDClassPtr(request);
					break;

				case Operations.PDOBJECT_SETATTRIBUTE:
					this.handlePDObjectSetAttribute(request);
					break;

				case Operations.PDOBJECT_GETATTRIBUTE:
					this.handlePDObjectGetAttribute(request);
					break;

				case Operations.PDOBJECT_SYNC:
					this.handlePdObjectSync(request);
					break;

				case Operations.PDMETA_GETSTRING:
					// just return a random string for the requested error code. The tests should not match the
					// translated error message. It can change in the future and they are not part of this module
					const response = new SDSRequest();
					response.addParameter(ParameterNames.RETURN_VALUE, "<random>");
					response.operation = 173;
					this.socket.write(response.pack());
					break;

				default:
					// Unsupported operation
					throw new Error(`Unknown operation: ${request.operation}`);
				}
		} catch (err) {
			this.socket.write(SDSConnection.INVALID);
		}

	}
}
