export class PDObject {

	private _isTransactional: boolean;

	constructor(private _oId: string, private _classId: number, private _className: string) {
		this._isTransactional = parseInt(this._oId.split(":")[1], 10) < 0;
	}

	/** Object-ID of the PD-Object */
	public get oId(): string {
		return this._oId;
	}

	/** ID of the class */
	public get classId(): number {
		return this._classId;
	}

	/** Class name of the PD-Object */
	public get className(): string {
		return this._className;
	}

	/** Indicates if an object is a transaction object or not */
	public get isTransactional(): boolean {
		return this._isTransactional;
	}
}
