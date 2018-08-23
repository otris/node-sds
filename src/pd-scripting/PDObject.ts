import { SDSConnection } from "../sds/SDSConnection";
import { Operations, ParameterNames } from "../sds/SDSMessage";
import { SDSRequest } from "../sds/SDSRequest";
import { SDSSimpleMessage } from "../sds/SDSSimpleMessage";
import { JANUSClass, OperationReturnValue } from "./JANUSClass";

export class PDObject extends JANUSClass {

	private _classId: number;
	private _className: string;
	private _isTransactional: boolean;

	constructor(sdsConnection: SDSConnection, private _oId: string, classId?: number, className?: string) {
		super(sdsConnection);
		this._classId = classId as any;
		this._className = className as any;
		this._isTransactional = parseInt(this._oId.split(":")[1], 10) < 0;
	}

	/** Object-ID of the PD-Object */
	public get oId(): string {
		return this._oId;
	}

	/** ID of the class */
	public get classId(): number {
		/** @TODO: Fetch this property if it's not set */
		return this._classId;
	}

	/** Class name of the PD-Object */
	public get className(): string {
		/** @TODO: Fetch this property if it's not set */
		return this._className;
	}

	/** Indicates if an object is a transaction object or not */
	public get isTransactional(): boolean {
		return this._isTransactional;
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
	 * Returns the value of an attribute
	 * @param attributeName Name of the attribute
	 * @returns Value of the attribute
	 */
	public getAttribute(attributeName: string): Promise<string> {
		return new Promise(async (resolve, reject) => {
			const request = new SDSRequest();
			request.oId = this.oId;
			request.operation = Operations.PDOBJECT_GETATTRIBUTE;
			request.addParameter(ParameterNames.CLASS_NAME, attributeName);

			const response = await this.sdsConnection.send(request);

			// @todo: The return value represent some flags which gives us informations about the success of this operation
			//        but I don't know how to evaluate these flags
			const result = response.getParameter(ParameterNames.RETURN_VALUE) as number;

			const attributeValue = response.getParameter(ParameterNames.VALUE) as string;
			resolve(attributeValue);
		});
	}

	/**
	 * Sets the value of an attribute
	 * @param attributeName Name of the attribute
	 * @param attributeValue Value of the attribute
	 * @throws Error if the attribute could not be set
	 */
	public setAttribute(attributeName: string, attributeValue: string): Promise<void> {
		return new Promise(async (resolve, reject) => {
			const request = new SDSRequest();
			request.oId = this.oId;
			request.operation = Operations.PDOBJECT_SETATTRIBUTE;
			request.addParameter(ParameterNames.CLASS_NAME, attributeName);
			request.addParameter(ParameterNames.VALUE, attributeValue);

			const response = await this.sdsConnection.sendSimple(request);
			if (response.result === 0) {
				resolve();
			} else {
				// see dissertation Niemann, p. 234, Tab. 1.1-5
				const errorMessageOperation = (response.result < 0) ? this.sdsConnection.PDMeta.getString : this.sdsConnection.PDMeta.errorMessage;
				const errorMessage = await this.getFormattedError(`Can't set attribute '${attributeName}' to '${attributeValue}'`, response.result, errorMessageOperation);
				reject(new Error(errorMessage));
			}
		});
	}

	/**
	 * Executes a sync to persist changes made on the PDObject
	 */
	public sync(): Promise<void> {
		return new Promise(async (resolve, reject) => {
			const request = new SDSRequest();
			request.oId = this.oId;
			request.operation = Operations.PDOBJECT_SYNC;

			// @todo: The sync operation can now not be used to change values of the object,
			// and it seems like this operation doesn't return any value which indicates the failure or success of
			// this operation
			await this.sdsConnection.send(request);
			resolve();
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
			request.oId = this.oId;
			request.operation = (async) ? Operations.PDOBJECT_CALL_ASYNC : Operations.PDOBJECT_CALL_SYNC;
			request.addParameter(ParameterNames.CLASS_NAME, operation);
			let response;

			if (Array.isArray(parameters)) {
				// note: once the operation is parameterized, the operation code is different!
				request.operation = (async) ? Operations.PDOBJECT_CALL_ASYNC_PARAMETERIZED : Operations.PDOBJECT_CALL_SYNC_PARAMETERIZED;

				if (parameters.length > 0) {
					request.addParameter(ParameterNames.PARAMETER, parameters);
				}

				if (Array.isArray(pdObjects) && pdObjects.length > 0) {
					request.addParameter(ParameterNames.PARAMETER_PDO, pdObjects.map((pdObject: PDObject): string => pdObject.oId));
				}
				response = await this.sdsConnection.send(request);
			} else {
				response = await this.sdsConnection.sendSimple(request);
			}

			if (async) {
				// the server doesn't wait for the operation to finish
				// so we have no clue about the success or failure of the execution
				resolve();
			} else {
				if (response instanceof SDSSimpleMessage) {
					const result = response.result;
					resolve(result);
				} else {
					const result = response.getParameter(ParameterNames.RETURN_VALUE) as number;
					resolve(result);
				}
			}
		});
	}
}
