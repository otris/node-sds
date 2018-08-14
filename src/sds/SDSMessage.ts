export enum ComOperations {
	GET_CLASSES = 5,
	GET_CLASS_ID = 11,
	ERROR_MESSAGE = 17,
}

/**
 * Maps the paramter names to a specific type. This list has to be maintenend
 * parallel to the enum "ParameterNames"
 * Note: This list is incomplete. It's possible, that a parameter name has more types than defined here
 */
/* tslint:disable:member-ordering */
export interface IParameterNamesTypesMap {
	1: number;
	2: string;
	4: number | string;
	5: string | string[] | boolean | number;
	8: number;
	13: number;
	14: number;
	16: number;
	18: boolean;
	21: string;
	22: string;
	25: number;
	29: boolean;
	40: number;
	48: string | string[];
	49: string[];
	51: boolean;
	53: boolean;
	80: string;
	87: string;
	88: number;
	119: any; // TODO: Missing type informations
}
/* tslint:enable:member-ordering */

export enum Operations {
	CHANGE_PRINCIPAL = 203,
	CHANGE_USER = 27,

	PDOBJECT_SYNC = 62,
	PDCLASS_PTR = 53,
	PDCLASS_NEWOBJECT = 63,

	/** Used to request the string representation of an error code (PDMeta.getString) or to get the available class names of the JANUS-application (PDMeta.getClasses) */
	COM_OPERATION = 199,
}

/**
 * Names of parameters and return values of server side operations
 */
export enum ParameterNames {
	CLIENT_ID = 1,
	CLASS_NAME = 2,
	VALUE = 4,
	RETURN_VALUE = 5,
	SOMETHING = 8,
	INDEX = 13,
	LANGUAGE = 14,
	CLASS_ID = 16,
	IS_TRANSACTION_OBJECT = 18,
	USER = 21,
	PASSWORD = 22,
	LAST = 25,
	PROPERTIES = 29,
	USER_ID = 40,
	PARAMETER = 48,
	PARAMETER_PDO = 49,
	CONVERSION = 51,
	INIT = 53,
	PRINCIPAL = 80,
	FILENAME = 87,
	OP_CODE = 88,
	FLAG = 119,
}

export enum Types {
	BOOLEAN = 2,
	INT32 = 3,
	DATE = 4,
	STRING = 7,
	OID = 9,
	INT32_LIST = 10,
	STRING_LIST = 11,
	OID_LIST = 12,
	NULL_FLAG = 128,
}

/**
 * Base class of the SDSRequest and SDSResponse
 */
export abstract class SDSMessage {

	/** Holds the object id to operate on. By default, it's empty */
	protected _oId: string;

	/** Holds the operation to execute on the server side */
	protected _operation: Operations;

	/** Contains the SDSMessage */
	protected buffer: Buffer;

	/** Number of currently buffered bytes */
	protected bufferedLength: number;

	/** Initial size of the created buffer */
	private INITIAL_BUFFER_SIZE = 4096;

	/**
	 * Returns the object id the response belongs to
	 * @returns The object id the response belongs to
	 */
	public abstract get oId(): string;

	/**
	 * Returns the operation which should be executed
	 * @returns Operation which should be executed
	 */
	public abstract get operation(): Operations;

	constructor(buffer?: Buffer) {
		this._oId = "";
		this._operation = -1;

		if (buffer) {
			this.buffer = buffer;
			this.bufferedLength = ntohl(buffer, 0);
		} else {
			this.buffer = Buffer.alloc(this.INITIAL_BUFFER_SIZE);
			this.bufferedLength = 0;
		}
	}

	/**
	 * Returns the number of bytes of an utf-8 string plus a 0-terminus.
	 * @param {string} str An arbitrary string
	 * @returns Number of all code units plus a final '0'.
	 */
	public static length_term_utf8(str: string): number {
		const byteLength = Buffer.byteLength(str);
		return byteLength + 1;
	}

	/**
	 * Returns a buffer (the bytes) of an utf-8 string plus a 0-terminus.
	 * @param {string} str An arbitrary string
	 * @returns A buffer containing all code units plus a final '0'.
	 */
	public static term_utf8(str: string): Buffer {
		const byteLength = Buffer.byteLength(str);
		const buffer = Buffer.alloc(byteLength + 1, str, "utf-8");
		buffer[byteLength] = 0;
		return buffer;
	}

	public toString(): string {
		return `${JSON.stringify(this.buffer)}\r\n\r\nBuffered length: ${this.bufferedLength}\r\nOId: ${this.oId}\r\nOperation: ${this.operation}`;
	}

	/**
	 * Determines if the request/response is a "simple message"
	 * @returns true if it's a simple message, otherwise false
	 */
	protected isSimple(): boolean {
		return this.buffer.length === 8;
	}
}
