import { SDSConnection } from "../sds/SDSConnection";
import { ParameterNames } from "../sds/SDSMessage";
import { ComOperations, Operations } from "../sds/SDSMessage";
import { SDSRequest } from "../sds/SDSRequest";
import { JANUSClass } from "./JANUSClass";

export class CustomOperations extends JANUSClass {
	constructor(sdsConnection: SDSConnection) {
		super(sdsConnection);
	}

	/**
	 * Executes the passed script on the server
	 * @param sourceCode The complete script that should be executed on the server.
	 * @param scriptUrl A string that is used to identify the script, e.g. the filename or an URL
	 */
	public runScriptOnServer(sourceCode: string, scriptUrl?: string): Promise<string> {
		return new Promise<string>(async (resolve, reject) => {
			const request = new SDSRequest();
			request.operation = Operations.COM_OPERATION;
			request.addParameter(ParameterNames.INDEX, ComOperations.RUN_SCRIPT_ON_SERVER);
			request.addParameter(ParameterNames.PARAMETER, sourceCode);

			if (!!scriptUrl) {
				request.addParameter(ParameterNames.FILENAME, scriptUrl);
			}

			const response = await this.sdsConnection.send(request);
			const result = response.getParameter(ParameterNames.RETURN_VALUE) as boolean;
			if (result) {
				const executionResult = response.getParameter(ParameterNames.PARAMETER) as string;
				resolve(executionResult);
			} else {
				const errorMessage = await this.getFormattedError(`Unable to execute the passed script`);
				reject(new Error(errorMessage));
			}
		});
	}
}
