import { expect } from "chai";
import { Types, ParameterNames } from "../../src/sds/SDSMessage";
import { SDSRequest } from "../../src/sds/SDSRequest";

describe("Tests for generating sds requests", () => {
	it("should insert the object id to byte 4 to 12 after packaging", () => {
		const request = new SDSRequest();
		request.oId = "123:456";
		request.operation = 0;

		const packedRequest = request.pack();
		expect(packedRequest).to.have.lengthOf(13);
		const oIdOfPackedMessage = packedRequest.slice(4, 12);
		expect(oIdOfPackedMessage).to.eql(Buffer.from([0, 0, 0, 123, 0, 0, 1, 200]));
	});

	it("should create a 13 bytes long message after setting the object id", () => {
		const request = new SDSRequest();
		request.oId = "123:456";
		request.operation = 0;

		expect(request.pack()).to.have.lengthOf(13);
	});

	it("should fill byte 4 to 12 (for the oId) with 0-bytes by default", () => {
		const request = new SDSRequest();
		request.operation = 0;

		const packedRequest = request.pack();
		expect(packedRequest).to.have.lengthOf(13);
		const oIdOfPackedMessage = packedRequest.slice(4, 12);
		expect(oIdOfPackedMessage).to.eql(Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]));
	});

	it("should set the operation at byte 13", () => {
		const request = new SDSRequest();
		request.operation = 255;

		const packedRequest = request.pack();
		expect(packedRequest).to.have.lengthOf(13);
		expect(packedRequest[12]).to.eql(255);
	});

	it("should require the operation to be set", () => {
		const request = new SDSRequest();
		expect(request.pack.bind(request)).to.throw(Error, "Can't package the message: You have to set an operation first");

		request.operation = 0;
		expect(request.pack.bind(request)).not.to.throw();
	});

	it("should add a boolean parameter to the request", () => {
		const request = new SDSRequest();
		request.operation = 0;
		const parameterName = 0; // for the test case we don't have to use existing parameters
		request.addParameter(parameterName, true);

		const packedRequest = request.pack();
		expect(packedRequest).to.have.lengthOf(15);
		const messageParameter = packedRequest.slice(13, 15);
		expect(messageParameter).to.eql(Buffer.from([Types.BOOLEAN, parameterName]));
	});

	it("should add a null flag for falsy boolean parameters", () => {
		const request = new SDSRequest();
		request.operation = 0;
		const parameterName = 0; // for the test case we don't have to use existing parameters
		request.addParameter(parameterName, false);

		const packedRequest = request.pack();
		expect(packedRequest).to.have.lengthOf(15);
		const messageParameter = packedRequest.slice(13, 15);
		expect(messageParameter).to.eql(Buffer.from([Types.NULL_FLAG | Types.BOOLEAN, parameterName]));
	});

	it("should add an integer parameter to the request", () => {
		const request = new SDSRequest();
		request.operation = 0;
		const parameterName = 0; // for the test case we don't have to use existing parameters
		request.addParameter(parameterName, 123);

		const packedRequest = request.pack();
		expect(packedRequest).to.have.lengthOf(19);
		const messageParameter = packedRequest.slice(13, 19);
		expect(messageParameter).to.eql(Buffer.from([Types.INT32, parameterName, 0, 0, 0, 123]));
	});

	it("should add a string parameter to the request", () => {
		const request = new SDSRequest();
		request.operation = 0;
		const parameterName = 0; // for the test case we don't have to use existing parameters
		request.addParameter(parameterName, "123");

		const packedRequest = request.pack();
		expect(packedRequest).to.have.lengthOf(23);
		const messageParameter = packedRequest.slice(13, 23);
		expect(messageParameter).to.eql(Buffer.from([Types.STRING, parameterName, 0, 0, 0, 4, 49, 50, 51, 0]));
	});

	it("should add a string list parameter to the request", () => {
		const request = new SDSRequest();
		request.operation = 0;
		const parameterName = 0; // for the test case we don't have to use existing parameters
		request.addParameter(parameterName, ["123", "456"]);

		const packedRequest = request.pack();
		expect(packedRequest).to.have.lengthOf(39);
		const messageParameter = request.pack().slice(13, 39);
		expect(messageParameter).to.eql(Buffer.from([Types.STRING_LIST, parameterName, 0, 0, 0, 24, 0, 0, 0, 2, 0, 0, 0, 4, 49, 50, 51, 0, 0, 0, 0, 4, 52, 53, 54, 0]));
	});

	it("should not matter in which order properties of the SDSRequest-instance are set", () => {
		const expectedBuffer: Buffer = Buffer.from([0, 0, 0, 19, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 1]);

		// A bug causes that the some bytes were overwritten if you don't set the properties in a specific order
		let request = new SDSRequest();
		request.operation = 1; // The bug causes that the type of the paramter were overwritten by the operation
		request.addParameter(ParameterNames.CLIENT_ID, 1);
		expect(request.pack()).eql(expectedBuffer);

		request = new SDSRequest();
		request.addParameter(ParameterNames.CLIENT_ID, 1);
		request.operation = 1;
		expect(request.pack()).eql(expectedBuffer);

		request = new SDSRequest();
		request.operation = 1;
		request.addParameter(ParameterNames.CLIENT_ID, 1);
		request.oId = "0:0";
		expect(request.pack()).eql(expectedBuffer);
	});
});
