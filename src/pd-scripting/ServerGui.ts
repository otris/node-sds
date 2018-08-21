import { SDSConnection } from "../sds/SDSConnection";
import { Operations, ParameterNames, ServerGuiOperations } from "../sds/SDSMessage";
import { SDSRequest } from "../sds/SDSRequest";
import { JANUSClass } from "./JANUSClass";

export interface ILogMessages {
	lastSeen: number;
	messages: string[];
}

export class ServerGui extends JANUSClass {
	constructor(sdsConnection: SDSConnection) {
		super(sdsConnection);
	}

	/**
	 * Requests the log messages of the server
	 * @param lastSeen A transient number that identifies the log lines already retrieved.
	 * @returns The log messages of the server since the last seen value and the new last seen value
	 */
	public getLogMessages(lastSeen: number = -1): Promise<ILogMessages> {
		return new Promise<ILogMessages>(async (resolve, reject) => {
			const request = new SDSRequest();
			request.operation = Operations.SERVER_GUI_OPERATION;
			request.addParameter(ParameterNames.OPERATION_CODE, ServerGuiOperations.GET_LOG_MESSAGES);
			request.addParameter(ParameterNames.SOMETHING, lastSeen);
			request.addParameter(ParameterNames.CONVERSION, true); // convert tu UTF-8

			const response = await this.sdsConnection.send(request);
			const isUtf8Encoded = response.getParameter(ParameterNames.CONVERSION) as boolean;
			if (!isUtf8Encoded) {
				const errorMessage = await this.getFormattedError(`The return value is not utf-8 encoded`);
				reject(new Error(errorMessage));
			}

			const logMessagesLines = (response.getParameter(ParameterNames.RETURN_VALUE) as string).trim();
			const logMessages: ILogMessages = {
				lastSeen: response.getParameter(ParameterNames.LAST) as number,
				messages: (logMessagesLines.length === 0) ? [] : logMessagesLines.split(/\r?\n/g), // @todo: split the lines not by a new line, but maybe by the client identifier?
			};
			resolve(logMessages);
		});
	}
}
