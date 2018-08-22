import { crypt_md5, Hash } from "../cryptmd5";
import { SDSConnection } from "../sds/SDSConnection";
import { Operations, ParameterNames } from "../sds/SDSMessage";
import { SDSRequest } from "../sds/SDSRequest";
import { JANUSClass, OperationReturnValue } from "./JANUSClass";
import { PDObject } from "./PDObject";

/** Id of a logged in user */
export type UserId = number;

export class PDClass extends JANUSClass {
	/** Salt for hashing passwords before sending them to the JANUS-server */
	public static JANUS_CRYPTMD5_SALT: string = "o3";

	/** Map with the user ids */
	private userIds: Map<string, number>;

	constructor(sdsConnection: SDSConnection) {
		super(sdsConnection);
		this.userIds = new Map();
	}

	/**
	 * Executes an operation on the JANUS-server
	 * @todo This function is untested
	 * @param operation Name of the operation
	 * @param parameters The parameters of the operation
	 * @param parametersPDO TODO
	 * @returns Execution result of the operation
	 */
	public callOperation(operation: string, parameters?: string[], pdObjects?: PDObject[]): Promise<number> {
		return this.callOperationInternal(false, operation, parameters, pdObjects) as Promise<number>;
	}

	/**
	 * Executes an operation on the JANUS-server asynchronously
	 * @todo This function is untested
	 * @param operation Name of the operation
	 * @param parameters The parameters of the operation
	 * @param parametersPDO TODO
	 */
	public callOperationAsync(operation: string, parameters?: string[], pdObjects?: PDObject[]): Promise<void> {
		return this.callOperationInternal(true, operation, parameters, pdObjects) as Promise<void>;
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
	 * @param principal The principal name where the user is registered (needed if you want to change to a fellow)
	 * @returns The id of the user
	 */
	public changeUser(login: string, password: string | Hash, principal?: string): Promise<UserId> {
		return new Promise<UserId>(async (resolve, reject) => {
			const hashedPassword: string = (password instanceof Hash)
				? password.value
				:
				(password === "") // When the password is an empty string, don't hash it
					? ""
					: crypt_md5(password, PDClass.JANUS_CRYPTMD5_SALT).value;

			if (login !== "admin" && !!principal && !login.endsWith(`.${principal}`)) {
				login = `${login}.${principal}`;
			}

			const request = new SDSRequest();
			request.operation = Operations.CHANGE_USER;
			request.addParameter(ParameterNames.USER, login);
			request.addParameter(ParameterNames.PASSWORD, hashedPassword);

			const response = await this.sdsConnection.send(request);
			const result = response.getParameter(ParameterNames.RETURN_VALUE) as number;
			if (result === 0) {
				let userId: number = -1;
				if (!this.userIds.has(login)) {
					userId = response.getParameter(ParameterNames.USER_ID);
					this.userIds.set(login, userId);
				} else if (this.userIds.has(login)) {
					userId = this.userIds.get(login) as number;
				} else {
					const errorMessage = await this.getFormattedError(`Change user request failed: Could not determine the user id`);
					reject(new Error(errorMessage));
				}

				resolve(userId);
			} else {
				// Error occurred. Get the error message from the server
				const errorMessage = await this.getFormattedError(`Change user request failed. Maybe you forgot to provide the principal?`, result, this.sdsConnection.PDMeta.errorMessage);
				reject(new Error(errorMessage));
			}
		}).then<UserId>(async (userId: UserId) => {
			// if a principal is provided, call a change principal request, because the server requires that after a change user request a change principal request will be send
			if (!!principal) {
				await this.changePrincipal(principal);
			}

			return userId;
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

	/**
	 * Executes an operation on the JANUS-server.
	 * @param operation Name of the operation
	 * @param parameters The parameters of the operation
	 * @param parametersPDO TODO
	 */
	private callOperationInternal(async: boolean, operation: string, parameters?: string[], pdObjects?: PDObject[]): Promise<OperationReturnValue> {
		return new Promise<OperationReturnValue>(async (resolve, reject) => {
			const request = new SDSRequest();
			request.operation = (async) ? Operations.PDCLASS_CALL_ASYNC : Operations.PDCLASS_CALL_SYNC;
			request.addParameter(ParameterNames.CLASS_NAME, operation);

			if (Array.isArray(parameters)) {
				// note: once the operation is parameterized, the operation code is different!
				request.operation = (async) ? Operations.PDCLASS_CALL_ASYNC_PARAMETERIZED : Operations.PDCLASS_CALL_SYNC_PARAMETERIZED;

				if (parameters.length > 0) {
					request.addParameter(ParameterNames.PARAMETER, parameters);
				}

				if (Array.isArray(pdObjects) && pdObjects.length > 0) {
					request.addParameter(ParameterNames.PARAMETER_PDO, pdObjects.map((pdObject: PDObject): string => pdObject.oId));
				}
			}

			const response = await this.sdsConnection.send(request);
			if (async) {
				// the server doesn't wait for the operation to finish
				// so we have no clue about the success or failure of the execution
				resolve();
			} else {
				const result = response.getParameter(ParameterNames.RETURN_VALUE) as number;
				resolve(result);
			}
		});
	}
}
