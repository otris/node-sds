/**
 * Names of parameters and return values of server side operations
 */
export enum ParameterNames {
}

export enum Operations {
}

export enum Types {
	BOOLEAN = 2,
	INT32 = 3,
	STRING = 7,
	STRING_LIST = 11,
	NULL_FLAG = 128,
}

/**
 * Base class of the SDSRequest and SDSResponse
 */
export abstract class SDSMessage {

	/** Contains the SDSMessage */
	protected buffer: Buffer;

	/** Number of currently buffered bytes */
	protected bufferedLength: number;

	/** Initial size of the created buffer */
	private INITIAL_BUFFER_SIZE = 4096;

	constructor() {
		this.buffer = Buffer.alloc(this.INITIAL_BUFFER_SIZE);
		this.bufferedLength = 0;
	}
}
