import * as assert from "assert";
import { htonl, ntohl } from "../network";
import { SDSConnection } from "./SDSConnection";
import { IParameterNamesTypesMap, Operations, ParameterNames, SDSMessage, Types } from "./SDSMessage";

/** The first index a parameter can occur in a valid sds message */
const FIRST_PARAM_INDEX = 13;

/** Map with the paramter names (key = value of the enum, value = Name of the enum property) */
const parameterNamesMap: Map<ParameterNames, string> = (() => {
	const parameterNamesKeys = Object.keys(ParameterNames);
	const _parameterNamesMap = new Map();
	for (let i = parameterNamesKeys.length / 2; i < parameterNamesKeys.length; i++) {
		_parameterNamesMap.set(parseInt(parameterNamesKeys[i - parameterNamesKeys.length / 2], 10), parameterNamesKeys[i]);
	}

	return _parameterNamesMap;
})();

/** Map with the paramter names (key = value of the enum, value = Name of the enum property) */
const typesMap: Map<Types, string> = (() => {
	const typesKeys = Object.keys(Types);
	const _typesMap = new Map();
	for (let i = typesKeys.length / 2; i < typesKeys.length; i++) {
		_typesMap.set(parseInt(typesKeys[i - typesKeys.length / 2], 10), typesKeys[i]);
	}

	return _typesMap;
})();

interface IResponseParameter {
	name: string;
	nameIndex: ParameterNames;
	type: string;
	typeIndex: Types;
	value: any;
}

export class SDSResponse extends SDSMessage {
	/** Map with all response parameters of the response */
	private parameters: Map<ParameterNames, IResponseParameter>;

	/**
	 * Parses the response from the JANUS-server and provides some operation to read the message
	 * @param buffer Response buffer returned from the JANUS-server
	 */
	constructor(buffer: Buffer, parseBuffer: boolean = true) {
		super(buffer);

		// create a map of parameters. It's easier for debugging and allows us to return requested parameters by
		// using the map
		if (parseBuffer) {
			this.parameters = this.parseResponseParameters();
		} else {
			this.parameters = new Map();
		}
	}

	/**
	 * Returns the object id the response belongs to
	 * @returns The object id the response belongs to
	 */
	public get oId(): string {
		if (this._oId.length < 1) {
			// Byte 1 - 4 = Länge der Nachricht
			// Byte 5 - 12 = OID
			const oIdFirst = ntohl(this.buffer, 4);
			const oIdLast = ntohl(this.buffer, 8);
			this._oId = `${oIdFirst}:${oIdLast}`;
		}

		return this._oId;
	}

	/**
	 * Sets the object id to operate on
	 * @param oId ID of the PD-Object
	 * @returns The object id to operate on
	 */
	public set oId(oId: string) {
		this._oId = oId;

		// note: the id will be moved to byte 5 to 13 while packaging
		// the first four bytes represents the size of the whole message. These bytes will be set by the packaging-function
		const splittedId = oId.split(":");
		htonl(this.buffer, 0, parseInt(splittedId[0], 10));
		htonl(this.buffer, 4, parseInt(splittedId[1], 10));
	}

	/**
	 * Returns the operation which should be executed
	 * @returns Operation which should be executed
	 */
	public get operation(): Operations {
		if (this._operation < 0) {
			this._operation = this.buffer[12];
		}

		return this._operation;
	}

	/**
	 * Sets the operation to execute on the server side
	 * @param operation Identifier of the operation
	 */
	public set operation(operation: Operations) {
		// note: it's actually the 13th byte which will be set. The packaging function will insert 4 more bytes at the beginning
		this.buffer[8] = this._operation = operation;
	}

	/**
	 * Extracts the passed parameter from the response
	 * @param parameterName Name of the parameter
	 * @returns The value of the passed parameter
	 */
	public getParameter<T extends ParameterNames>(parameterName: T): IParameterNamesTypesMap[T] {
		const responseParameter = this.parameters.get(parameterName);
		if (responseParameter) {
			return responseParameter.value;
		} else {
			throw new Error(`Unknown paramter: ${parameterName}.\r\nParameters: ${JSON.stringify([...this.parameters.keys()])}`);
		}
	}

	/**
	 * Determines if the response is a ACK
	 * @returns true, if the response is an ACK, otherwise false
	 */
	public isACK(): boolean {
		return this.buffer.equals(SDSConnection.ACK);
	}

	/**
	 * Determines if the request was invalid
	 * @returns true, if the response is an ACK, otherwise false
	 */
	public isInvalid(): boolean {
		return this.buffer.equals(SDSConnection.INVALID);
	}

	public toString(): string {
		let out = `${JSON.stringify(this.buffer)}\r\n\r\nBuffered length: ${this.bufferedLength}\r\nOId: ${this.oId}\r\nOperation: ${this.operation}\r\nParameters (${this.parameters.size})`;
		if (this.parameters.size > 0) {
			out += ":";
			for (const [key, value] of this.parameters) {
				out += `\r\n${JSON.stringify(value)}`;
			}
		}

		return out;
	}

	/**
	 * Returns the value of a parameter
	 * @param paramIndex Start index of the parameter
	 * @param headType Suggested parameter type (needed for validation)
	 * @returns The value of the parameter
	 */
	private getBooleanParameter(paramIndex: number, headType: Types): boolean {
		assert.ok((headType & ~Types.NULL_FLAG) === Types.BOOLEAN);
		if (headType & Types.NULL_FLAG) {
			return false;
		} else {
			return true;
		}
	}

	/**
	 * Returns the value of a parameter
	 * @param paramIndex Start index of the parameter
	 * @param headType Suggested parameter type (needed for validation)
	 * @returns The value of the parameter
	 */
	private getIntParameter(paramIndex: number, headType: Types): number {
		assert.ok((headType & ~Types.NULL_FLAG) === Types.INT32);
		return ntohl(this.buffer, paramIndex + 2);
	}

	/**
	 * Returns the value of a parameter
	 * @param paramIndex Start index of the parameter
	 * @param headType Suggested parameter type (needed for validation)
	 * @returns The value of the parameter
	 */
	private getStringListParameter(paramIndex: number, headType: Types): string[] {
		assert.ok((headType & ~Types.NULL_FLAG) === Types.STRING_LIST);
		if (headType & Types.NULL_FLAG) {
			return [];
		}

		// ----- header of parameter -----
		// paramIndex[0]: type
		// paramIndex[1]: name-code
		// ----- data-part of parameter -----
		// paramIndex[2..5]: size of data-part of the parameter (StringList)
		// paramIndex[6..9]: size of the StringList (number of elements)
		// paramIndex[10..13]: strLen: size of the first string (bytes)
		// paramIndex[14...]: first string
		// paramIndex[14 + strLen ...]: size of second string
		// paramIndex[14 + strLen + 4 ...]: second string
		// ...

		// const dataPartSize = ntohl(this.buffer, paramIndex + 2);

		const numElem = ntohl(this.buffer, paramIndex + 6);
		const returnList: string[] = [];
		let listPtr = paramIndex + 10;

		for (let i = 0; i < numElem; i++) {
			const strLen = ntohl(this.buffer, listPtr);
			listPtr += 4;
			const str = this.buffer.toString("utf8", listPtr, listPtr + strLen - 1);
			listPtr += strLen;
			returnList.push(str);
		}

		return returnList;
	}

	/**
	 * Returns the value of a parameter
	 * @param paramIndex Start index of the parameter
	 * @param headType Suggested parameter type (needed for validation)
	 * @returns The value of the parameter
	 */
	private getStringParameter(paramIndex: number, headType: Types): string {
		assert.ok((headType & ~Types.NULL_FLAG) === Types.STRING);
		if (headType & Types.NULL_FLAG) {
			return "";
		}

		const strLength = ntohl(this.buffer, paramIndex + 2) - 1;
		// Note: we expect here that the opposite party is a JANUS server compiled with UTF-8 support.
		return this.buffer.toString("utf8", paramIndex + 6, paramIndex + 6 + strLength);
	}

	/**
	 * Determines the size of the parameter
	 * @param paramIndex Index of the parameter in the message buffer
	 * @returns Size of the parameter
	 */
	private paramLength(paramIndex: number): number {

		// head: 2 bytes
		//       head.type: 1 byte
		//       head.name: 1 byte
		//
		// data: 0 or more bytes, depending on head.type
		//       if head.type is Type.Int32 or Type.Date: 4 bytes
		//       if head.type is Type.OID: 8 bytes
		//       and so on

		assert.ok(paramIndex >= FIRST_PARAM_INDEX && paramIndex < this.buffer.length);

		const headType = this.buffer[paramIndex];

		if (headType & Types.NULL_FLAG) {
			// No data, just the head
			return 2;
		}

		switch (headType & ~Types.NULL_FLAG) {
			case Types.BOOLEAN:
				return 2;
			case Types.INT32:
			case Types.DATE:
				return 2 + 4;
			case Types.OID:
				// head: 2 + oid.low: 4 + oid.high: 4
				return 2 + (2 * 4);
			default:
				// head: 2 + size: 4 + whatever the size is
				return 2 + 4 + ntohl(this.buffer, paramIndex + 2);
		}
	}

	/**
	 * Creates a map with all return parameters of the response
	 * @returns Map with all return parameters of the response
	 */
	private parseResponseParameters(): Map<ParameterNames, IResponseParameter> {
		const responseParameters: Map<ParameterNames, IResponseParameter> = new Map();

		for (let i = FIRST_PARAM_INDEX; i < this.bufferedLength; i += this.paramLength(i)) {
			const responseParameter: IResponseParameter = {
				name: parameterNamesMap.get(this.buffer[i + 1]) || "<unknown>",
				nameIndex: this.buffer[i + 1],
				type: typesMap.get(this.buffer[i] & ~Types.NULL_FLAG) || "<unknown>",
				typeIndex: this.buffer[i] & ~Types.NULL_FLAG,
				value: null,
			};

			switch (responseParameter.typeIndex) {
				case Types.BOOLEAN:
					responseParameter.value = this.getBooleanParameter(i, this.buffer[i]);
					break;

				case Types.INT32:
					responseParameter.value = this.getIntParameter(i, Types.INT32);
					break;

				case Types.STRING:
					const stringSize = ntohl(this.buffer, i + 2);
					responseParameter.value = this.getStringParameter(i, Types.STRING);
					break;

				case Types.STRING_LIST:
					const stringListSize = ntohl(this.buffer, i + 2);
					responseParameter.value = this.getStringListParameter(i, Types.STRING_LIST);
					break;

				default:
					throw new Error(`Unknown parameter type: ${responseParameter.typeIndex}`);
			}

			if (responseParameters.has(responseParameter.nameIndex)) {
				// Should never happen, otherwise the JANUS-server is confused
				throw new Error(`Parameter ${responseParameter.name} already exists in the parameters map. Invalid response.`);
			} else {
				responseParameters.set(responseParameter.nameIndex, responseParameter);
			}
		}

		return responseParameters;
	}
}
