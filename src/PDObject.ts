import { Message, ParameterName } from "./sds";

export class PDObject {
    constructor(private _oId: string, private _classId: number, private _className: string) {
    }

    public get oId(): string {
        return this._oId;
    }

    public sync(): Message {
        const msg = new Message();
        msg.setOId(this.oId);
        msg.setOperation(62);

        return msg;
    }

    public setAttribute(attributeName: string, attributeValue: any): Message {
        const msg = new Message();
        msg.setOId(this.oId);
        msg.setOperation(32);
        msg.addString(ParameterName.ClassName, attributeName);
        msg.addString(ParameterName.Value, attributeValue);
        return msg;
    }

    public getAttribute(attributeName: string) {
        const msg = new Message();
        msg.setOId(this.oId);
        msg.setOperation(33);
        msg.addString(ParameterName.ClassName, attributeName);
        return msg;
    }
}
