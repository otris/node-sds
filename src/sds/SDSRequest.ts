import { htonl } from "../network";
import { Operations, ParameterNames, SDSMessage, Types } from "./SDSMessage";

/**
 * Class for creating request message which can be send to the JANUS-application
 */
export class SDSRequest extends SDSMessage {

	/**
	 * Sets the object id to operate on
	 * @param oId ID of the PD-Object
	 * @returns The object id to operate on
	 */
	public set oId(oId: string) {
		// If the object id was set before, wo don't have to increase the buffered size again
		if (this._oId.length === 0) {
			this.bufferedLength += 8;
		}

		this._oId = oId;

		// note: the id will be moved to byte 5 to 13 while packaging
		// the first four bytes represents the size of the whole message. These bytes will be set by the packaging-function
		const splittedId = oId.split(":");
		htonl(this.buffer, 0, parseInt(splittedId[0], 10));
		htonl(this.buffer, 4, parseInt(splittedId[1], 10));
	}

	/**
	 * Sets the operation to execute on the server side
	 * @param operation Identifier of the operation
	 */
	public set operation(operation: Operations) {
		if (this._operation < 0) {
			this.bufferedLength++;
		}

		// note: it's actually the 13th byte which will be set. The packaging function will insert 4 more bytes at the beginning
		this.buffer[8] = this._operation = operation;
	}

	constructor() {
		super();
		this._oId = "";
		this._operation = -1;

		// by default, the oID should be filled with 0-bytes (global server operations)
		this.oId = "0:0";
	}

	/**
	 * Adds a parameter to the request
	 * @param parameterName Name of the parameter of the operation to add
	 * @param value Value of the parameter
	 */
	public addParameter(parameterName: ParameterNames, value: string | string[] | number | boolean) {
		if (Array.isArray(value)) {
			this.addStringList(parameterName, value);
		} else {
			switch (typeof value) {
				case "number":
					this.addInt32(parameterName, value as number);
					break;

				case "string":
					this.addString(parameterName, value as string);
					break;

				case "boolean":
					this.addBoolean(parameterName, value as boolean);
					break;

				default:
					// Can't be reached because of typing. But if we allow a new type and forget to
					// add a handler, we will get an exception instead of swallow the parameter
					throw new Error("Unknown value type: " + typeof value);
			}
		}
	}

	/**
	 * Prepares the message to be send to the JANUS-server
	 */
	public pack(): Buffer {
		if (this._operation < 0) {
			throw new Error("Can't package the message: You have to set an operation first");
		}

		// First 4 bytes of the head are the length of the entire message, including the length itself
		const messageSize = this.bufferedLength + 4;
		const message: Buffer = Buffer.alloc(messageSize);
		htonl(message, 0, messageSize);
		this.buffer.copy(message, 4, 0, this.bufferedLength);
		return message;
	}

	/**
	 * Appends the passed bytes to the message buffer
	 * @param bytes Bytes which should be appended to the buffer
	 */
	private add(bytes: Buffer | number[]) {
		const spaceLeft = this.buffer.length - this.bufferedLength;
		if (spaceLeft < bytes.length) {
			// @todo: Maybe we should use Buffer.concat instead (test which one is faster)
			const newCapacity = Math.max(this.bufferedLength + bytes.length, 1.5 * this.buffer.length);
			const newBuffer = Buffer.alloc(newCapacity);
			this.buffer.copy(newBuffer);
			this.buffer = newBuffer;
		}

		if (bytes instanceof Buffer) {
			// copy the bytes to the message buffer and make sure that all bytes were copied successfully
			const copiedBytes = bytes.copy(this.buffer, this.bufferedLength);
			if (copiedBytes !== bytes.length) {
				throw new Error(`Can't copy all bytes to the target buffer: Copied ${copiedBytes} of ${bytes.length} bytes.`);
			}

			this.bufferedLength += copiedBytes;
		} else {
			// Simply add the number values to the buffer, so we don't need to create a new buffer
			// which waste memory and time
			for (const byte of bytes) {
				this.buffer[this.bufferedLength] = byte;
				this.bufferedLength++;
			}
		}
	}

	/**
	 * Adds a parameter of type "boolean" to the request
	 * @param parameterName Name of the parameter
	 * @param value Value of the parameter
	 */
	private addBoolean(parameterName: ParameterNames, value: boolean) {
		let type = Types.BOOLEAN;

		// special case: if the boolean value is "false", we have to pass a null flag (bitwise or) o.O
		if (!value) {
			type |= Types.NULL_FLAG;
		}

		this.add([type, parameterName]);
	}

	/**
	 * Adds a parameter of type "int" to the request
	 * @param parameterName Name of the parameter
	 * @param value Value of the parameter
	 */
	private addInt32(parameterName: ParameterNames, value: number) {
		this.add([Types.INT32, parameterName]);

		// note: we can't directly pass "this.buffer" to the htonl function because we don't know if
		// the buffer has free space left
		const bytes = Buffer.from([0, 0, 0, 0]);
		htonl(bytes, 0, value);
		this.add(bytes);
	}

	/**
	 * Adds a parameter of type "string" to the request
	 * @param parameterName Name of the parameter
	 * @param value Value of the parameter
	 */
	private addString(parameterName: ParameterNames, value: string) {
		this.add([Types.STRING, parameterName]);

		// [..., string size in network byte order, the string itself]
		const stringSize = Buffer.from([0, 0, 0, 0]);
		htonl(stringSize, 0, this.length_term_utf8(value));
		this.add(stringSize);
		this.add(this.term_utf8(value));
	}

	/**
	 * Adds a string array parameter to the request
	 * @param parameterName Name of the parameter
	 * @param value Value of the parameter
	 */
	private addStringList(parameterName: ParameterNames, value: string[]) {
		// head-part of parameter
		this.add([Types.STRING_LIST, parameterName]);

		/*
		 data-part of parameter
		   1. size (byte length) in network byte order of the data part,
		   2. number of elements of the string array
		   3. Foreach element
		      3.1 string length of the element in n.b.o.
		      3.2 the encoded string itself
		*/

		// 1. The size (bytes) of the data-part
		//    We calculate this later. For now, we just add 4 empty bytes (n.b.o.) and note the index where the size is stored
		const dataSizeIndex = this.bufferedLength;
		this.add([0, 0, 0, 0]);

		// 2. The number of elements
		const networkByteOrderBuffer = Buffer.alloc(4);
		htonl(networkByteOrderBuffer, 0, value.length);
		this.add(networkByteOrderBuffer);

		// 3. Add each element of the array
		let dataPartSize = 8; // (Point 1) + (Point 2)
		for (const element of value) {
			// 3.1 Add the length of the element in network byte order
			const encodedElement = this.term_utf8(element);
			htonl(networkByteOrderBuffer, 0, encodedElement.length);
			this.add(networkByteOrderBuffer);

			// 3.2 Add the encoded string
			this.add(encodedElement);
			dataPartSize += 4 + encodedElement.length;
		}

		// Now we have to update the dataPartSize in the buffer
		htonl(this.buffer, dataSizeIndex, dataPartSize);
	}

	/**
	 * Returns the number of bytes of an utf-8 string plus a 0-terminus.
	 * @param {string} str An arbitrary string
	 * @returns Number of all code units plus a final '0'.
	 */
	private length_term_utf8(str: string): number {
		const byteLength = Buffer.byteLength(str);
		return byteLength + 1;
	}

	/**
	 * Returns a buffer (the bytes) of an utf-8 string plus a 0-terminus.
	 * @param {string} str An arbitrary string
	 * @returns A buffer containing all code units plus a final '0'.
	 */
	private term_utf8(str: string): Buffer {
		const byteLength = Buffer.byteLength(str);
		const buffer = Buffer.alloc(byteLength + 1, str, "utf-8");
		buffer[byteLength] = 0;
		return buffer;
	}

}
