import { expect, should } from "chai";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { SDSConnection } from "../../src/sds/SDSConnection";
import { ADMIN_USER, ADMIN_USER_PASS, HOST, isLiveMode, PORT, TEST_PRINCIPAL } from "../env.test";
import { MockedJanusServer } from "../MockedJanusServer";

/* tslint:disable:no-unused-expression */
chai.use(chaiAsPromised);

describe("Tests for the PDMeta-class", () => {
	// For the unit tests we need to mock a JANUS-server that sends back meaningful and
	// correct responses to incoming requests
	const mockedJANUSServer = new MockedJanusServer();
	const sdsConnection = new SDSConnection();

	before(async () => {
		// Init the mocked JANUS-server and connect with it to test operations of the PDClass
		await mockedJANUSServer.init();
		await sdsConnection.connect("test.node-sds.pdclass", HOST, PORT);
		await sdsConnection.PDClass.changeUser(ADMIN_USER, ADMIN_USER_PASS);
		await sdsConnection.PDClass.changePrincipal(TEST_PRINCIPAL);
	});

	// this test cannot be executed against a live system because we didn't know the returned
	// error messages
	(isLiveMode()) ? it.skip : it("should return an error message for some given error codes", () => {
		// Simply test if the request is valid with one error code
		return expect(sdsConnection.PDMeta.getString(16))
			.to.eventually.equals(`<random>`);
	});

	it("should return a list of available classes of the JANUS-application", () => {
		return expect(sdsConnection.PDMeta.getClasses()).to.eventually
			.include("AccessProfile")
			.include("DlcAction")
			.include("Fellow");
	});

	it("should return the id as a number of the passed JANUS-class", () => {
		return expect(sdsConnection.PDMeta.getClassId("AccessProfile")).to.eventually.be.a("number");
	});

	after(() => {
		sdsConnection.disconnect();
		mockedJANUSServer.close();
	});
});
