import { SDSConnection } from "../sds/SDSConnection";
import { ComOperations, Operations, ParameterNames } from "../sds/SDSMessage";
import { SDSRequest } from "../sds/SDSRequest";

export class PDMeta {

	/** The initialized sds connection */
	private sdsConnection: SDSConnection;

	constructor(sdsConnection: SDSConnection) {
		this.sdsConnection = sdsConnection;
	}

	/**
	 * Converts an error code to a error message
	 * This message returns a human-readable string (probably in German) for a given error code.
	 * @param errorCode The error code from a previous SDS call.
	 * @returns The error message
	 */
	public getString(errorCode: number): Promise<string> {
		return new Promise(async (resolve, reject) => {
			const request = new SDSRequest();
			request.operation = Operations.COM_OPERATION;
			request.addParameter(ParameterNames.INDEX, ComOperations.ERROR_MESSAGE);
			request.addParameter(ParameterNames.VALUE, errorCode);

			const response = await this.sdsConnection.send(request);
			const errorMessage: string = response.getParameter(ParameterNames.RETURN_VALUE) as string;
			resolve(errorMessage);
		});
	}
}
