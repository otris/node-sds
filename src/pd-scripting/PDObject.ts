import { SDSConnection } from "../sds/SDSConnection";
import { Operations } from "../sds/SDSMessage";
import { SDSRequest } from "../sds/SDSRequest";
import { JANUSClass } from "./JANUSClass";

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
}
