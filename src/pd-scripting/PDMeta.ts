import { SDSConnection } from "../sds/SDSConnection";
import { ComOperations, Operations, ParameterNames } from "../sds/SDSMessage";
import { SDSRequest } from "../sds/SDSRequest";
import { JANUSClass } from "./JANUSClass";

export class PDMeta extends JANUSClass {

	/** Map with the available PDClasses and their class id */
	private pdClassesMap: Map<string, number>;

	constructor(sdsConnection: SDSConnection) {
		super(sdsConnection);
		this.pdClassesMap = new Map();
	}

	/**
	 * Returns a list with the name of available PDClasses of the JANUS-application
	 * @param abstractClasses Determines if abstract classes should be returned
	 * @returns List with the class names
	 */
	public getClasses(abstractClasses: boolean = false): Promise<string[]> {
		return new Promise(async (resolve, reject) => {
			const request = new SDSRequest();
			request.operation = Operations.COM_OPERATION;
			request.addParameter(ParameterNames.INDEX, ComOperations.GET_CLASSES);
			request.addParameter(ParameterNames.PROPERTIES, abstractClasses);

			const response = await this.sdsConnection.send(request);
			const classNames = response.getParameter(ParameterNames.RETURN_VALUE) as string[];
			resolve(classNames);
		});
	}

	/**
	 * Resolves the internal class id for the passed class
	 * @param className Name of the class
	 * @returns Id of the class
	 */
	public getClassId(className: string): Promise<number> {
		return new Promise(async (resolve, reject) => {
			if (this.pdClassesMap.has(className)) {
				resolve(this.pdClassesMap.get(className));
			} else {
				const request = new SDSRequest();
				request.operation = Operations.COM_OPERATION;
				request.addParameter(ParameterNames.INDEX, ComOperations.GET_CLASS_ID);
				request.addParameter(ParameterNames.CLASS_NAME, className);

				const response = await this.sdsConnection.send(request);
				const classId = response.getParameter(ParameterNames.CLASS_ID) as number;
				this.pdClassesMap.set(className, classId);
				resolve(classId);
			}
		});
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

	/**
	 * Initializes internal members. This function will be invoked by the function constructor
	 * but it's executed asynchronously. This function bocks the sdsConnection so that no new
	 * requests can be send until this function is finished
	 */
	public initialize(): Promise<void> {
		return new Promise(async (resolve, reject) => {
			// get all class names
			const classNamesArray = await this.getClasses();
			for (const className of classNamesArray) {
				// get the id of the class and save the result to the class name map
				const classId = await this.getClassId(className);
				this.pdClassesMap.set(className, classId);
			}

			resolve();
		});
	}
}
