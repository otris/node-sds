import { crypt_md5, Hash } from "../cryptmd5";
import { SDSConnection } from "../sds/SDSConnection";
import { Operations, ParameterNames } from "../sds/SDSMessage";
import { SDSRequest } from "../sds/SDSRequest";
import { JANUSClass } from "./JANUSClass";
import { PDObject } from "./PDObject";

/** Id of a logged in user */
export type UserId = number;

export class PDClass extends JANUSClass {
	/** Salt for hashing passwords before sending them to the JANUS-server */
	public static JANUS_CRYPTMD5_SALT: string = "o3";

	constructor(sdsConnection: SDSConnection) {
		super(sdsConnection);
	}

	/**
	 * Changes the principal which the client is connected to
	 * @param principal Name of the principal
	 */
	public changePrincipal(principal: string): Promise<void> {
		return new Promise<void>(async (resolve, reject) => {
			const request = new SDSRequest();
			request.operation = Operations.CHANGE_PRINCIPAL;
			request.addParameter(ParameterNames.PRINCIPAL, principal);

			const response = await this.sdsConnection.send(request);
			const result = response.getParameter(ParameterNames.RETURN_VALUE) as number;
			if (result === 0) {
				resolve();
			} else {
				const errorMessage = await this.getFormattedError(`Unable to change principal to '${principal}'`, result);
				reject(new Error(errorMessage));
			}
		});
	}

	/**
	 * Changes the user which is logged in
	 * @param login Login of the user
	 * @param password password of the user or hashed MD5-value of the password
	 * @returns The id of the user
	 */
	public changeUser(login: string, password: string | Hash): Promise<UserId> {
		return new Promise(async (resolve, reject) => {
			const hashedPassword: string = (password instanceof Hash)
				? password.value
				:
				(password === "") // When the password is an empty string, don't hash it
					? ""
					: crypt_md5(password, PDClass.JANUS_CRYPTMD5_SALT).value;

			const request = new SDSRequest();
			request.operation = Operations.CHANGE_USER;
			request.addParameter(ParameterNames.USER, login);
			request.addParameter(ParameterNames.PASSWORD, hashedPassword);

			const response = await this.sdsConnection.send(request);
			const result = response.getParameter(ParameterNames.RETURN_VALUE) as number;
			if (result === 0) {
				resolve(response.getParameter(ParameterNames.USER_ID));
			} else {
				// Error occurred. Get the error message from the server
				const errorMessage = await this.getFormattedError(`Change user request failed`, result, this.sdsConnection.PDMeta.errorMessage);
				reject(new Error(errorMessage));
			}
		});
	}

	/**
	 * Creates a instance of a given class
	 * @param className Class name to create an instance of
	 * @param isTransactionObject Specifies if the object is a transaction object
	 * @param initDefaults Specifies if default values should be initialized
	 */
	public newObject(className: string, isTransactionObject: boolean = false, initDefaults: boolean = true): Promise<PDObject> {
		return new Promise(async (resolve, reject) => {
			const request = new SDSRequest();
			request.operation = Operations.PDCLASS_NEWOBJECT;
			request.addParameter(ParameterNames.IS_TRANSACTION_OBJECT, isTransactionObject);
			request.addParameter(ParameterNames.INIT, initDefaults);

			const classId = await this.sdsConnection.PDMeta.getClassId(className); // classes and class names are cached, so this causes no performance issues
			request.addParameter(ParameterNames.CLASS_ID, classId);

			const response = await this.sdsConnection.send(request);
			if (response.oId === "0:0") {
				// error occurred
				const result = response.getParameter(ParameterNames.RETURN_VALUE) as number;
				const errorMessage = await this.getFormattedError(`Unable to create object of class '${className}'`, result);
				reject(new Error(errorMessage));
			} else {
				const pdObject = new PDObject(this.sdsConnection, response.oId, classId, className);
				resolve(pdObject);
			}
		});
	}

	/**
	 * Fetches the object by its id
	 * @param oId Id of the object
	 * @returns The object with the passed id
	 */
	public ptr(oId: string): Promise<PDObject> {
		return new Promise(async (resolve, reject) => {
			const request = new SDSRequest();
			request.operation = Operations.PDCLASS_PTR;
			request.oId = oId;

			const response = await this.sdsConnection.send(request);
			if (response.oId === "0:0") {
				// the object doesn't exists
				reject(new Error(`The object with id '${oId}' does not exists`));
			} else {
				const pdObject = new PDObject(this.sdsConnection, oId);
				resolve(pdObject);
			}
		});
	}
}
