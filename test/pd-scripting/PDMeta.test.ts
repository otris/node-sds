import { expect, should } from "chai";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { SDSConnection } from "../../src/sds/SDSConnection";
import { MockedJanusServer } from "../MockedJanusServer";

chai.use(chaiAsPromised);

describe("Tests for the PDMeta-class", () => {
	// For the unit tests we need to mock a JANUS-server that sends back meaningful and
	// correct responses to incoming requests
	const mockedJANUSServer = new MockedJanusServer();
	const sdsConnection = new SDSConnection();

	before(async () => {
		// Init the mocked JANUS-server and connect with it to test operations of the PDClass
		await mockedJANUSServer.init();
		await sdsConnection.connect("test.node-sds.pdmeta", "localhost", 11001);
	});

	it("should return an error message for some given error codes", () => {
		// Simply test if the request is valid with one error code
		return expect(sdsConnection.PDMeta.getString(16)).to.eventually.equals(`Login-Name, Mandant oder Passwort für "%v" nicht korrekt.`);
	});

	it("should return a list of available classes of the JANUS-application", () => {
		return expect(sdsConnection.PDMeta.getClasses()).to.eventually.eql(["AccessProfile", "DlcAction", "Fellow"]);
	});

	it("should return the id as a number of the passed JANUS-class", () => {
		return expect(sdsConnection.PDMeta.getClassId("AccessProfile")).to.eventually.be.a("number");
	});
});
