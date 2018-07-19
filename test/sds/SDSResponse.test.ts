import { expect } from "chai";
import { SDSRequest } from "../../src/sds/SDSRequest";
import { SDSResponse } from "../../src/sds/SDSResponse";
import { ParameterNames } from "../../src/sds/SDSMessage";

function mockResponse(request: Buffer): SDSResponse {
	return new SDSResponse(request.slice(0, 13));
}

// chai expressions will be linted
/* tslint:disable:no-unused-expression */

describe("Tests evaluating SDS responses", () => {
	/** Contains parameter "CLIENT_ID" = 9 */
	const bufferWithIntParam = Buffer.from([0, 0, 0, 72, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1, 0, 0, 0, 9, 3, 34, 237, 209, 247, 229, 3, 35, 241, 39, 192, 170, 3, 8, 0, 0, 4, 21, 2, 12, 3, 37, 0, 0, 0, 2, 135, 4, 7, 2, 0, 0, 0, 11, 87, 105, 110, 100, 111, 119, 115, 32, 49, 48, 0, 3, 16, 0, 0, 0, 0, 130, 22]);

	/** Contains parameter "VALUE" = "" */
	const bufferWithStringParam = Buffer.from([0, 0, 0, 26, 0, 0, 0, 0, 0, 0, 0, 0, 33, 7, 4, 0, 0, 0, 1, 0, 3, 5, 0, 0, 65, 1]);

	/** Contains parameter "RETURN_VALUE" = true (Boolean) and parameter "PARAMETER" = "hallo, wie geht es dir?" (string) */
	const bufferWithBooleanParam = Buffer.from([0, 0, 0, 45, 0, 0, 0, 0, 0, 0, 0, 0, 199, 2, 5, 7, 48, 0, 0, 0, 24, 104, 97, 108, 108, 111, 44, 32, 119, 105, 101, 32, 103, 101, 104, 116, 32, 101, 115, 32, 100, 105, 114, 63, 0]);

	/** Contains parameter "RETURN_VALUE" = false (Boolean) and others */
	const bufferWithNegativeBooleanParam = Buffer.from([0, 0, 0, 35, 0, 0, 0, 0, 0, 0, 0, 0, 0, 130, 5, 3, 29, 255, 255, 255, 255, 7, 31, 0, 0, 0, 1, 0, 7, 30, 0, 0, 0, 1, 0]);

	/** Contains parameter "PARAMETER" = ["8063"] AND "RETURN_VALUE" = 3 */
	const bufferWithStringListParam = Buffer.from([0, 0, 0, 38, 0, 0, 0, 0, 0, 0, 0, 0, 199, 11, 48, 0, 0, 0, 13, 0, 0, 0, 1, 0, 0, 0, 5, 56, 48, 54, 51, 0, 3, 5, 0, 0, 0, 0]);

	it("Should extract the object id of the message", () => {
		const request = new SDSRequest();
		request.operation = 0;
		request.oId = "123:456";

		const response = mockResponse(request.pack());
		expect(response.oId).to.equal(request.oId);
	});

	it("Should extract the operation of the message", () => {
		const request = new SDSRequest();
		request.operation = 123;
		request.oId = "123:456";

		const response = mockResponse(request.pack());
		expect(response.operation).to.equal(request.operation);
	});

	it("should extract an integer parameter", () => {
		const response = new SDSResponse(bufferWithIntParam);
		expect(response.getParameter(ParameterNames.CLIENT_ID)).to.eq(9);
	});

	it("should extract a string parameter", () => {
		let response = new SDSResponse(bufferWithStringParam);
		expect(response.getParameter(ParameterNames.VALUE)).to.eq("");

		response = new SDSResponse(bufferWithBooleanParam);
		expect(response.getParameter(ParameterNames.PARAMETER)).to.eq("hallo, wie geht es dir?");
	});

	it("should extract a string list parameter", () => {
		const response = new SDSResponse(bufferWithStringListParam);
		expect(response.getParameter(ParameterNames.PARAMETER)).to.eql(["8063"]);
	});

	it("should extract a boolean parameter", () => {
		const response = new SDSResponse(bufferWithBooleanParam);
		expect(response.getParameter(ParameterNames.RETURN_VALUE)).to.be.true;
	});

	it("should extract a negative boolean parameter", () => {
		// Negative booleans (special case, because the JANUS-server sends a null flag)
		const response = new SDSResponse(bufferWithNegativeBooleanParam);
		expect(response.getParameter(ParameterNames.RETURN_VALUE)).to.be.false;
	});
});
