import { expect, should } from "chai";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { SDSConnection } from "../../src/sds/SDSConnection";
import { MockedJanusServer } from "../MockedJanusServer";

chai.use(chaiAsPromised);

describe("Tests for the connection handler for the communication with the JANUS-server", async () => {
	// For the unit tests we need to mock a JANUS-server that sends back meaningful and
	// correct responses to incoming requests
	const mockedJANUSServer = new MockedJanusServer();
	const sdsConnection = new SDSConnection();

	before(async () => {
		// Init the mocked JANUS-server and connect with it to test operations of the PDClass
		await mockedJANUSServer.init();
		await sdsConnection.connect("test.node-sds.pdclass", "localhost", 11001);
	});

	it("should successfully change the logged in user", () => {
		return expect(sdsConnection.PDClass.changeUser("admin", "test123")).to.not.be.eventually.rejected;
	});

	it("should return the id of the logged in user", async () => {
		const userId = await sdsConnection.PDClass.changeUser("admin", "test123");
		expect(userId).to.be.a("number").and.to.equal(1);
	});

	it("should successfully change the logged in user when no password is set", () => {
		return expect(sdsConnection.PDClass.changeUser("admin2", "")).to.not.be.eventually.rejected;
	});

	it("should reject the changeUser-request because the user doesn't exists", () => {
		return expect(sdsConnection.PDClass.changeUser("notExisting", "test123"))
			.to.be.eventually.rejectedWith(Error)
			.and.have.property("message").which.equals(`Change user request failed: Login-Name, Mandant oder Passwort für "%v" nicht korrekt.`);
	});

	it("should reject the changeUser-request because the password is wrong", () => {
		return expect(sdsConnection.PDClass.changeUser("admin", "wrongPassword"))
			.to.be.eventually.rejectedWith(Error)
			.and.have.property("message").which.equals(`Change user request failed: Login-Name oder Passwort für "%v" nicht korrekt.`);
	});
});
