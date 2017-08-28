/*
 * Copyright IBM Corporation 2017
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * core classes for tests
 */

'use strict';
const path = require('path');
const assert = require('assert');
// const yassert = require('yeoman-assert');
const helpers = require('yeoman-test');
const svcHelpers = require('./lib/service-helpers');
const common = require('./lib/java-test-helpers');
const Handlebars = require('handlebars');
const fs = require('fs');

const assertLiberty = common.test('liberty');
const assertSpring = common.test('spring');

const optionsBluemix = Object.assign({}, require('./resources/bluemix.json'));
const PATH_MAPPINGS_FILE = "./src/main/resources/mappings.json";
const LOCALDEV_CONFIG_JSON = 'localdev-config.json';

class Options {
	constructor(service, backendPlatform) {
		this.values = {
			serviceName: service.bluemixName,
			backendPlatform: backendPlatform
		}
	}

	assertConfig(framework, buildType, service, filePath) {
		if (filePath === undefined) {
			filePath = path.join(__dirname, "..", "generators", service.location, "templates", 'java-' + framework, "config.json.template");
		}
		const template = Handlebars.compile(fs.readFileSync(filePath, 'utf-8'));
		const expected = JSON.parse(template({bluemix: optionsBluemix}));
		let buildTest = common.test(buildType);

		if (expected.dependencies) {
			expected.dependencies.forEach(dep => {
				let scope = dep.scope || 'compile';     //default scope if not set
				buildTest.assertDependency(true, scope, dep.groupId, dep.artifactId, dep.version, dep.exclusions);
			});
		}
		if (expected.properties) {
			expected.properties.forEach(prop => {
				buildTest.assertProperty(prop.name, prop.value);
			});
		}
		this['assert' + framework + 'env'](expected);
		it('should generate mappings.json in ' + PATH_MAPPINGS_FILE, function () {
			assert.file(PATH_MAPPINGS_FILE);
		});
		it('should not generate mappings.json in ' + LOCALDEV_CONFIG_JSON, function () {
			assert.noFile(LOCALDEV_CONFIG_JSON);
		});
	}

	assertLocalDevConfig(framework, buildType, service) {
		let expected = {envEntries: []};
		Object.getOwnPropertyNames(service.localDevConfig).forEach(prop => {
			expected.envEntries.push({
				name: prop,
				value: service.localDevConfig[prop]
			});
		});
		this['assert' + framework + 'env'](expected);
	}

	assertInstrumentation(framework, buildType, service) {
		if (service.instrumentation) {
			let files = service.instrumentation['java_' + framework];
			files.forEach(file => {
				it('should generate file ' + file + ' for service ' + service.location, function () {
					assert.file(file);
				});
			})
			this['assert' + framework + 'src'](true, buildType);
		} else {
			this['assert' + framework + 'src'](false, buildType);
		}
	}

	assertlibertyenv(expected) {
		if (expected.jndiEntries) {
			expected.jndiEntries.forEach(entry => {
				assertLiberty.assertJNDI(entry.name, entry.value);
			});
		}
		if (expected.envEntries) {
			expected.envEntries.forEach(entry => {
				assertLiberty.assertEnv(entry.name, entry.value);
			});
		}
	}

	assertlibertysrc(exists, buildType) {
		let check = exists ? assert.file : assert.noFile;
		let desc = exists ? 'should ' : 'should not ';
		let buildTest = common.test(buildType);
		buildTest.assertDependency(exists, 'provided', 'javax.json', 'javax.json-api', '1.0');
		buildTest.assertDependency(exists, 'provided', 'com.ibm.websphere.appserver.api', 'com.ibm.websphere.appserver.api.json', '1.0.10');
		buildTest.assertDependency(exists, 'provided', 'javax.enterprise', 'cdi-api', '1.2');
		assertLiberty.assertFeature(exists, 'jsonp-1.0');
		assertLiberty.assertFeature(exists, 'jndi-1.0');
		assertLiberty.assertFeature(exists, 'cdi-1.2');
		it(desc + 'generate BluemixCredentials.java file', function () {
			check('src/main/java/application/bluemix/BluemixCredentials.java');
		});
		it(desc + 'generate InvalidCredentialsException.java file', function () {
			check('src/main/java/application/bluemix/InvalidCredentialsException.java');
		});
		it(desc + 'generate ServiceName.java file', function () {
			check('src/main/java/application/bluemix/ServiceName.java');
		});
		if (exists) {
			it('should generate VCAPServices.java file', function () {
				assert.fileContent('src/main/java/application/bluemix/VCAPServices.java', 'import javax.json.Json;');
			});
		}
	}

	assertspringenv(expected) {
		if (expected.envEntries) {
			expected.envEntries.forEach(entry => {
				assertSpring.assertEnv(entry.name, entry.value);
			});
		}
	}

	assertspringsrc(exists) {
		let check = exists ? assert.file : assert.noFile;
		let desc = exists ? 'should ' : 'should not ';
		it(desc + 'generate BluemixCredentials.java file', function () {
			check('src/main/java/application/bluemix/BluemixCredentials.java');
		});
		it(desc + 'generate InvalidCredentialsException.java file', function () {
			check('src/main/java/application/bluemix/InvalidCredentialsException.java');
		});
		it(desc + 'generate ServiceName.java file', function () {
			check('src/main/java/application/bluemix/ServiceName.java');
		});
		if (exists) {
			it('should generate VCAPServices.java file', function () {
				assert.fileContent('src/main/java/application/bluemix/VCAPServices.java', 'import com.fasterxml.jackson.databind.JsonNode;');
			});
		}
	}

	before() {
		const filePath = path.join(__dirname, "resources", "java", "index.js");
		return helpers.run(filePath)
			.withOptions(this.values)
			.toPromise();
	}
}

// const FRAMEWORKS = ['liberty', 'spring'];
const BUILD_TYPES = ['maven', 'gradle'];
let spring_services = getServices('java-spring');
let liberty_services = getServices('java-liberty');

testServices(spring_services, 'spring', 'SPRING');
testServices(liberty_services, 'liberty', 'JAVA');
testTestService();

//find all services that have been enabled for Java
function getServices(subFolder) {
	let root = path.join(__dirname, "..", 'generators');
	let folders = fs.readdirSync(root);
	let services = [];
	folders.forEach(folder => {
		if (folder.startsWith('service-')) {
			let svcpath = path.join(root, folder, 'templates', subFolder);
			if (fs.existsSync(svcpath)) {
				services.push(path.basename(folder));
			}
		}
	});
	return services;
}

function testServices(services, framework, backendPlatform) {
	BUILD_TYPES.forEach(buildType => {
		services.forEach(dirname => {
			describe(`java generator : test ${framework}, ${buildType}, ${dirname}   `, function () {
				this.timeout(10000);
				let service = svcHelpers.fromDirName(dirname, optionsBluemix);
				let options = new Options(service, backendPlatform);
				before(options.before.bind(options));
				options.assertConfig(framework, buildType, service, undefined);
				options.assertLocalDevConfig(framework, buildType, service);
				options.assertInstrumentation(framework, buildType, service);
			})
		})
	})
}

function testTestService() {
	describe('java generator : test liberty, maven, test service', function () {
		this.timeout(10000);
		let testService = {
			"url": "https://account.test.com",
			"serviceInfo": {
				"label": "test-label",
				"name": "test-name",
				"plan": "test-plan"
			}
		}
		let bluemixJson = optionsBluemix;
		bluemixJson.test = testService;
		let service = svcHelpers.serviceTest(bluemixJson)
		let options = new Options(service, 'JAVA');
		before(options.before.bind(options));
		let configPath = path.join(__dirname, "..", "test", "resources", "java", "service-test", "templates", 'java-liberty', "config.json.template");
		options.assertConfig('liberty', 'maven', service, configPath);
		options.assertLocalDevConfig('liberty', 'maven', service);
		options.assertInstrumentation('liberty', 'maven', service);
	});
}
