import { SDSConnection } from "../sds/SDSConnection";

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
	 * @returns User friendly error message
	 */
	protected getFormattedError(errorInfo: string, errorCode?: number): Promise<string> {
		return new Promise(async (resolve, reject) => {
			if (typeof errorCode === "number") {
				const errorMessage = await this.sdsConnection.PDMeta.getString(errorCode);
				resolve(`${errorInfo}.\r\nMessage: ${errorMessage}\r\nError code: ${errorCode}`);
			} else {
				resolve(`${errorInfo}.`);
			}
		});
	}
}
