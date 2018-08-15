import { PDObject } from "../src/pd-scripting/PDObject";

export class MockedPDObject extends PDObject {
	public attributes: Map<string, string>;

	constructor(oId: string, classId?: number, className?: string) {
		super(null as any, oId, classId, className);
		this.attributes = new Map();
	}
}
