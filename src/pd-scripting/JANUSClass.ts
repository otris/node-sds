import { SDSConnection } from "../sds/SDSConnection";
import { PDMeta } from "./PDMeta";

/** Return value of a server operation */
export type OperationReturnValue = string | string[] | number | undefined;

/**
 * Callback type to convert an error code to an user friendly string
 * The callback function can be PDMeta.getString or PDMeta.errorMessage
 */
type IErrorStringOperation = (errorCode: number) => Promise<string>;

export abstract class JANUSClass {
	/** The initialized sds connection */
	protected sdsConnection: SDSConnection;

	constructor(sdsConnection: SDSConnection) {
		this.sdsConnection = sdsConnection;
	}

	/**
	 * Returns a formatted user friendly error message
	 * @param errorInfo Additional informations about the occurred error
	 * @param errorCode Error code
	 * @param operation The operation to convert the error code to a user friendly string message
	 * @returns User friendly error message
	 */
	protected getFormattedError(errorInfo: string, errorCode?: number, operation: IErrorStringOperation = this.sdsConnection.PDMeta.getString): Promise<string> {
		return new Promise(async (resolve, reject) => {
			if (typeof errorCode === "number") {
				const errorMessage = await operation.call(this, errorCode);
				resolve(`${errorInfo}.\r\nMessage: ${errorMessage}\r\nError code: ${errorCode}`);
			} else {
				resolve(`${errorInfo}.`);
			}
		});
	}
}
